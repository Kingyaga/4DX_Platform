import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    // Return current user with their org role
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        orgMemberships: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Get the first org role (users should only have one org for now)
    const orgRole = user.orgMemberships[0]?.role || "MEMBER";

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: orgRole,
    };
  }),

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
});
