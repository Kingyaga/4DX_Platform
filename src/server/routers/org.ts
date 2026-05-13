import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../audit";

export const orgRouter = router({
  // Create organization — first user becomes admin
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
        slug: z
          .string()
          .min(2)
          .regex(/^[a-z0-9-]+$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.organization.findUnique({
        where: { slug: input.slug },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slug already taken.",
        });
      }

      const createdOrg = await ctx.db.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          memberships: {
            create: {
              userId: (ctx.session.user as any).id,
              role: "ADMIN",
            },
          },
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "ORGANIZATION",
        entityId: createdOrg.id,
        action: "ORG_CREATED",
        after: {
          name: createdOrg.name,
          slug: createdOrg.slug,
        },
      });

      return createdOrg;
    }),

  // Admin dashboard — optimized for dashboard display
  getDashboard: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      // Only org admins can see the dashboard
      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: (ctx.session.user as any).id,
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins can access the dashboard.",
        });
      }

      // Pull all teams with basic data (no activity logs for performance)
      const teams = await ctx.db.team.findMany({
        where: { orgId: org.id },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          wigs: {
            where: { status: "ACTIVE" },
            include: {
              leadMeasures: {
                where: { archivedAt: null },
              },
            },
          },
        },
      });

      // Get session stats in a single optimized query instead of Promise.all
      const sessionStats = await ctx.db.weeklySession.groupBy({
        by: ['status'],
        where: {
          wig: {
            team: {
              orgId: org.id
            }
          }
        },
        _count: true,
      });

      const totalSessions = sessionStats.reduce((sum, stat) => sum + stat._count, 0);
      const completedSessions = sessionStats.find(stat => stat.status === 'COMPLETE')?._count || 0;
      const overdueSessions = sessionStats.find(stat => stat.status === 'OVERDUE')?._count || 0;

      return {
        org,
        teams,
        sessionStats: {
          totalSessions,
          completedSessions,
          overdueSessions,
          completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
        },
      };
    }),

  // Admin activity data — optimized for activity page
  getActivityData: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      // Only org admins can see the activity data
      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: (ctx.session.user as any).id,
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins can access activity data.",
        });
      }

      // Pull teams with activity logs only (limited for performance)
      const teams = await ctx.db.team.findMany({
        where: { orgId: org.id },
        select: {
          id: true,
          name: true,
          wigs: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              title: true,
              leadMeasures: {
                where: { archivedAt: null },
                select: {
                  id: true,
                  name: true,
                  targetValue: true,
                  activityLogs: {
                    select: {
                      id: true,
                      value: true,
                      loggedForDate: true,
                      user: {
                        select: { email: true },
                      },
                    },
                    orderBy: { loggedForDate: "desc" },
                    take: 100, // Limit to last 100 entries per measure for performance
                  },
                },
              },
            },
          },
        },
      });

      return {
        org,
        teams,
      };
    }),

  // Get all members of an org — admin only
  getMembers: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: (ctx.session.user as any).id,
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.orgMembership.findMany({
        where: { orgId: org.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
            },
          },
        },
      });
    }),

  // Invite a user to the org — admin only
  inviteMember: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        userId: z.string(),
        role: z.enum(["ADMIN", "MEMBER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: (ctx.session.user as any).id,
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins can invite members.",
        });
      }

      if (input.role === "ADMIN") {
        const existingAdmin = await ctx.db.orgMembership.findFirst({
          where: { orgId: org.id, role: "ADMIN" },
        });

        if (existingAdmin) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This platform is limited to one administrator.",
          });
        }
      }

      // Check user isn't already a member
      const existing = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: input.userId,
            orgId: org.id,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this organization.",
        });
      }

      const newMembership = await ctx.db.orgMembership.create({
        data: {
          userId: input.userId,
          orgId: org.id,
          role: input.role,
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "ORG_MEMBER",
        entityId: newMembership.id,
        action: "ORG_MEMBER_INVITED",
        after: {
          userId: newMembership.userId,
          orgId: newMembership.orgId,
          role: newMembership.role,
        },
      });

      return newMembership;
    }),

  // Change a member's org role — admin only
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        userId: z.string(),
        role: z.enum(["ADMIN", "MEMBER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: (ctx.session.user as any).id,
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Prevent admin from demoting themselves
      if (input.userId === (ctx.session.user as any).id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own role.",
        });
      }

      if (input.role === "ADMIN") {
        const existingAdmin = await ctx.db.orgMembership.findFirst({
          where: {
            orgId: org.id,
            role: "ADMIN",
            userId: { not: input.userId },
          },
        });

        if (existingAdmin) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This platform is limited to one administrator.",
          });
        }
      }

      const previousMembership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: input.userId,
            orgId: org.id,
          },
        },
      });

      const updatedMembership = await ctx.db.orgMembership.update({
        where: {
          userId_orgId: {
            userId: input.userId,
            orgId: org.id,
          },
        },
        data: { role: input.role },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "ORG_MEMBER",
        entityId: updatedMembership.id,
        action: "ORG_MEMBER_ROLE_UPDATED",
        before: {
          role: previousMembership?.role,
        } as Prisma.InputJsonValue,
        after: {
          role: updatedMembership.role,
        } as Prisma.InputJsonValue,
      });

      return updatedMembership;
    }),
  // Get audit logs — admin only
  getAuditLogs: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: (ctx.session.user as any).id,
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }),
  // Get all teams in org with counts — admin only
  getTeams: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: (ctx.session.user as any).id,
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const teams = await ctx.db.team.findMany({
        where: { orgId: org.id },
        include: {
          _count: {
            select: { members: true },
          },
          wigs: {
            where: { status: "ACTIVE" },
            select: { id: true, title: true, status: true },
          },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      return teams.map((team) => ({
        id: team.id,
        name: team.name,
        slug: team.slug,
        leadUserId: team.leadUserId,
        memberCount: team._count.members,
        activeWigCount: team.wigs.length,
        activeWigs: team.wigs,
        members: team.members,
      }));
    }),
});
