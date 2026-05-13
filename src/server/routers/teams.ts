import { z } from "zod";
import { Prisma } from "@prisma/client";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../audit";
import { notify } from "../notify";
import { sendTeamMembershipEmail } from "../email";

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
          message: "Only org admins can create teams.",
        });
      }

      const teamLeadUserId = (ctx.session.user as any).id;
      const team = await ctx.db.team.create({
        data: {
          name: input.name,
          slug: input.slug,
          orgId: org.id,
          leadUserId: teamLeadUserId,
        },
      });

      await ctx.db.teamMembership.create({
        data: {
          userId: teamLeadUserId,
          teamId: team.id,
          role: "LEAD",
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: teamLeadUserId,
        entityType: "TEAM",
        entityId: team.id,
        action: "TEAM_CREATED",
        after: {
          name: team.name,
          slug: team.slug,
          orgId: team.orgId,
          leadUserId: team.leadUserId,
        },
      });

      return team;
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

      const isOrgAdmin = team.org.memberships.some(
        (m) => m.userId === (ctx.session.user as any).id && m.role === "ADMIN",
      );
      const isTeamLead = team.leadUserId === (ctx.session.user as any).id;

      if (!isOrgAdmin && !isTeamLead) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins or the team lead can add members.",
        });
      }

      const existingUserTeam = await ctx.db.teamMembership.findFirst({
        where: {
          userId: input.userId,
          teamId: team.id,
        },
      });

      if (existingUserTeam) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This user is already assigned to this team.",
        });
      }

      const newMembership = await ctx.db.teamMembership.create({
        data: {
          teamId: team.id,
          userId: input.userId,
          role: input.role,
        },
      });

      const addedUser = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, email: true },
      });

      if (addedUser) {
        await notify({
          db: ctx.db,
          userId: addedUser.id,
          type: "TEAM_MEMBER_ADDED",
          payload: { teamId: team.id, teamName: team.name, role: input.role },
        });
        await sendTeamMembershipEmail({
          to: addedUser.email,
          name: addedUser.name,
          teamName: team.name,
          action: "added",
        });
      }

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
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

  // Assign a new team lead — org admin only
  assignLead: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        userId: z.string(),
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

      const isOrgAdmin = team.org.memberships.some(
        (m) => m.userId === (ctx.session.user as any).id && m.role === "ADMIN",
      );

      if (!isOrgAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins can assign a team lead.",
        });
      }

      const isMember = team.members.some((m) => m.userId === input.userId);
      if (!isMember) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The new team lead must already be a member of the team.",
        });
      }

      await ctx.db.teamMembership.updateMany({
        where: {
          teamId: team.id,
          userId: team.leadUserId,
        },
        data: { role: "MEMBER" },
      });

      await ctx.db.teamMembership.updateMany({
        where: {
          teamId: team.id,
          userId: input.userId,
        },
        data: { role: "LEAD" },
      });

      const updatedTeam = await ctx.db.team.update({
        where: { id: team.id },
        data: { leadUserId: input.userId },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
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

  delete: protectedProcedure
    .input(z.object({ teamSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
      });

      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
      }

      const orgMembership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: (ctx.session.user as any).id,
            orgId: team.orgId,
          },
        },
      });

      if (!orgMembership || orgMembership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only organization admins can delete teams.",
        });
      }

      await ctx.db.$transaction([
        ctx.db.activityLog.deleteMany({
          where: { leadMeasure: { wig: { teamId: team.id } } },
        }),
        ctx.db.commitment.deleteMany({
          where: { linkedLeadMeasure: { wig: { teamId: team.id } } },
        }),
        ctx.db.leadMeasureOwner.deleteMany({
          where: { leadMeasure: { wig: { teamId: team.id } } },
        }),
        ctx.db.leadMeasure.deleteMany({
          where: { wig: { teamId: team.id } },
        }),
        ctx.db.weeklySession.deleteMany({
          where: { wig: { teamId: team.id } },
        }),
        ctx.db.wIG.deleteMany({
          where: { teamId: team.id },
        }),
        ctx.db.teamMembership.deleteMany({
          where: { teamId: team.id },
        }),
        ctx.db.team.delete({
          where: { id: team.id },
        }),
      ]);

      // Handle invite deletion separately with error handling
      // (table might not exist or be incomplete in some environments)
      try {
        await ctx.db.invite.deleteMany({
          where: { teamId: team.id },
        });
      } catch (error) {
        console.warn("Could not delete team invites - table may not exist", error);
        // Don't fail the deletion if invites can't be cleaned up
      }

      return { success: true };
    }),

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

  getMyTeams: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const userId = (ctx.session.user as any).id;
      return ctx.db.team.findMany({
        where: {
          orgId: org.id,
          OR: [
            { members: { some: { userId } } },
            { leadUserId: userId },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          leadUserId: true,
          createdAt: true,
          members: {
            where: { userId },
            select: { role: true },
          },
          wigs: {
            where: { status: "ACTIVE" },
            select: { id: true },
          },
        },
      });
    }),

  getAllTeams: protectedProcedure
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
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only organization admins can view all teams.",
        });
      }

      return ctx.db.team.findMany({
        where: { orgId: org.id },
        include: {
          members: {
            include: { user: true },
          },
          wigs: {
            where: { status: "ACTIVE" },
          },
        },
      });
    }),

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
        (m) => m.userId === (ctx.session.user as any).id && m.role === "ADMIN",
      );
      const isTeamLead = team.leadUserId === (ctx.session.user as any).id;

      if (!isOrgAdmin && !isTeamLead) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins or the team lead can remove members.",
        });
      }

      if (input.userId === team.leadUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove the team lead. Assign a new lead first.",
        });
      }

      const removedUser = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, email: true },
      });

      await ctx.db.teamMembership.deleteMany({
        where: {
          teamId: team.id,
          userId: input.userId,
        },
      });

      if (removedUser) {
        await notify({
          db: ctx.db,
          userId: removedUser.id,
          type: "TEAM_MEMBER_REMOVED",
          payload: { teamId: team.id, teamName: team.name },
        });
        await sendTeamMembershipEmail({
          to: removedUser.email,
          name: removedUser.name,
          teamName: team.name,
          action: "removed",
        });
      }

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
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

      const leadMeasureIds = team.wigs.flatMap((w) =>
        w.leadMeasures.map((lm) => lm.id),
      );

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
