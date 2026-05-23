import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { auditLog } from "../audit";
import { sendWigClosedEmail } from "../email";
import { notifyMany } from "../notify";

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

      if (team.leadUserId !== (ctx.session.user as any).id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can create WIGs.",
        });
      }

      // Draft WIGs do not count against the active cap; activation enforces the hard limit.
      // Org admins cannot create WIGs — management only
      const isOrgAdmin = await ctx.db.orgMembership.findFirst({
        where: {
          userId: (ctx.session.user as any).id,
          orgId: team.orgId,
          role: "ADMIN",
        },
      });

      if (isOrgAdmin && team.leadUserId !== (ctx.session.user as any).id) {
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
          status: "DRAFT",
          teamId: team.id,
          createdByUserId: (ctx.session.user as any).id,
        },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
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
      const currentUserId = (ctx.session.user as any).id;
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        select: { leadUserId: true },
      });

      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.db.wIG.findMany({
        where: { team: { slug: input.teamSlug } },
        include: {
          leadMeasures: {
            include: {
              owners: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
              activityLogs: {
                where: team.leadUserId === currentUserId
                  ? { status: "APPROVED" }
                  : { status: "APPROVED", userId: currentUserId },
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
                orderBy: { loggedForDate: "desc" },
                take: 10,
              },
            },
          },
        },
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

      if (!wig) throw new TRPCError({ code: "NOT_FOUND" });

      if (wig.team.leadUserId !== (ctx.session.user as any).id) {
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
        actorUserId: (ctx.session.user as any).id,
        entityType: "WIG",
        entityId: input.wigId,
        action: "WIG_CLOSED",
        before: {
          status: wig.status,
          closedAt: wig.closedAt,
        } as Prisma.InputJsonValue,
        after: {
          status: updatedWIG.status,
          closedAt: updatedWIG.closedAt,
        } as Prisma.InputJsonValue,
      });

      // Notify all team members about WIG closure
      const memberUserIds = wig.team.members.map((m) => m.userId);
      if (memberUserIds.length > 0) {
        await notifyMany({
          db: ctx.db,
          userIds: memberUserIds,
          type: "WIG_CLOSED",
          payload: { wigTitle: wig.title, status: input.status },
        });

        // Send email to each member
        for (const member of wig.team.members) {
          sendWigClosedEmail({
            to: member.user.email,
            name: member.user.name || member.user.email,
            wigTitle: wig.title,
            status: input.status,
          }).catch(() => {
            // Don't block on email errors
          });
        }
      }

      return updatedWIG;
    }),

  activate: protectedProcedure
    .input(z.object({ wigId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const wig = await ctx.db.wIG.findUnique({
        where: { id: input.wigId },
        include: {
          team: {
            include: {
              wigs: { where: { status: "ACTIVE" } },
            },
          },
          leadMeasures: {
            where: { archivedAt: null },
            include: { owners: true },
          },
        },
      });

      if (!wig) throw new TRPCError({ code: "NOT_FOUND" });

      if (wig.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft WIGs can be activated.",
        });
      }

      if (wig.team.leadUserId !== (ctx.session.user as any).id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can activate WIGs.",
        });
      }

      if (wig.team.wigs.length >= 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Teams cannot have more than 2 active WIGs. Close an existing WIG first.",
        });
      }

      if (wig.leadMeasures.length < 1 || wig.leadMeasures.length > 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A WIG must have 1 to 3 lead measures before activation.",
        });
      }

      const leadMeasureWithoutOwner = wig.leadMeasures.find(
        (leadMeasure) => leadMeasure.owners.length === 0,
      );

      if (leadMeasureWithoutOwner) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Every lead measure must have at least one owner before activation.",
        });
      }

      const updatedWIG = await ctx.db.wIG.update({
        where: { id: input.wigId },
        data: { status: "ACTIVE" },
      });

      await auditLog({
        db: ctx.db,
        actorUserId: (ctx.session.user as any).id,
        entityType: "WIG",
        entityId: input.wigId,
        action: "WIG_ACTIVATED",
        before: { status: wig.status } as Prisma.InputJsonValue,
        after: { status: updatedWIG.status } as Prisma.InputJsonValue,
      });

      return updatedWIG;
    }),
  // Get a single WIG by ID with full details
  getById: protectedProcedure
    .input(z.object({ wigId: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentUserId = (ctx.session.user as any).id;
      const wig = await ctx.db.wIG.findUnique({
        where: { id: input.wigId },
        include: {
          team: {
            select: { id: true, name: true, slug: true, leadUserId: true },
          },
        },
      });

      if (!wig) throw new TRPCError({ code: "NOT_FOUND" });

      const wigWithDetails = await ctx.db.wIG.findUnique({
        where: { id: input.wigId },
        include: {
          team: {
            select: { id: true, name: true, slug: true, leadUserId: true },
          },
          leadMeasures: {
            where: { archivedAt: null },
            include: {
              owners: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
              activityLogs: {
                where: wig.team.leadUserId === currentUserId
                  ? undefined
                  : { userId: currentUserId },
                orderBy: { loggedForDate: "desc" },
                take: 10,
              },
            },
          },
        },
      });

      if (!wigWithDetails) throw new TRPCError({ code: "NOT_FOUND" });
      return wigWithDetails;
    }),

  update: protectedProcedure
    .input(
      z.object({
        wigId: z.string(),
        data: z.object({
          title: z.string().min(3).max(200).optional(),
          description: z.string().optional(),
          deadline: z.date().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const wig = await ctx.db.wIG.findUnique({
        where: { id: input.wigId },
        include: { team: true },
      });

      if (!wig) throw new TRPCError({ code: "NOT_FOUND" });

      if (wig.team.leadUserId !== (ctx.session.user as any).id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead can update WIGs.",
        });
      }

      return ctx.db.wIG.update({
        where: { id: input.wigId },
        data: input.data,
      });
    }),
});
