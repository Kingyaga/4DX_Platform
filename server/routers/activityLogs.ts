import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../audit";
import { notify, notifyMany } from "../notify";
import { sendActivityApprovedEmail, sendActivityDeclinedEmail } from "../email";

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

      const approved = await ctx.db.activityLog.update({
        where: { id: input.logId },
        data: { status: "APPROVED" },
      });

      // Update the WIG's currentValue by summing all approved activity logs
      // for this lead measure's WIG, so the scoreboard stays current.
      const wig = await ctx.db.wIG.findFirst({
        where: { leadMeasures: { some: { id: log.leadMeasureId } } },
        select: { id: true, fromValue: true },
      });

      if (wig) {
        const aggregate = await ctx.db.activityLog.aggregate({
          where: {
            status: "APPROVED",
            leadMeasure: { wigId: wig.id },
          },
          _sum: { value: true },
        });
        await ctx.db.wIG.update({
          where: { id: wig.id },
          data: { currentValue: wig.fromValue + (aggregate._sum.value ?? 0) },
        });
      }

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

      return approved;
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

      await ctx.db.activityLog.updateMany({
        where: {
          status: "PENDING",
          leadMeasure: { wig: { teamId: team.id } },
        },
        data: { status: "APPROVED" },
      });

      // Recompute currentValue for every active WIG on this team
      const wigs = await ctx.db.wIG.findMany({
        where: { teamId: team.id, status: "ACTIVE" },
        select: { id: true, fromValue: true },
      });

      await Promise.all(
        wigs.map(async (wig) => {
          const aggregate = await ctx.db.activityLog.aggregate({
            where: { status: "APPROVED", leadMeasure: { wigId: wig.id } },
            _sum: { value: true },
          });
          return ctx.db.wIG.update({
            where: { id: wig.id },
            data: { currentValue: wig.fromValue + (aggregate._sum.value ?? 0) },
          });
        }),
      );

      // Notify all affected members
      const affectedUsers = await ctx.db.activityLog.findMany({
        where: { status: "APPROVED", leadMeasure: { wig: { teamId: team.id } } },
        select: { userId: true },
        distinct: ["userId"],
      });
      const affectedUserIds = affectedUsers.map((u) => u.userId);
      if (affectedUserIds.length > 0) {
        await notifyMany({
          db: ctx.db,
          userIds: affectedUserIds,
          type: "ACTIVITY_APPROVED",
          payload: { message: "Your pending activity logs have been approved." },
        });
      }

      return { success: true };
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
