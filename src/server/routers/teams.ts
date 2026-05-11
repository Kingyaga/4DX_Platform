import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const teamsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        name: z.string().min(2),
        slug: z
          .string()
          .min(2)
          .regex(/^[a-z0-9-]+$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: ctx.session.user.id,
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins can create teams.",
        });
      }

      // Create team first
      const team = await ctx.db.team.create({
        data: {
          name: input.name,
          slug: input.slug,
          orgId: org.id,
          leadUserId: ctx.session.user.id,
        },
      });

      // Add creator as team lead
      await ctx.db.teamMembership.create({
        data: {
          userId: ctx.session.user.id,
          teamId: team.id,
          role: "LEAD",
        },
      });

      return team;
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        userId: z.string(),
        role: z.enum(["LEAD", "MEMBER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      const orgMembership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: ctx.session.user.id,
            orgId: team.orgId,
          },
        },
      });

      const isOrgAdmin = orgMembership?.role === "ADMIN";
      const isTeamLead = team.leadUserId === ctx.session.user.id;

      if (!isTeamLead && !isOrgAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead or organization admin can add members.",
        });
      }

      return ctx.db.teamMembership.create({
        data: {
          teamId: team.id,
          userId: input.userId,
          role: input.role,
        },
      });
    }),

  assignLead: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      const orgMembership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: ctx.session.user.id,
            orgId: team.orgId,
          },
        },
      });

      if (!orgMembership || orgMembership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only organization admins can assign a team lead.",
        });
      }

      await ctx.db.teamMembership.updateMany({
        where: { teamId: team.id, role: "LEAD" },
        data: { role: "MEMBER" },
      });

      await ctx.db.teamMembership.upsert({
        where: {
          userId_teamId: {
            userId: input.userId,
            teamId: team.id,
          },
        },
        update: { role: "LEAD" },
        create: {
          userId: input.userId,
          teamId: team.id,
          role: "LEAD",
        },
      });

      await ctx.db.team.update({
        where: { id: team.id },
        data: {
          leadUserId: input.userId,
        },
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ teamSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
      });

      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
      }

      const orgMembership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: ctx.session.user.id,
            orgId: team.orgId,
          },
        },
      });

      if (!orgMembership || orgMembership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only organization admins can delete teams.",
        });
      }

      await ctx.db.$transaction([
        ctx.db.activityLog.deleteMany({
          where: { leadMeasure: { wig: { teamId: team.id } } },
        }),
        ctx.db.commitment.deleteMany({
          where: { linkedLeadMeasure: { wig: { teamId: team.id } } },
        }),
        ctx.db.leadMeasureOwner.deleteMany({
          where: { leadMeasure: { wig: { teamId: team.id } } },
        }),
        ctx.db.leadMeasure.deleteMany({
          where: { wig: { teamId: team.id } },
        }),
        ctx.db.weeklySession.deleteMany({
          where: { wig: { teamId: team.id } },
        }),
        ctx.db.wIG.deleteMany({
          where: { teamId: team.id },
        }),
        ctx.db.teamMembership.deleteMany({
          where: { teamId: team.id },
        }),
        ctx.db.invite.deleteMany({
          where: { teamId: team.id },
        }),
        ctx.db.team.delete({
          where: { id: team.id },
        }),
      ]);

      return { success: true };
    }),

  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.slug },
        include: {
          members: { include: { user: true } },
          wigs: {
            where: { status: "ACTIVE" },
            include: { leadMeasures: true },
          },
        },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      return team;
    }),

  getMyTeams: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.team.findMany({
        where: {
          orgId: org.id,
          members: {
            some: { userId: ctx.session.user.id },
          },
        },
        include: {
          members: {
            where: { userId: ctx.session.user.id },
            select: { role: true },
          },
          wigs: {
            where: { status: "ACTIVE" },
          },
        },
      });
    }),

  getAllTeams: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: ctx.session.user.id,
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only organization admins can view all teams.",
        });
      }

      return ctx.db.team.findMany({
        where: { orgId: org.id },
        include: {
          members: {
            include: { user: true },
          },
          wigs: {
            where: { status: "ACTIVE" },
          },
        },
      });
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      // Check if user is team lead or org admin
      const isTeamLead = team.leadUserId === ctx.session.user.id;
      const orgMembership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: ctx.session.user.id,
            orgId: team.orgId,
          },
        },
      });
      const isOrgAdmin = orgMembership?.role === "ADMIN";

      if (!isTeamLead && !isOrgAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the team lead or organization admin can remove members.",
        });
      }

      // Team leads cannot remove themselves, but admins can remove team leads
      if (input.userId === ctx.session.user.id && input.userId === team.leadUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Team leads cannot remove themselves from the team.",
        });
      }

      await ctx.db.teamMembership.delete({
        where: {
          userId_teamId: {
            userId: input.userId,
            teamId: team.id,
          },
        },
      });

      return { success: true };
    }),
});
