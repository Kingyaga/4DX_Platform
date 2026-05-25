import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { notifyMany } from "../notify";
import { auditLog } from "../audit";
import { sendLeadMeasureOwnersChangedEmail } from "../email";

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
        ownerUserIds: z.array(z.string()).min(1).max(10),
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

      if (wig.team.leadUserId !== (ctx.session.user as any).id) {
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
          userId: (ctx.session.user as any).id,
          orgId: wig.team.orgId,
          role: "ADMIN",
        },
      });

      if (isOrgAdmin && wig.team.leadUserId !== (ctx.session.user as any).id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Org admins cannot create lead measures. This is a team lead action.",
        });
      }

      const uniqueOwnerUserIds = [...new Set(input.ownerUserIds)];
      const teamOwners = await ctx.db.teamMembership.findMany({
        where: {
          teamId: wig.team.id,
          userId: { in: uniqueOwnerUserIds },
        },
        select: { userId: true },
      });

      if (teamOwners.length !== uniqueOwnerUserIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lead measure owners must be members of this team.",
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
          owners: {
            create: uniqueOwnerUserIds.map((userId) => ({ userId })),
          },
        },
        include: {
          owners: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          activityLogs: true,
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

      if (leadMeasure.wig.team.leadUserId !== (ctx.session.user as any).id) {
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

  updateOwners: protectedProcedure
    .input(
      z.object({
        leadMeasureId: z.string(),
        ownerUserIds: z.array(z.string()).min(1).max(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const leadMeasure = await ctx.db.leadMeasure.findUnique({
        where: { id: input.leadMeasureId },
        include: {
          wig: { include: { team: { include: { org: true } } } },
          owners: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      });

      if (!leadMeasure) throw new TRPCError({ code: "NOT_FOUND" });

      if (leadMeasure.wig.team.leadUserId !== (ctx.session.user as any).id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can change lead measure owners.",
        });
      }

      const uniqueOwnerUserIds = [...new Set(input.ownerUserIds)];
      const teamMembers = await ctx.db.teamMembership.findMany({
        where: { teamId: leadMeasure.wig.team.id, userId: { in: uniqueOwnerUserIds } },
        select: { userId: true },
      });

      if (teamMembers.length !== uniqueOwnerUserIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All owners must be members of this team.",
        });
      }

      // Delete existing owners and recreate
      await ctx.db.leadMeasureOwner.deleteMany({
        where: { leadMeasureId: input.leadMeasureId },
      });

      const updated = await ctx.db.leadMeasure.update({
        where: { id: input.leadMeasureId },
        data: {
          owners: {
            create: uniqueOwnerUserIds.map((userId) => ({ userId })),
          },
        },
        include: {
          owners: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      // Notify new owners
      const previousOwnerIds = leadMeasure.owners.map((o) => o.userId);
      const addedOwnerIds = uniqueOwnerUserIds.filter((id) => !previousOwnerIds.includes(id));
      const removedOwnerIds = previousOwnerIds.filter((id) => !uniqueOwnerUserIds.includes(id));

      if (addedOwnerIds.length > 0) {
        await notifyMany({
          db: ctx.db,
          userIds: addedOwnerIds,
          type: "LEAD_MEASURE_OWNER_ADDED",
          payload: { leadMeasureName: leadMeasure.name, wigTitle: leadMeasure.wig.title },
        });
        const addedUsers = updated.owners.filter((o) => addedOwnerIds.includes(o.userId));
        for (const owner of addedUsers) {
          sendLeadMeasureOwnersChangedEmail({
            to: owner.user.email,
            name: owner.user.name || owner.user.email,
            leadMeasureName: leadMeasure.name,
            wigTitle: leadMeasure.wig.title,
            action: "added",
          }).catch(() => {});
        }
      }

      if (removedOwnerIds.length > 0) {
        await notifyMany({
          db: ctx.db,
          userIds: removedOwnerIds,
          type: "LEAD_MEASURE_OWNER_REMOVED",
          payload: { leadMeasureName: leadMeasure.name, wigTitle: leadMeasure.wig.title },
        });
        const removedUsers = leadMeasure.owners.filter((o) => removedOwnerIds.includes(o.userId));
        for (const owner of removedUsers) {
          sendLeadMeasureOwnersChangedEmail({
            to: owner.user.email,
            name: owner.user.name || owner.user.email,
            leadMeasureName: leadMeasure.name,
            wigTitle: leadMeasure.wig.title,
            action: "removed",
          }).catch(() => {});
        }
      }

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "LEAD_MEASURE",
        entityId: input.leadMeasureId,
        action: "LEAD_MEASURE_OWNERS_UPDATED",
        before: { ownerIds: previousOwnerIds },
        after: { ownerIds: uniqueOwnerUserIds },
      });

      return updated;
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

      if (leadMeasure.wig.team.leadUserId !== (ctx.session.user as any).id) {
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
