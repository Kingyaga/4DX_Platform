import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const wigsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        title: z.string().min(3).max(200),
        fromValue: z.number(),
        toValue: z.number(),
        unit: z.string().min(1),
        deadline: z.date(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: {
          wigs: { where: { status: "ACTIVE" } },
        },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      if (team.leadUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can create WIGs.",
        });
      }

      if (team.wigs.length >= 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Teams cannot have more than 2 active WIGs. Close an existing WIG first.",
        });
      }

      return ctx.db.wIG.create({
        data: {
          title: input.title,
          fromValue: input.fromValue,
          toValue: input.toValue,
          currentValue: input.fromValue,
          unit: input.unit,
          deadline: input.deadline,
          description: input.description,
          status: "ACTIVE",
          teamId: team.id,
          createdByUserId: ctx.session.user.id,
        },
      });
    }),

  getByTeam: protectedProcedure
    .input(z.object({ teamSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.wIG.findMany({
        where: { team: { slug: input.teamSlug } },
        include: { leadMeasures: true },
        orderBy: { createdAt: "desc" },
      });
    }),

  close: protectedProcedure
    .input(
      z.object({
        wigId: z.string(),
        status: z.enum(["ACHIEVED", "MISSED", "ABANDONED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wig = await ctx.db.wIG.findUnique({
        where: { id: input.wigId },
        include: { team: true },
      });

      if (!wig) throw new TRPCError({ code: "NOT_FOUND" });

      if (wig.team.leadUserId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.wIG.update({
        where: { id: input.wigId },
        data: {
          status: input.status,
          closedAt: new Date(),
        },
      });
    }),
});
