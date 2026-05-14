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
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      // Only org admins can create invites
      const membership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: (ctx.session.user as any).id,
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
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
          createdByUserId: (ctx.session.user as any).id,
        },
      });

      // Return the full invite URL
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";
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
        },
      });

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid invite link.",
        });
      }

      if (invite.usedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite link has already been used.",
        });
      }

      if (invite.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite link has expired.",
        });
      }

      return {
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
            userId: (ctx.session.user as any).id,
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
            userId: (ctx.session.user as any).id,
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
});
