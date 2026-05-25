import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../audit";
import { notify, notifyMany } from "../notify";
import { sendActivityApprovedEmail, sendActivityDeclinedEmail, sendWigClosedEmail } from "../email";
import { getNextWigCompletionState } from "../wigCompletion";

const CLOSED_WIG_STATUSES = ["ACHIEVED", "MISSED", "ABANDONED"] as const;

async function getLeadMeasureTotal(
  db: Pick<Prisma.TransactionClient, "activityLog">,
  leadMeasureId: string,
) {
  const aggregate = await db.activityLog.aggregate({
    where: { leadMeasureId, status: "APPROVED" },
    _sum: { value: true },
  });

  return aggregate._sum.value ?? 0;
}

async function getNextWigState(
  db: Pick<Prisma.TransactionClient, "wIG" | "activityLog">,
  wigId: string,
) {
  const wig = await db.wIG.findUnique({
    where: { id: wigId },
    include: {
      leadMeasures: {
        where: { archivedAt: null },
        include: {
          activityLogs: {
            where: { status: "APPROVED" },
            select: { value: true },
          },
        },
      },
    },
  });

  if (!wig) throw new TRPCError({ code: "NOT_FOUND", message: "WIG not found." });

  return getNextWigCompletionState(wig);
}

async function notifyWigAutoClosed(
  db: Pick<Prisma.TransactionClient, "wIG" | "notification">,
  wigId: string,
) {
  const wig = await db.wIG.findUnique({
    where: { id: wigId },
    include: {
      team: {
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!wig) return;

  const memberUserIds = wig.team.members.map((member) => member.userId);
  if (memberUserIds.length === 0) return;

  await db.notification.createMany({
    data: memberUserIds.map((userId) => ({
      userId,
      type: "WIG_CLOSED",
      payloadJson: {
        wigTitle: wig.title,
        status: "ACHIEVED",
        reason: "All lead measures were completed.",
      },
    })),
  });

  for (const member of wig.team.members) {
    sendWigClosedEmail({
      to: member.user.email,
      name: member.user.name || member.user.email,
      wigTitle: wig.title,
      status: "ACHIEVED",
    }).catch(() => {});
  }
}

export const activityLogsRouter = router({
  // Log activity for a lead measure
  log: protectedProcedure
    .input(
      z.object({
        leadMeasureId: z.string(),
        value: z.number(),
        loggedForDate: z.coerce.date(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the lead measure exists and get team info
      const leadMeasure = await ctx.db.leadMeasure.findUnique({
        where: { id: input.leadMeasureId },
        include: {
          owners: true,
          wig: { include: { team: true } },
        },
      });

      if (!leadMeasure) throw new TRPCError({ code: "NOT_FOUND" });

      if (CLOSED_WIG_STATUSES.includes(leadMeasure.wig.status as any)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This WIG is closed. Create or select an active WIG before logging activity.",
        });
      }

      const currentTotal = await getLeadMeasureTotal(ctx.db, leadMeasure.id);
      if (currentTotal >= leadMeasure.targetValue) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This lead measure is already complete and no longer accepts activity logs.",
        });
      }

      // Verify user is a team member — admins cannot log activity
      const teamMembership = await ctx.db.teamMembership.findUnique({
        where: {
          userId_teamId: {
            userId: (ctx.session.user as any).id,
            teamId: leadMeasure.wig.team.id,
          },
        },
      });

      if (!teamMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be a team member to log activity.",
        });
      }

      const isOwner = leadMeasure.owners.some(
        (owner) => owner.userId === (ctx.session.user as any).id,
      );

      if (!isOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only log activity against lead measures you own.",
        });
      }

      const createdLog = await ctx.db.activityLog.create({
        data: {
          leadMeasureId: input.leadMeasureId,
          value: input.value,
          loggedForDate: input.loggedForDate,
          note: input.note,
          status: "PENDING",
          userId: (ctx.session.user as any).id,
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "ACTIVITY_LOG",
        entityId: createdLog.id,
        action: "ACTIVITY_LOGGED",
        after: {
          leadMeasureId: createdLog.leadMeasureId,
          value: createdLog.value,
          loggedForDate: createdLog.loggedForDate,
          note: createdLog.note,
        },
      });

      return createdLog;
    }),

  approve: protectedProcedure
    .input(z.object({ logId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const log = await ctx.db.activityLog.findUnique({
        where: { id: input.logId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          leadMeasure: {
            include: {
              wig: {
                include: { team: true },
              },
            },
          },
        },
      });

      if (!log) throw new TRPCError({ code: "NOT_FOUND" });

      if (log.leadMeasure.wig.team.leadUserId !== (ctx.session.user as any).id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can approve activity requests.",
        });
      }

      if (log.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending activity requests can be approved.",
        });
      }

      const wig = log.leadMeasure.wig;
      if (CLOSED_WIG_STATUSES.includes(wig.status as any)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This WIG is already closed.",
        });
      }

      const { updatedLog, updatedWIG } = await ctx.db.$transaction(async (tx) => {
        const updatedLog = await tx.activityLog.update({
          where: { id: input.logId },
          data: { status: "APPROVED" },
        });

        const nextWig = await getNextWigState(tx, wig.id);
        const updatedWIG = await tx.wIG.update({
          where: { id: wig.id },
          data: {
            currentValue: nextWig.currentValue,
            status: nextWig.status as any,
            closedAt: nextWig.closedAt,
          },
        });

        return { updatedLog, updatedWIG };
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "ACTIVITY_LOG",
        entityId: input.logId,
        action: "ACTIVITY_APPROVED",
        before: {
          status: log.status,
          wigCurrentValue: wig.currentValue,
          wigStatus: wig.status,
          wigClosedAt: wig.closedAt,
        } as Prisma.InputJsonValue,
        after: {
          status: updatedLog.status,
          wigCurrentValue: updatedWIG.currentValue,
          wigStatus: updatedWIG.status,
          wigClosedAt: updatedWIG.closedAt,
        } as Prisma.InputJsonValue,
      });

      await notify({
        db: ctx.db,
        userId: log.userId,
        type: "ACTIVITY_APPROVED",
        payload: {
          leadMeasureName: log.leadMeasure.name,
          value: log.value,
          wigTitle: log.leadMeasure.wig.title,
        },
      });

      sendActivityApprovedEmail({
        to: log.user.email,
        name: log.user.name || log.user.email,
        leadMeasureName: log.leadMeasure.name,
        value: log.value,
        unit: log.leadMeasure.wig.unit ?? "",
      }).catch(() => {});

      if (updatedWIG.status === "ACHIEVED" && wig.status !== "ACHIEVED") {
        await notifyWigAutoClosed(ctx.db, wig.id);
      }

      return updatedLog;
    }),

  approveAllForTeam: protectedProcedure
    .input(z.object({ teamSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        select: { id: true, leadUserId: true },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });

      if (team.leadUserId !== (ctx.session.user as any).id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can approve activity requests.",
        });
      }

      const pendingLogs = await ctx.db.activityLog.findMany({
        where: {
          status: "PENDING",
          leadMeasure: { wig: { teamId: team.id, status: "ACTIVE" } },
        },
        include: {
          leadMeasure: {
            include: {
              wig: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const affectedUserIds = Array.from(new Set(pendingLogs.map((log) => log.userId)));
      let approvedCount = 0;
      const autoClosedWigIds = new Set<string>();

      await ctx.db.$transaction(async (tx) => {
        const affectedWigIds = new Set<string>();

        for (const log of pendingLogs) {
          const wig = await tx.wIG.findUnique({
            where: { id: log.leadMeasure.wig.id },
            select: { id: true, status: true },
          });

          if (!wig || CLOSED_WIG_STATUSES.includes(wig.status as any)) {
            continue;
          }

          await tx.activityLog.update({
            where: { id: log.id },
            data: { status: "APPROVED" },
          });

          affectedWigIds.add(wig.id);
          approvedCount += 1;
        }

        for (const wigId of affectedWigIds) {
          const nextWig = await getNextWigState(tx, wigId);

          await tx.wIG.update({
            where: { id: wigId },
            data: {
              currentValue: nextWig.currentValue,
              status: nextWig.status as any,
              closedAt: nextWig.closedAt,
            },
          });

          if (nextWig.achieved) {
            autoClosedWigIds.add(wigId);
          }
        }
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "TEAM_ACTIVITY_APPROVAL",
        entityId: team.id,
        action: "ACTIVITY_APPROVED_BULK",
        after: {
          teamSlug: input.teamSlug,
          approvedCount,
          autoClosedWigIds: Array.from(autoClosedWigIds),
        },
      });

      if (affectedUserIds.length > 0) {
        await notifyMany({
          db: ctx.db,
          userIds: affectedUserIds,
          type: "ACTIVITY_APPROVED",
          payload: { message: "Your pending activity logs have been approved." },
        });
      }

      for (const wigId of autoClosedWigIds) {
        await notifyWigAutoClosed(ctx.db, wigId);
      }

      return { count: approvedCount };
    }),

  decline: protectedProcedure
    .input(z.object({ logId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const log = await ctx.db.activityLog.findUnique({
        where: { id: input.logId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          leadMeasure: {
            include: {
              wig: {
                include: { team: true },
              },
            },
          },
        },
      });

      if (!log) throw new TRPCError({ code: "NOT_FOUND" });

      if (log.leadMeasure.wig.team.leadUserId !== (ctx.session.user as any).id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can decline activity requests.",
        });
      }

      // Note: this system only declines PENDING logs, so currentValue does not need
      // to be re-aggregated here. If a previously APPROVED log could be declined in
      // future, re-aggregation would be required (same pattern as approve).
      const declined = await ctx.db.activityLog.update({
        where: { id: input.logId },
        data: { status: "REJECTED" },
      });

      await notify({
        db: ctx.db,
        userId: log.userId,
        type: "ACTIVITY_DECLINED",
        payload: {
          leadMeasureName: log.leadMeasure.name,
          value: log.value,
          wigTitle: log.leadMeasure.wig.title,
        },
      });

      sendActivityDeclinedEmail({
        to: log.user.email,
        name: log.user.name || log.user.email,
        leadMeasureName: log.leadMeasure.name,
        value: log.value,
      }).catch(() => {});

      return declined;
    }),

  getPendingForTeam: protectedProcedure
    .input(z.object({ teamSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.activityLog.findMany({
        where: {
          status: "PENDING",
          leadMeasure: {
            wig: {
              team: {
                slug: input.teamSlug,
                leadUserId: (ctx.session.user as any).id,
              },
            },
          },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          leadMeasure: {
            select: {
              id: true,
              name: true,
              unit: true,
              wig: {
                select: { title: true, unit: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Edit an activity log — only within 24 hours
  edit: protectedProcedure
    .input(
      z.object({
        logId: z.string(),
        value: z.number(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const log = await ctx.db.activityLog.findUnique({
        where: { id: input.logId },
      });

      if (!log) throw new TRPCError({ code: "NOT_FOUND" });

      if (log.userId !== (ctx.session.user as any).id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only edit your own logs.",
        });
      }

      // Enforce the 24-hour immutability rule from the PRD
      const hoursSinceCreation =
        (Date.now() - log.createdAt.getTime()) / 1000 / 60 / 60;

      if (hoursSinceCreation > 24) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Activity logs can only be edited within 24 hours of creation.",
        });
      }

      const updatedLog = await ctx.db.activityLog.update({
        where: { id: input.logId },
        data: {
          value: input.value,
          note: input.note,
          editedAt: new Date(),
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "ACTIVITY_LOG",
        entityId: input.logId,
        action: "ACTIVITY_EDITED",
        before: {
          value: log.value,
          note: log.note,
        } as Prisma.InputJsonValue,
        after: {
          value: updatedLog.value,
          note: updatedLog.note,
        } as Prisma.InputJsonValue,
      });

      return updatedLog;
    }),

  // Get all activity logs for a lead measure
  getByLeadMeasure: protectedProcedure
    .input(z.object({ leadMeasureId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.activityLog.findMany({
        where: { leadMeasureId: input.leadMeasureId, status: "APPROVED" },
        orderBy: { loggedForDate: "desc" },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      });
    }),

  // Get all activity logs by a specific user
  getByUser: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        leadMeasureId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const currentUserId = (ctx.session.user as any).id;
      const targetUserId = input.userId ?? currentUserId;

      if (targetUserId !== currentUserId) {
        const authorizedMember = await ctx.db.teamMembership.findFirst({
          where: {
            userId: targetUserId,
            team: {
              leadUserId: currentUserId,
            },
          },
        });

        if (!authorizedMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not authorized to view this member's activity history.",
          });
        }
      }

      return ctx.db.activityLog.findMany({
        where: {
          userId: targetUserId,
          ...(input.leadMeasureId ? { leadMeasureId: input.leadMeasureId } : {}),
        },
        orderBy: { loggedForDate: "desc" },
        include: {
          leadMeasure: {
            select: { id: true, name: true, unit: true },
          },
        },
      });
    }),
});
