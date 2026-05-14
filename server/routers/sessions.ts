import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { notify, notifyMany } from "../notify";
import { sendSessionReadyEmail } from "../email";
import { auditLog } from "../audit";

export const sessionsRouter = router({
  // Called every Monday to generate sessions for all team members
  generateForTeam: protectedProcedure
    .input(z.object({ teamSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: {
          members: true,
          wigs: { where: { status: "ACTIVE" } },
        },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      if (team.leadUserId !== (ctx.session.user as any).id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const monday = getThisMonday();
      const sessionsToCreate = [];

      for (const member of team.members) {
        // Check if this member already has an active session this week
        const existingSession = await ctx.db.weeklySession.findFirst({
          where: {
            userId: member.userId,
            weekStarting: monday,
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
        });

        if (existingSession) continue;

        for (const wig of team.wigs) {
          sessionsToCreate.push({
            userId: member.userId,
            wigId: wig.id,
            weekStarting: monday,
            status: "PENDING" as const,
          });
        }
      }

      await ctx.db.weeklySession.createMany({
        data: sessionsToCreate,
        skipDuplicates: true,
      });

      // Log the generation event
      if (sessionsToCreate.length > 0) {
        await auditLog({
          db: ctx.db,
          actorUserId: (ctx.session.user as any).id,
          entityType: "TEAM_SESSION_GENERATION",
          entityId: input.teamSlug,
          action: "SESSION_GENERATED",
          after: {
            teamSlug: input.teamSlug,
            sessionsCreated: sessionsToCreate.length,
            weekStarting: monday.toISOString(),
          },
        });
      }

      // Notify each member their session is ready
      const uniqueUserIds = [...new Set(sessionsToCreate.map((s) => s.userId))];

      await notifyMany({
        db: ctx.db,
        userIds: uniqueUserIds,
        type: "SESSION_READY",
        payload: {
          teamSlug: input.teamSlug,
          weekStarting: monday.toISOString(),
          message:
            "Your weekly session is ready. Complete it before the end of the week.",
        },
      });

      // Send email to each member
      const members = await ctx.db.user.findMany({
        where: { id: { in: uniqueUserIds } },
        select: { id: true, name: true, email: true },
      });

      await Promise.all(
        members.map((member) =>
          sendSessionReadyEmail({
            to: member.email,
            name: member.name,
            teamName: team.name,
          }),
        ),
      );

      return { created: sessionsToCreate.length };
    }),

  // Step 1 of 3: Account — review last week's commitments
  completeAccount: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        commitmentUpdates: z.array(
          z.object({
            commitmentId: z.string(),
            status: z.enum(["DONE", "PARTIAL", "NOT_DONE"]),
            notDoneReason: z
              .enum(["WHIRLWIND", "MISJUDGED", "BLOCKED", "OTHER"])
              .optional(),
            reflection: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.weeklySession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== (ctx.session.user as any).id)
        throw new TRPCError({ code: "FORBIDDEN" });
      if (session.accountDoneAt)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Account step already completed.",
        });

      // Verify user is a team member — admins cannot complete sessions
      const sessionWig = await ctx.db.wIG.findUnique({
        where: { id: session.wigId },
        include: { team: true },
      });

      if (sessionWig) {
        const teamMembership = await ctx.db.teamMembership.findUnique({
          where: {
            userId_teamId: {
              userId: (ctx.session.user as any).id,
              teamId: sessionWig.team.id,
            },
          },
        });

        if (!teamMembership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You must be a team member to complete sessions.",
          });
        }
      }

      // Update each commitment's outcome
      await Promise.all(
        input.commitmentUpdates.map((update) =>
          ctx.db.commitment.update({
            where: { id: update.commitmentId },
            data: {
              status: update.status,
              notDoneReason: update.notDoneReason,
              reflection: update.reflection,
              resolvedAt: new Date(),
            },
          }),
        ),
      );

      const updatedSession = await ctx.db.weeklySession.update({
        where: { id: input.sessionId },
        data: {
          accountDoneAt: new Date(),
          status: "IN_PROGRESS",
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "WEEKLY_SESSION",
        entityId: input.sessionId,
        action: "SESSION_ACCOUNT_COMPLETED",
        after: {
          sessionId: input.sessionId,
          status: "IN_PROGRESS",
          commitmentCount: input.commitmentUpdates.length,
        },
      });

      return updatedSession;
    }),

  // Step 2 of 3: Review — acknowledge the scoreboard
  completeReview: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.weeklySession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== (ctx.session.user as any).id)
        throw new TRPCError({ code: "FORBIDDEN" });

      // Verify user is a team member
      const sessionWig = await ctx.db.wIG.findUnique({
        where: { id: session.wigId },
        include: { team: true },
      });

      if (sessionWig) {
        const teamMembership = await ctx.db.teamMembership.findUnique({
          where: {
            userId_teamId: {
              userId: (ctx.session.user as any).id,
              teamId: sessionWig.team.id,
            },
          },
        });

        if (!teamMembership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You must be a team member to complete sessions.",
          });
        }
      }

      // Gate: Account must be done first
      if (!session.accountDoneAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "You must complete the Account step before reviewing the scoreboard.",
        });
      }

      if (session.reviewDoneAt)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Review step already completed.",
        });

      const updatedReviewSession = await ctx.db.weeklySession.update({
        where: { id: input.sessionId },
        data: { reviewDoneAt: new Date() },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "WEEKLY_SESSION",
        entityId: input.sessionId,
        action: "SESSION_REVIEW_COMPLETED",
        after: {
          sessionId: input.sessionId,
          reviewDoneAt: updatedReviewSession.reviewDoneAt,
        },
      });

      return updatedReviewSession;
    }),

  // Step 3 of 3: Commit — make 1-3 commitments for next week
  completeCommit: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        commitments: z
          .array(
            z.object({
              text: z.string().min(5),
              linkedLeadMeasureId: z.string().optional(),
            }),
          )
          .min(1)
          .max(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.weeklySession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== (ctx.session.user as any).id)
        throw new TRPCError({ code: "FORBIDDEN" });

      // Verify user is a team member
      const sessionWig = await ctx.db.wIG.findUnique({
        where: { id: session.wigId },
        include: { team: true },
      });

      if (sessionWig) {
        const teamMembership = await ctx.db.teamMembership.findUnique({
          where: {
            userId_teamId: {
              userId: (ctx.session.user as any).id,
              teamId: sessionWig.team.id,
            },
          },
        });

        if (!teamMembership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You must be a team member to complete sessions.",
          });
        }
      }

      // Gate: Both Account and Review must be done first
      if (!session.accountDoneAt || !session.reviewDoneAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must complete the Account and Review steps first.",
        });
      }

      if (session.commitDoneAt)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Commit step already completed.",
        });

      await ctx.db.commitment.createMany({
        data: input.commitments.map((c) => ({
          weeklySessionId: input.sessionId,
          text: c.text,
          linkedLeadMeasureId: c.linkedLeadMeasureId,
          status: "PENDING",
        })),
      });

      const updatedCommitSession = await ctx.db.weeklySession.update({
        where: { id: input.sessionId },
        data: {
          commitDoneAt: new Date(),
          status: "COMPLETE",
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "WEEKLY_SESSION",
        entityId: input.sessionId,
        action: "SESSION_COMMIT_COMPLETED",
        after: {
          sessionId: input.sessionId,
          status: "COMPLETE",
          commitmentCount: input.commitments.length,
        },
      });

      // Notify team lead that this member completed their session
      const completedSession = await ctx.db.weeklySession.findUnique({
        where: { id: input.sessionId },
        include: {
          wig: { include: { team: true } },
          user: { select: { name: true } },
        },
      });

      if (completedSession) {
        await notify({
          db: ctx.db,
          userId: completedSession.wig.team.leadUserId,
          type: "SESSION_READY",
          payload: {
            message: `${completedSession.user.name} has completed their weekly session.`,
            sessionId: input.sessionId,
          },
        });
      }

      return updatedCommitSession;
    }),

  // Get current week sessions for the logged in user in a team
  getCurrentSession: protectedProcedure
    .input(z.object({ teamSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: { wigs: { where: { status: "ACTIVE" } } },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      const monday = getThisMonday();

      return ctx.db.weeklySession.findMany({
        where: {
          userId: (ctx.session.user as any).id,
          wig: { teamId: team.id },
          weekStarting: monday,
        },
        include: {
          commitments: true,
          wig: {
            include: {
              leadMeasures: {
                where: { archivedAt: null },
              },
            },
          },
        },
      });
    }),

  // Get a single session for the logged in user
  getMySession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.weeklySession.findUnique({
        where: { id: input.sessionId },
        include: {
          commitments: true,
          wig: { include: { leadMeasures: true } },
        },
      });

      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== (ctx.session.user as any).id)
        throw new TRPCError({ code: "FORBIDDEN" });

      return session;
    }),

  // Team lead views all sessions for their team this week
  getTeamSessions: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        weekStarting: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: { members: true },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      const isTeamLead = team.leadUserId === (ctx.session.user as any).id;
      const isOrgAdmin = await ctx.db.orgMembership.findFirst({
        where: {
          userId: (ctx.session.user as any).id,
          orgId: team.orgId,
          role: "ADMIN",
        },
      });

      if (!isTeamLead && !isOrgAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only the team lead or org admin can view all team sessions.",
        });
      }

      const weekFilter = input.weekStarting
        ? new Date(input.weekStarting)
        : getThisMonday();

      return ctx.db.weeklySession.findMany({
        where: {
          wig: { teamId: team.id },
          weekStarting: weekFilter,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          wig: {
            select: { id: true, title: true },
          },
          commitments: true,
        },
        orderBy: { user: { name: "asc" } },
      });
    }),
});

// Helper: get the most recent Monday at midnight UTC
function getThisMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}
