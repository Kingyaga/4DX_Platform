import { z } from "zod";
import { Prisma } from "@prisma/client";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../audit";

export const teamsRouter = router({
  // Org admin creates a team
  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        name: z.string().min(2),
        slug: z
          .string()
          .min(2)
          .regex(/^[a-z0-9-]+$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      // Only org admins can create teams
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
          message: "Only org admins can create teams.",
        });
      }

      const createdTeam = await ctx.db.team.create({
        data: {
          name: input.name,
          slug: input.slug,
          orgId: org.id,
          leadUserId: ctx.session.user.id,
          members: {
            create: {
              userId: ctx.session.user.id,
              role: "LEAD",
            },
          },
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        entityType: "TEAM",
        entityId: createdTeam.id,
        action: "TEAM_CREATED",
        after: {
          name: createdTeam.name,
          slug: createdTeam.slug,
          orgId: createdTeam.orgId,
        },
      });

      return createdTeam;
    }),

  // Add a member to a team — org admin or current team lead only
  addMember: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        userId: z.string(),
        role: z.enum(["LEAD", "MEMBER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: { org: { include: { memberships: true } } },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      // Check if requester is org admin or team lead
      const isOrgAdmin = team.org.memberships.some(
        (m) => m.userId === ctx.session.user.id && m.role === "ADMIN",
      );
      const isTeamLead = team.leadUserId === ctx.session.user.id;

      if (!isOrgAdmin && !isTeamLead) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins or the team lead can add members.",
        });
      }

      const newMembership = await ctx.db.teamMembership.create({
        data: {
          teamId: team.id,
          userId: input.userId,
          role: input.role,
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        entityType: "TEAM_MEMBER",
        entityId: newMembership.id,
        action: "TEAM_MEMBER_ADDED",
        after: {
          teamId: newMembership.teamId,
          userId: newMembership.userId,
          role: newMembership.role,
        },
      });

      return newMembership;
    }),

  // ← NEW: Assign a new team lead — org admin only
  assignTeamLead: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        newLeadUserId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: {
          org: { include: { memberships: true } },
          members: true,
        },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      // Only org admins can reassign the team lead
      const isOrgAdmin = team.org.memberships.some(
        (m) => m.userId === ctx.session.user.id && m.role === "ADMIN",
      );

      if (!isOrgAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins can assign a new team lead.",
        });
      }

      // New lead must already be a member of the team
      const isMember = team.members.some(
        (m) => m.userId === input.newLeadUserId,
      );
      if (!isMember) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The new team lead must already be a member of the team.",
        });
      }

      // Step 1: Demote current lead to MEMBER

      if (!isMember) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The new team lead must already be a member of the team.",
        });
      }

      // Step 1: Demote current lead to MEMBER
      await ctx.db.teamMembership.updateMany({
        where: {
          teamId: team.id,
          userId: team.leadUserId,
        },
        data: { role: "MEMBER" },
      });

      // Step 2: Promote new lead to LEAD
      await ctx.db.teamMembership.updateMany({
        where: {
          teamId: team.id,
          userId: input.newLeadUserId,
        },
        data: { role: "LEAD" },
      });

      // Step 3: Update the team's leadUserId
      const updatedTeam = await ctx.db.team.update({
        where: { id: team.id },
        data: { leadUserId: input.newLeadUserId },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        entityType: "TEAM",
        entityId: team.id,
        action: "TEAM_LEAD_ASSIGNED",
        before: {
          leadUserId: team.leadUserId,
        } as Prisma.InputJsonValue,
        after: {
          leadUserId: updatedTeam.leadUserId,
        } as Prisma.InputJsonValue,
      });

      return updatedTeam;
    }),

  // Get team by slug — members and lead included
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.slug },
        include: {
          members: {
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
          },
          wigs: {
            where: { status: "ACTIVE" },
            include: { leadMeasures: true },
          },
        },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      return team;
    }),

  // Remove a member — org admin or team lead only
  removeMember: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: { org: { include: { memberships: true } } },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      const isOrgAdmin = team.org.memberships.some(
        (m) => m.userId === ctx.session.user.id && m.role === "ADMIN",
      );
      const isTeamLead = team.leadUserId === ctx.session.user.id;

      if (!isOrgAdmin && !isTeamLead) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins or the team lead can remove members.",
        });
      }

      // Cannot remove the current team lead
      if (input.userId === team.leadUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove the team lead. Assign a new lead first.",
        });
      }

      await ctx.db.teamMembership.deleteMany({
        where: {
          teamId: team.id,
          userId: input.userId,
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        entityType: "TEAM_MEMBER",
        entityId: `${team.id}-${input.userId}`,
        action: "TEAM_MEMBER_REMOVED",
        before: {
          teamId: team.id,
          userId: input.userId,
        } as Prisma.InputJsonValue,
      });

      return { success: true };
    }),
  // Get members of a team with their roles
  getMembers: protectedProcedure
    .input(z.object({ teamSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.teamMembership.findMany({
        where: { teamId: team.id },
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
        orderBy: { role: "asc" },
      });
    }),

  // Get team activity summary
  getActivitySummary: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: {
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

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (input.startDate) dateFilter.gte = new Date(input.startDate);
      if (input.endDate) dateFilter.lte = new Date(input.endDate);

      // Get all lead measure IDs for this team
      const leadMeasureIds = team.wigs.flatMap((w) =>
        w.leadMeasures.map((lm) => lm.id),
      );

      // Get all activity logs for those lead measures
      const activityLogs = await ctx.db.activityLog.findMany({
        where: {
          leadMeasureId: { in: leadMeasureIds },
          ...(Object.keys(dateFilter).length > 0
            ? { loggedForDate: dateFilter }
            : {}),
        },
        include: {
          user: { select: { id: true, name: true } },
          leadMeasure: {
            select: { id: true, name: true, targetValue: true, unit: true },
          },
        },
        orderBy: { loggedForDate: "desc" },
      });

      // Aggregate by lead measure
      const summaryByLeadMeasure = leadMeasureIds.map((lmId) => {
        const lm = team.wigs
          .flatMap((w) => w.leadMeasures)
          .find((lm) => lm.id === lmId);

        const logs = activityLogs.filter((l) => l.leadMeasureId === lmId);
        const total = logs.reduce((sum, l) => sum + l.value, 0);

        return {
          leadMeasureId: lmId,
          name: lm?.name ?? "",
          targetValue: lm?.targetValue ?? 0,
          unit: lm?.unit ?? "",
          totalLogged: total,
          percentComplete: lm?.targetValue
            ? Math.round((total / lm.targetValue) * 100)
            : 0,
          logCount: logs.length,
          logs,
        };
      });

      return {
        teamId: team.id,
        teamName: team.name,
        summaryByLeadMeasure,
        totalLogs: activityLogs.length,
      };
    }),
});
