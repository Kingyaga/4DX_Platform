import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const leadMeasuresRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        wigId: z.string(),
        name: z.string().min(3),
        description: z.string().optional(),
        cadence: z.enum(["WEEKLY", "BIWEEKLY"]),
        targetValue: z.number(),
        unit: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wig = await ctx.db.wIG.findUnique({
        where: { id: input.wigId },
        include: {
          team: true,
          leadMeasures: { where: { archivedAt: null } },
        },
      });

      if (!wig) throw new TRPCError({ code: "NOT_FOUND" });

      if (wig.team.leadUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can add lead measures.",
        });
      }

      if (wig.leadMeasures.length >= 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A WIG can have a maximum of 3 lead measures.",
        });
      }
      const isOrgAdmin = await ctx.db.orgMembership.findFirst({
        where: {
          userId: ctx.session.user.id,
          orgId: wig.team.orgId,
          role: "ADMIN",
        },
      });

      if (isOrgAdmin && wig.team.leadUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Org admins cannot create lead measures. This is a team lead action.",
        });
      }

      return ctx.db.leadMeasure.create({
        data: {
          wigId: input.wigId,
          name: input.name,
          description: input.description,
          cadence: input.cadence,
          targetValue: input.targetValue,
          unit: input.unit,
        },
      });
    }),

  getByWig: protectedProcedure
    .input(z.object({ wigId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.leadMeasure.findMany({
        where: { wigId: input.wigId, archivedAt: null },
        include: { owners: { include: { user: true } } },
      });
    }),
  // Update a lead measure — Team Lead only
  update: protectedProcedure
    .input(
      z.object({
        leadMeasureId: z.string(),
        name: z.string().min(3).optional(),
        description: z.string().optional(),
        cadence: z.enum(["WEEKLY", "BIWEEKLY"]).optional(),
        targetValue: z.number().optional(),
        unit: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const leadMeasure = await ctx.db.leadMeasure.findUnique({
        where: { id: input.leadMeasureId },
        include: { wig: { include: { team: true } } },
      });

      if (!leadMeasure) throw new TRPCError({ code: "NOT_FOUND" });

      if (leadMeasure.wig.team.leadUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can update lead measures.",
        });
      }

      const { leadMeasureId, ...updateData } = input;

      return ctx.db.leadMeasure.update({
        where: { id: leadMeasureId },
        data: updateData,
      });
    }),

  // Archive a lead measure — preserves all history
  archive: protectedProcedure
    .input(z.object({ leadMeasureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const leadMeasure = await ctx.db.leadMeasure.findUnique({
        where: { id: input.leadMeasureId },
        include: { wig: { include: { team: true } } },
      });

      if (!leadMeasure) throw new TRPCError({ code: "NOT_FOUND" });

      if (leadMeasure.wig.team.leadUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can archive lead measures.",
        });
      }

      if (leadMeasure.archivedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lead measure is already archived.",
        });
      }

      return ctx.db.leadMeasure.update({
        where: { id: input.leadMeasureId },
        data: { archivedAt: new Date() },
      });
    }),
});
