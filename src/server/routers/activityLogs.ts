import { z } from "zod";
import { Prisma } from "@prisma/client";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../audit";

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
        include: { wig: { include: { team: true } } },
      });

      if (!leadMeasure) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify user is a team member — admins cannot log activity
      const teamMembership = await ctx.db.teamMembership.findUnique({
        where: {
          userId_teamId: {
            userId: ctx.session.user.id,
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

      const createdLog = await ctx.db.activityLog.create({
        data: {
          leadMeasureId: input.leadMeasureId,
          value: input.value,
          loggedForDate: input.loggedForDate,
          note: input.note,
          status: "PENDING",
          userId: ctx.session.user.id,
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
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

<<<<<<< HEAD
  approve: protectedProcedure
    .input(z.object({ logId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const log = await ctx.db.activityLog.findUnique({
        where: { id: input.logId },
        include: {
          leadMeasure: {
            include: {
              wig: {
                include: {
                  team: true,
                },
              },
            },
          },
        },
      });

      if (!log) throw new TRPCError({ code: "NOT_FOUND" });

      if (log.leadMeasure.wig.team.leadUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can approve activity requests.",
        });
      }

      return ctx.db.activityLog.update({
        where: { id: input.logId },
        data: { status: "APPROVED" },
      });
    }),

  decline: protectedProcedure
    .input(z.object({ logId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const log = await ctx.db.activityLog.findUnique({
        where: { id: input.logId },
        include: {
          leadMeasure: {
            include: {
              wig: {
                include: {
                  team: true,
                },
              },
            },
          },
        },
      });

      if (!log) throw new TRPCError({ code: "NOT_FOUND" });

      if (log.leadMeasure.wig.team.leadUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can decline activity requests.",
        });
      }

      return ctx.db.activityLog.update({
        where: { id: input.logId },
        data: { status: "REJECTED" },
      });
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
                leadUserId: ctx.session.user.id,
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
              wig: {
                select: { title: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

=======
  // Edit an activity log — only within 24 hours
>>>>>>> origin/main
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

      if (log.userId !== ctx.session.user.id) {
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
        actorUserId: ctx.session.user.id,
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
      const targetUserId = input.userId ?? ctx.session.user.id;

      return ctx.db.activityLog.findMany({
        where: {
          userId: targetUserId,
          ...(input.leadMeasureId
            ? { leadMeasureId: input.leadMeasureId }
            : {}),
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
