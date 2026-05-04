import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

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

      return ctx.db.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          memberships: {
            create: {
              userId: ctx.session.user.id,
              role: "ADMIN",
            },
          },
        },
      });
    }),

  // Admin dashboard — full portfolio view across all teams
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
            userId: ctx.session.user.id,
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

      // Pull all teams with full health data
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
                include: {
                  activityLogs: {
                    orderBy: { loggedForDate: "desc" },
                    take: 4, // Last 4 weeks of data for sparklines
                  },
                },
              },
            },
          },
        },
      });

      // Pull session completion rates per team
      const sessionStats = await Promise.all(
        teams.map(async (team) => {
          const totalSessions = await ctx.db.weeklySession.count({
            where: { wig: { teamId: team.id } },
          });

          const completedSessions = await ctx.db.weeklySession.count({
            where: {
              wig: { teamId: team.id },
              status: "COMPLETE",
            },
          });

          const overdueSessions = await ctx.db.weeklySession.count({
            where: {
              wig: { teamId: team.id },
              status: "OVERDUE",
            },
          });

          return {
            teamId: team.id,
            totalSessions,
            completedSessions,
            overdueSessions,
            completionRate:
              totalSessions > 0
                ? Math.round((completedSessions / totalSessions) * 100)
                : 0,
          };
        }),
      );

      return {
        org,
        teams,
        sessionStats,
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
            userId: ctx.session.user.id,
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
            userId: ctx.session.user.id,
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

      return ctx.db.orgMembership.create({
        data: {
          userId: input.userId,
          orgId: org.id,
          role: input.role,
        },
      });
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
            userId: ctx.session.user.id,
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Prevent admin from demoting themselves
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own role.",
        });
      }

      return ctx.db.orgMembership.update({
        where: {
          userId_orgId: {
            userId: input.userId,
            orgId: org.id,
          },
        },
        data: { role: input.role },
      });
    }),
});
