import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../audit";
import { notify, notifyMany } from "../notify";
import { sendActivityApprovedEmail, sendActivityDeclinedEmail } from "../email";

const CLOSED_WIG_STATUSES = ["ACHIEVED", "MISSED", "ABANDONED"] as const;

function getNextWigProgress(wig: {
  currentValue: number;
  fromValue: number;
  toValue: number;
  status: string;
  closedAt: Date | null;
}, approvedValue: number) {
  const direction = wig.toValue >= wig.fromValue ? 1 : -1;
  const nextValue = wig.currentValue + approvedValue * direction;
  const reachedTarget = direction === 1
    ? nextValue >= wig.toValue
    : nextValue <= wig.toValue;

  if (!reachedTarget) {
    return {
      currentValue: nextValue,
      status: wig.status,
      closedAt: wig.closedAt,
      achieved: false,
    };
  }

  return {
    currentValue: wig.toValue,
    status: "ACHIEVED",
    closedAt: wig.closedAt ?? new Date(),
    achieved: wig.status !== "ACHIEVED",
  };
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

      const nextWig = getNextWigProgress(wig, log.value);

      const [updatedLog, updatedWIG] = await ctx.db.$transaction([
        ctx.db.activityLog.update({
          where: { id: input.logId },
          data: { status: "APPROVED" },
        }),
        ctx.db.wIG.update({
          where: { id: wig.id },
          data: {
            currentValue: nextWig.currentValue,
            status: nextWig.status as any,
            closedAt: nextWig.closedAt,
          },
        }),
      ]);

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
      const achievedWigIds = new Set<string>();

      await ctx.db.$transaction(async (tx) => {
        const progressByWig = new Map<string, {
          currentValue: number;
          fromValue: number;
          toValue: number;
          status: string;
          closedAt: Date | null;
        }>();

        for (const log of pendingLogs) {
          const wigSnapshot = progressByWig.get(log.leadMeasure.wig.id) ?? log.leadMeasure.wig;

          if (CLOSED_WIG_STATUSES.includes(wigSnapshot.status as any)) {
            continue;
          }

          const nextWig = getNextWigProgress(wigSnapshot, log.value);

          await tx.activityLog.update({
            where: { id: log.id },
            data: { status: "APPROVED" },
          });

          await tx.wIG.update({
            where: { id: log.leadMeasure.wig.id },
            data: {
              currentValue: nextWig.currentValue,
              status: nextWig.status as any,
              closedAt: nextWig.closedAt,
            },
          });

          progressByWig.set(log.leadMeasure.wig.id, {
            currentValue: nextWig.currentValue,
            fromValue: wigSnapshot.fromValue,
            toValue: wigSnapshot.toValue,
            status: nextWig.status,
            closedAt: nextWig.closedAt,
          });

          approvedCount += 1;
          if (nextWig.achieved) {
            achievedWigIds.add(log.leadMeasure.wig.id);
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
          achievedWigIds: Array.from(achievedWigIds),
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
