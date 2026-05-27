import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { notify, notifyMany } from "../notify";
import { sendSessionReadyEmail } from "../email";
import { auditLog } from "../audit";
import { buildWeeklySessionSnapshot } from "../sessionSnapshot";

function getWeekEnding(weekStarting: Date) {
  const weekEnding = new Date(weekStarting);
  weekEnding.setUTCDate(weekEnding.getUTCDate() + 6);
  weekEnding.setUTCHours(23, 59, 59, 999);
  return weekEnding;
}

function getLeadMeasureScore(leadMeasure: any) {
  if (leadMeasure.trackingType && !["NUMERIC", "PERCENTAGE", "DURATION"].includes(leadMeasure.trackingType)) {
    const latest = [...(leadMeasure.activityLogs || [])].sort((a: any, b: any) => new Date(b.loggedForDate).getTime() - new Date(a.loggedForDate).getTime())[0];
    if (latest?.progressStatus === "DONE") return 100;
    if (latest?.progressStatus === "IN_PROGRESS") return 50;
    if (latest?.progressStatus === "BLOCKED") return 25;
    return 0;
  }

  const total = (leadMeasure.activityLogs || []).reduce((sum: number, log: any) => sum + (log.value ?? 0), 0);
  const target = leadMeasure.targetValue ?? 0;
  return target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
}

async function buildWeeklySnapshot(ctx: any, teamId: string, weekStarting: Date) {
  const weekEnding = getWeekEnding(weekStarting);
  const wigs = await ctx.db.wIG.findMany({
    where: { teamId, status: "ACTIVE" },
    include: {
      leadMeasures: {
        where: { archivedAt: null },
        include: {
          activityLogs: {
            where: {
              status: "APPROVED",
              loggedForDate: { gte: weekStarting, lte: weekEnding },
            },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { loggedForDate: "desc" },
          },
        },
      },
    },
  });

  const wigSnapshots = wigs.map((wig: any) => {
    const leadMeasures = (wig.leadMeasures || []).map((leadMeasure: any) => {
      const score = getLeadMeasureScore(leadMeasure);
      return {
        id: leadMeasure.id,
        name: leadMeasure.name,
        trackingType: leadMeasure.trackingType,
        targetValue: leadMeasure.targetValue,
        unit: leadMeasure.unit,
        activityCount: leadMeasure.activityLogs.length,
        score,
        missed: score < 100,
      };
    });

    const progress = leadMeasures.length > 0
      ? Math.round(leadMeasures.reduce((sum: number, leadMeasure: any) => sum + leadMeasure.score, 0) / leadMeasures.length)
      : 0;

    return {
      id: wig.id,
      title: wig.title,
      trackingType: wig.trackingType,
      status: wig.status,
      progress,
      leadMeasures,
      activityLogCount: leadMeasures.reduce((sum: number, leadMeasure: any) => sum + leadMeasure.activityCount, 0),
      missedLeadMeasures: leadMeasures.filter((leadMeasure: any) => leadMeasure.missed).length,
    };
  });

  return {
    capturedAt: new Date().toISOString(),
    weekStarting: weekStarting.toISOString(),
    weekEnding: weekEnding.toISOString(),
    wigs: wigSnapshots,
    totals: {
      activeWigs: wigSnapshots.length,
      leadMeasures: wigSnapshots.reduce((sum: number, wig: any) => sum + wig.leadMeasures.length, 0),
      activityLogs: wigSnapshots.reduce((sum: number, wig: any) => sum + wig.activityLogCount, 0),
      missedLeadMeasures: wigSnapshots.reduce((sum: number, wig: any) => sum + wig.missedLeadMeasures, 0),
      averageProgress: wigSnapshots.length > 0
        ? Math.round(wigSnapshots.reduce((sum: number, wig: any) => sum + wig.progress, 0) / wigSnapshots.length)
        : 0,
    },
  };
}

