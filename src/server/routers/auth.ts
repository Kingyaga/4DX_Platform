import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

export const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      const user = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
        },
      });

      return { id: user.id, email: user.email };
    }),

  // Returns the current user with their org and team roles
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user?.id) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        defaultTeamId: true,
        orgMemberships: {
          select: {
            role: true,
            org: { select: { id: true, name: true, slug: true } },
          },
        },
        teamMemberships: {
          select: {
            role: true,
            team: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!user) throw new TRPCError({ code: "NOT_FOUND" });

    // Derive the top-level role for the frontend
    // If user is ADMIN in any org → role is "ADMIN"
    // If user is LEAD on any team → role is "TEAM_LEAD"
    // Otherwise → role is "MEMBER"
    const isOrgAdmin = user.orgMemberships.some((m) => m.role === "ADMIN");
    const isTeamLead = user.teamMemberships.some((m) => m.role === "LEAD");

    const derivedRole = isOrgAdmin
      ? "ADMIN"
      : isTeamLead
        ? "TEAM_LEAD"
        : "MEMBER";

    return {
      ...user,
      role: derivedRole,
    };
  }),
});
