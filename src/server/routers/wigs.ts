import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../audit";

export const wigsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        title: z.string().min(3).max(200),
        fromValue: z.number(),
        toValue: z.number(),
        unit: z.string().min(1),
        deadline: z.coerce.date(),
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
      // Org admins cannot create WIGs — management only
      const isOrgAdmin = await ctx.db.orgMembership.findFirst({
        where: {
          userId: ctx.session.user.id,
          orgId: team.orgId,
          role: "ADMIN",
        },
      });

      if (isOrgAdmin && team.leadUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Org admins cannot create WIGs. This is a team lead action.",
        });
      }

      const createdWIG = await ctx.db.wIG.create({
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

      await auditLog({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        entityType: "WIG",
        entityId: createdWIG.id,
        action: "WIG_CREATED",
        after: {
          title: createdWIG.title,
          status: createdWIG.status,
          teamId: createdWIG.teamId,
        },
      });

      return createdWIG;
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

      const updatedWIG = await ctx.db.wIG.update({
        where: { id: input.wigId },
        data: {
          status: input.status,
          closedAt: new Date(),
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        entityType: "WIG",
        entityId: input.wigId,
        action: "WIG_CLOSED",
        before: {
          status: wig.status,
          closedAt: wig.closedAt,
        },
        after: {
          status: updatedWIG.status,
          closedAt: updatedWIG.closedAt,
        },
      });

      return updatedWIG;
    }),
});