export const sessionsRouter = router({
  createManual: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        title: z.string().min(3).max(160).optional(),
        weekStarting: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: { members: true },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      const isTeamLead = team.leadUserId === ctx.session.user.id;
      const isOrgAdmin = await ctx.db.orgMembership.findFirst({
        where: { userId: ctx.session.user.id, orgId: team.orgId, role: "ADMIN" },
      });

      if (!isTeamLead && !isOrgAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only a team lead or admin can start a weekly session." });
      }

      const weekStarting = input.weekStarting ?? getThisMonday();
      weekStarting.setUTCHours(0, 0, 0, 0);

      const existing = await ctx.db.weeklySession.findFirst({
        where: { teamId: team.id, weekStarting, wigId: null, userId: null },
      });

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A team weekly session already exists for this week." });
      }

      const snapshot = await buildWeeklySnapshot(ctx, team.id, weekStarting);
      const session = await ctx.db.weeklySession.create({
        data: {
          title: input.title || `${team.name} Weekly Session`,
          weekStarting,
          weekEnding: getWeekEnding(weekStarting),
          status: "IN_PROGRESS",
          startedAt: new Date(),
          teamId: team.id,
          facilitatorUserId: ctx.session.user.id,
          snapshotJson: snapshot,
          timeline: {
            create: {
              type: "SESSION_STARTED",
              actorUserId: ctx.session.user.id,
              payloadJson: { teamName: team.name, weekStarting: weekStarting.toISOString() },
            },
          },
        },
        include: {
          team: true,
          commitments: true,
          blockers: true,
          timeline: { include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } },
        },
      });

      await notifyMany({
        db: ctx.db,
        userIds: team.members.map((member) => member.userId),
        type: "SESSION_READY",
        payload: { sessionId: session.id, teamSlug: input.teamSlug, message: "A weekly execution session has started." },
      });

      return session;
    }),

  getTeamWeeklySession: protectedProcedure
    .input(z.object({ teamSlug: z.string(), weekStarting: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: { members: true },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      const isMember = team.members.some((member) => member.userId === ctx.session.user.id);
      const isOrgAdmin = await ctx.db.orgMembership.findFirst({
        where: { userId: ctx.session.user.id, orgId: team.orgId, role: "ADMIN" },
      });

      if (!isMember && !isOrgAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You must belong to this team to view its weekly session." });
      }

      const weekStarting = input.weekStarting ? new Date(input.weekStarting) : getThisMonday();
      weekStarting.setUTCHours(0, 0, 0, 0);

      return ctx.db.weeklySession.findFirst({
        where: { teamId: team.id, weekStarting, wigId: null, userId: null },
        include: {
          team: true,
          commitments: { include: { linkedLeadMeasure: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
          blockers: { include: { createdBy: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } },
          timeline: { include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } },
        },
      });
    }),

  updateTeamSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        notes: z.string().optional(),
        confidenceScore: z.number().int().min(1).max(10).optional(),
        status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETE", "OVERDUE"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.weeklySession.findUnique({ where: { id: input.sessionId }, include: { team: true } });
      if (!session?.team) throw new TRPCError({ code: "NOT_FOUND" });

      const isTeamLead = session.team.leadUserId === ctx.session.user.id;
      const isTeamMember = await ctx.db.teamMembership.findUnique({
        where: { userId_teamId: { userId: ctx.session.user.id, teamId: session.team.id } },
      });
      if (!isTeamLead && !isTeamMember) throw new TRPCError({ code: "FORBIDDEN" });

      const updated = await ctx.db.weeklySession.update({
        where: { id: input.sessionId },
        data: {
          notes: input.notes,
          confidenceScore: input.confidenceScore,
          status: input.status,
          completedAt: input.status === "COMPLETE" ? new Date() : undefined,
          timeline: {
            create: {
              type: input.status === "COMPLETE" ? "SESSION_COMPLETED" : "SESSION_UPDATED",
              actorUserId: ctx.session.user.id,
              payloadJson: { notesUpdated: input.notes !== undefined, confidenceScore: input.confidenceScore, status: input.status },
            },
          },
        },
        include: {
          commitments: true,
          blockers: true,
          timeline: { include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } },
        },
      });

      return updated;
    }),

  addTeamCommitment: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        text: z.string().min(5),
        linkedLeadMeasureId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.weeklySession.findUnique({ where: { id: input.sessionId }, include: { team: true } });
      if (!session?.team) throw new TRPCError({ code: "NOT_FOUND" });

      const membership = await ctx.db.teamMembership.findUnique({
        where: { userId_teamId: { userId: ctx.session.user.id, teamId: session.team.id } },
      });
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      const commitment = await ctx.db.commitment.create({
        data: {
          weeklySessionId: input.sessionId,
          text: input.text,
          linkedLeadMeasureId: input.linkedLeadMeasureId,
        },
      });

      await ctx.db.sessionTimelineEvent.create({
        data: {
          weeklySessionId: input.sessionId,
          actorUserId: ctx.session.user.id,
          type: "COMMITMENT_ADDED",
          payloadJson: { commitmentId: commitment.id, text: commitment.text },
        },
      });

      return commitment;
    }),

  addBlocker: protectedProcedure
    .input(z.object({ sessionId: z.string(), title: z.string().min(3), details: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.weeklySession.findUnique({ where: { id: input.sessionId }, include: { team: true } });
      if (!session?.team) throw new TRPCError({ code: "NOT_FOUND" });

      const membership = await ctx.db.teamMembership.findUnique({
        where: { userId_teamId: { userId: ctx.session.user.id, teamId: session.team.id } },
      });
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      const blocker = await ctx.db.sessionBlocker.create({
        data: {
          weeklySessionId: input.sessionId,
          title: input.title,
          details: input.details,
          createdByUserId: ctx.session.user.id,
        },
      });

      await ctx.db.sessionTimelineEvent.create({
        data: {
          weeklySessionId: input.sessionId,
          actorUserId: ctx.session.user.id,
          type: "BLOCKER_ADDED",
          payloadJson: { blockerId: blocker.id, title: blocker.title },
        },
      });

      return blocker;
    }),

  // Called every Monday to generate sessions for all team members
  generateForTeam: protectedProcedure
    .input(z.object({ teamSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: {
          members: true,
          wigs: {
            where: { status: "ACTIVE" },
            include: { leadMeasures: { where: { archivedAt: null } } },
          },
        },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      if (team.leadUserId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const monday = getThisMonday();
      const sessionsToCreate = [];

      for (const member of team.members) {
        for (const wig of team.wigs) {
          const existingSession = await ctx.db.weeklySession.findFirst({
            where: {
              userId: member.userId,
              wigId: wig.id,
              weekStarting: monday,
            },
          });

          if (existingSession) continue;

          sessionsToCreate.push({
            userId: member.userId,
            wigId: wig.id,
            weekStarting: monday,
            status: "PENDING" as const,
            snapshotJson: buildWeeklySessionSnapshot({ team, wig }),
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
          actorUserId: ctx.session.user.id,
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
      if (!session.userId || !session.wigId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This endpoint only supports legacy member WIG sessions." });
      }
      if (session.userId !== ctx.session.user.id)
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
              userId: ctx.session.user.id,
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
      const invalidNotDoneUpdate = input.commitmentUpdates.find(
        (update) => update.status === "NOT_DONE" && !update.notDoneReason,
      );

      if (invalidNotDoneUpdate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A not-done commitment requires a reason.",
        });
      }

      if (input.commitmentUpdates.length > 0) {
        const validCommitmentCount = await ctx.db.commitment.count({
          where: {
            id: { in: input.commitmentUpdates.map((update) => update.commitmentId) },
            weeklySession: {
              userId: session.userId,
              wigId: session.wigId,
              weekStarting: { lt: session.weekStarting },
            },
          },
        });

        if (validCommitmentCount !== input.commitmentUpdates.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only account for your own prior commitments on this WIG.",
          });
        }
      }

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
        actorUserId: ctx.session.user.id,
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
      if (!session.userId || !session.wigId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This endpoint only supports legacy member WIG sessions." });
      }
      if (session.userId !== ctx.session.user.id)
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
              userId: ctx.session.user.id,
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
        actorUserId: ctx.session.user.id,
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
      if (!session.userId || !session.wigId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This endpoint only supports legacy member WIG sessions." });
      }
      if (session.userId !== ctx.session.user.id)
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
              userId: ctx.session.user.id,
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

      // Validate that any linked lead measures belong to this session's WIG
      const linkedIds = input.commitments
        .map((c) => c.linkedLeadMeasureId)
        .filter((id): id is string => Boolean(id));

      if (linkedIds.length > 0) {
        const validCount = await ctx.db.leadMeasure.count({
          where: { id: { in: linkedIds }, wigId: session.wigId },
        });
        if (validCount !== linkedIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Linked lead measures must belong to this session's WIG.",
          });
        }
      }

      if (session.commitDoneAt)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Commit step already completed.",
        });

      const vagueCommitment = input.commitments.find(
        (commitment) => commitment.text.trim().split(/\s+/).filter(Boolean).length < 5,
      );

      if (vagueCommitment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Commitments must be specific. Use at least 5 words.",
        });
      }

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
        actorUserId: ctx.session.user.id,
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

      if (completedSession?.wig?.team && completedSession.user) {
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

      const sessions = await ctx.db.weeklySession.findMany({
        where: {
          userId: ctx.session.user.id,
          wig: { teamId: team.id },
          weekStarting: monday,
        },
        include: {
          commitments: true,
          wig: {
            include: {
              leadMeasures: {
                where: { archivedAt: null },
                include: {
                  activityLogs: {
                    where: { status: "APPROVED" },
                    orderBy: { loggedForDate: "desc" },
                    take: 6,
                  },
                },
              },
            },
          },
        },
      });

      const sessionsWithPriorCommitments = await Promise.all(
        sessions.map(async (session) => {
          if (!session.userId || !session.wigId) {
            return { ...session, commitments: [] };
          }
          const previousSession = await ctx.db.weeklySession.findFirst({
            where: {
              userId: session.userId,
              wigId: session.wigId,
              weekStarting: { lt: monday },
              commitDoneAt: { not: null },
            },
            orderBy: { weekStarting: "desc" },
            include: { commitments: true },
          });

          return {
            ...session,
            commitments: previousSession?.commitments ?? [],
          };
        }),
      );

      return sessionsWithPriorCommitments;
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
      if (session.userId !== ctx.session.user.id)
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

      const isTeamLead = team.leadUserId === ctx.session.user.id;
      const isOrgAdmin = await ctx.db.orgMembership.findFirst({
        where: {
          userId: ctx.session.user.id,
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
