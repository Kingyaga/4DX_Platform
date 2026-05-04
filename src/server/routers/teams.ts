import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const teamsRouter = router({
  // Org admin creates a team
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

      // Only org admins can create teams
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

      return ctx.db.team.create({
        data: {
          name: input.name,
          slug: input.slug,
          orgId: org.id,
          leadUserId: ctx.session.user.id,
          members: {
            create: {
              userId: ctx.session.user.id,
              role: "LEAD",
            },
          },
        },
      });
    }),

  // Add a member to a team — org admin or current team lead only
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
        include: { org: { include: { memberships: true } } },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      // Check if requester is org admin or team lead
      const isOrgAdmin = team.org.memberships.some(
        (m) => m.userId === ctx.session.user.id && m.role === "ADMIN",
      );
      const isTeamLead = team.leadUserId === ctx.session.user.id;

      if (!isOrgAdmin && !isTeamLead) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins or the team lead can add members.",
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

  // ← NEW: Assign a new team lead — org admin only
  assignTeamLead: protectedProcedure
    .input(
      z.object({
        teamSlug: z.string(),
        newLeadUserId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: {
          org: { include: { memberships: true } },
          members: true,
        },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      // Only org admins can reassign the team lead
      const isOrgAdmin = team.org.memberships.some(
        (m) => m.userId === ctx.session.user.id && m.role === "ADMIN",
      );

      if (!isOrgAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins can assign a new team lead.",
        });
      }

      // New lead must already be a member of the team
      const isMember = team.members.some(
        (m) => m.userId === input.newLeadUserId,
      );

      if (!isMember) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The new team lead must already be a member of the team.",
        });
      }

      // Step 1: Demote current lead to MEMBER
      await ctx.db.teamMembership.updateMany({
        where: {
          teamId: team.id,
          userId: team.leadUserId,
        },
        data: { role: "MEMBER" },
      });

      // Step 2: Promote new lead to LEAD
      await ctx.db.teamMembership.updateMany({
        where: {
          teamId: team.id,
          userId: input.newLeadUserId,
        },
        data: { role: "LEAD" },
      });

      // Step 3: Update the team's leadUserId
      return ctx.db.team.update({
        where: { id: team.id },
        data: { leadUserId: input.newLeadUserId },
      });
    }),

  // Get team by slug — members and lead included
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.slug },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  createdAt: true,
                },
              },
            },
          },
          wigs: {
            where: { status: "ACTIVE" },
            include: { leadMeasures: true },
          },
        },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      return team;
    }),

  // Remove a member — org admin or team lead only
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
        include: { org: { include: { memberships: true } } },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      const isOrgAdmin = team.org.memberships.some(
        (m) => m.userId === ctx.session.user.id && m.role === "ADMIN",
      );
      const isTeamLead = team.leadUserId === ctx.session.user.id;

      if (!isOrgAdmin && !isTeamLead) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only org admins or the team lead can remove members.",
        });
      }

      // Cannot remove the current team lead
      if (input.userId === team.leadUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove the team lead. Assign a new lead first.",
        });
      }

      return ctx.db.teamMembership.deleteMany({
        where: {
          teamId: team.id,
          userId: input.userId,
        },
      });
    }),
});
