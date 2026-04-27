import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const activityLogsRouter = router({
  log: protectedProcedure
    .input(
      z.object({
        leadMeasureId: z.string(),
        value: z.number(),
        loggedForDate: z.date(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.activityLog.create({
        data: {
          leadMeasureId: input.leadMeasureId,
          value: input.value,
          loggedForDate: input.loggedForDate,
          note: input.note,
          userId: ctx.session.user.id,
        },
      });
    }),

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

      return ctx.db.activityLog.update({
        where: { id: input.logId },
        data: {
          value: input.value,
          note: input.note,
          editedAt: new Date(),
        },
      });
    }),

  getByLeadMeasure: protectedProcedure
    .input(z.object({ leadMeasureId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.activityLog.findMany({
        where: { leadMeasureId: input.leadMeasureId },
        orderBy: { loggedForDate: "desc" },
        include: { user: { select: { id: true, name: true } } },
      });
    }),
});
