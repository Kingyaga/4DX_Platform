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

      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
      });

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
            orgId: org.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
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
        },
      });

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found.",
        });
      }

      if (invite.usedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite has already been used.",
        });
      }

      if (invite.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invite has expired.",
        });
      }

      return {
        email: invite.email,
        orgSlug: invite.org.slug,
        teamSlug: invite.team?.slug ?? null,
      };
    }),
});
