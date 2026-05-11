<<<<<<< HEAD
import { randomUUID } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";

export const invitesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string().min(1),
        email: z.string().email().optional(),
        teamSlug: z.string().min(1).optional(),
        expiresInDays: z.number().int().min(1).max(30).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actorUserId = ctx.session.user.id;

=======
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

export const invitesRouter = router({
  // Admin generates an invite link
  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        email: z.string().email().optional(),
        teamSlug: z.string().optional(),
        expiresInDays: z.number().min(1).max(30).default(7),
      }),
    )
    .mutation(async ({ ctx, input }) => {
>>>>>>> origin/main
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

<<<<<<< HEAD
      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found.",
        });
      }

      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: actorUserId,
=======
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      // Only org admins can create invites
      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: ctx.session.user.id,
>>>>>>> origin/main
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
<<<<<<< HEAD
          message: "Only organization admins can create invites.",
        });
      }

      let teamId: string | null = null;
      if (input.teamSlug) {
        const team = await ctx.db.team.findFirst({
          where: {
            slug: input.teamSlug,
            orgId: org.id,
          },
        });

        if (!team) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Team not found for this organization.",
          });
        }

        teamId = team.id;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 7));

      const token = randomUUID();

      const invite = await ctx.db.invite.create({
        data: {
          token,
          email: input.email,
          expiresAt,
          orgId: org.id,
          teamId: teamId ?? undefined,
          invitedByUserId: actorUserId,
        },
      });

      return {
        token: invite.token,
        inviteUrl: `${FRONTEND_URL}/signup?token=${invite.token}`,
        orgSlug: org.slug,
        teamSlug: input.teamSlug ?? null,
        expiresAt: invite.expiresAt,
      };
    }),

  validate: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const invite = await ctx.db.invite.findUnique({
        where: { token: input.token },
        include: {
          org: true,
          team: true,
=======
          message: "Only org admins can create invite links.",
        });
      }

      // Get teamId if teamSlug provided
      let teamId: string | undefined;
      if (input.teamSlug) {
        const team = await ctx.db.team.findUnique({
          where: { slug: input.teamSlug },
        });
        if (!team)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Team not found.",
          });
        teamId = team.id;
      }

      // Generate a secure random token
      const token = crypto.randomBytes(32).toString("hex");

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

      const invite = await ctx.db.inviteToken.create({
        data: {
          token,
          email: input.email,
          orgId: org.id,
          teamId,
          expiresAt,
          createdByUserId: ctx.session.user.id,
        },
      });

      // Return the full invite URL
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      return {
        token: invite.token,
        inviteUrl: `${baseUrl}/signup?token=${invite.token}`,
        expiresAt: invite.expiresAt,
        email: invite.email,
      };
    }),

  // Validate a token before showing signup form
  validate: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const invite = await ctx.db.inviteToken.findUnique({
        where: { token: input.token },
        include: {
          org: { select: { id: true, name: true, slug: true } },
>>>>>>> origin/main
        },
      });

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
<<<<<<< HEAD
          message: "Invite not found.",
=======
          message: "Invalid invite link.",
>>>>>>> origin/main
        });
      }

      if (invite.usedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
<<<<<<< HEAD
          message: "This invite has already been used.",
=======
          message: "This invite link has already been used.",
>>>>>>> origin/main
        });
      }

      if (invite.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
<<<<<<< HEAD
          message: "This invite has expired.",
=======
          message: "This invite link has expired.",
>>>>>>> origin/main
        });
      }

      return {
<<<<<<< HEAD
        email: invite.email,
        orgSlug: invite.org.slug,
        teamSlug: invite.team?.slug ?? null,
      };
    }),
=======
        valid: true,
        email: invite.email,
        orgName: invite.org.name,
        orgSlug: invite.org.slug,
      };
    }),

  // Get all invites for an org — admin only
  getByOrg: protectedProcedure
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
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.inviteToken.findMany({
        where: { orgId: org.id },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Revoke an invite — admin only
  revoke: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.inviteToken.findUnique({
        where: { token: input.token },
      });

      if (!invite) throw new TRPCError({ code: "NOT_FOUND" });

      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: ctx.session.user.id,
            orgId: invite.orgId,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Mark as used to invalidate it
      return ctx.db.inviteToken.update({
        where: { token: input.token },
        data: { usedAt: new Date() },
      });
    }),
>>>>>>> origin/main
});
