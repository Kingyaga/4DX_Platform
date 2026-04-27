import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const orgRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
        slug: z
          .string()
          .min(2)
          .regex(
            /^[a-z0-9-]+$/,
            "Lowercase letters, numbers, and hyphens only",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.organization.findUnique({
        where: { slug: input.slug },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slug already taken.",
        });
      }

      const org = await ctx.db.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          memberships: {
            create: {
              userId: ctx.session.user.id,
              role: "ADMIN",
            },
          },
        },
      });

      return org;
    }),

  getDashboard: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { slug: input.orgSlug },
        include: {
          teams: {
            include: {
              wigs: {
                where: { status: "ACTIVE" },
                include: { leadMeasures: true },
              },
              members: true,
            },
          },
        },
      });

      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify the requesting user is an org admin
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

      return org;
    }),
});
