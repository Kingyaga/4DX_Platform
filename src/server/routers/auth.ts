import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const lookup = (ctx.session.user as any).id
      ? { id: (ctx.session.user as any).id }
      : (ctx.session.user as any).email
      ? { email: (ctx.session.user as any).email }
      : null;

    if (!lookup) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Unable to identify current user.",
      });
    }

    const user = await ctx.db.user.findUnique({
      where: lookup,
      include: {
        orgMemberships: {
          select: {
            role: true,
            org: {
              select: {
                slug: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
        teamMemberships: {
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
    const hasAdminRole = user.orgMemberships.some((membership) => membership.role === "ADMIN");
    const hasTeamLeadRoleFromMembership = user.teamMemberships.some((membership) => membership.role === "LEAD");

    const isTeamLeadViaLeadUserId = await ctx.db.team.findFirst({
      where: { leadUserId: user.id },
      select: { id: true },
    });

    const hasTeamLeadRole = hasTeamLeadRoleFromMembership || Boolean(isTeamLeadViaLeadUserId);

    const orgRole = hasAdminRole
      ? "ADMIN"
      : hasTeamLeadRole
      ? "TEAM_LEAD"
      : "MEMBER";

    const orgSlug = user.orgMemberships[0]?.org?.slug || null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: orgRole,
      orgSlug,
    };
  }),

  signup: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        token: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
          message: "Invite token is invalid.",
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

      const normalizedEmail = input.email.toLowerCase();

      if (invite.email && invite.email.toLowerCase() !== normalizedEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Signup email must match invite email.",
        });
      }

      const existing = await ctx.db.user.findUnique({
        where: { email: normalizedEmail },
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
          email: normalizedEmail,
          passwordHash,
        },
      });

      await ctx.db.orgMembership.create({
        data: {
          userId: user.id,
          orgId: invite.orgId,
          role: "MEMBER",
        },
      });

      if (invite.teamId) {
        await ctx.db.teamMembership.create({
          data: {
            userId: user.id,
            teamId: invite.teamId,
            role: "MEMBER",
          },
        });
      }

      await ctx.db.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      return { id: user.id, email: user.email };
    }),
  adminCreateUser: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        orgSlug: z.string().min(1),
        teamSlug: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actorUserId = (ctx.session.user as any).id;

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
          message: "Only organization admins can create users.",
        });
      }

      const normalizedEmail = input.email.toLowerCase();

      const existing = await ctx.db.user.findUnique({
        where: { email: normalizedEmail },
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
          email: normalizedEmail,
          passwordHash,
        },
      });

      await ctx.db.orgMembership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: "MEMBER",
        },
      });

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

        await ctx.db.teamMembership.create({
          data: {
            userId: user.id,
            teamId: team.id,
            role: "MEMBER",
          },
        });
      }

      return { id: user.id, email: user.email };
    }),

  getAllUsers: protectedProcedure
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
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only organization admins can view users.",
        });
      }

      return ctx.db.user.findMany({
        where: {
          orgMemberships: {
            some: {
              orgId: org.id,
            },
          },
        },
        include: {
          orgMemberships: {
            select: {
              role: true,
              org: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          teamMemberships: {
            include: {
              team: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      });
    }),

  deleteUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userToDelete = await ctx.db.user.findUnique({
        where: { id: input.userId },
        include: {
          orgMemberships: true,
        },
      });

      if (!userToDelete) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      const orgId = userToDelete.orgMemberships[0]?.orgId;
      if (!orgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User does not belong to an organization." });
      }

      const org = await ctx.db.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found." });
      }

      const requesterMembership = await ctx.db.orgMembership.findUnique({
        where: {
          userId_orgId: {
            userId: (ctx.session.user as any).id,
            orgId: org.id,
          },
        },
      });

      if (!requesterMembership || requesterMembership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only organization admins can delete users.",
        });
      }

      if (input.userId === (ctx.session.user as any).id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Admins cannot delete their own account from this panel.",
        });
      }

      await ctx.db.$transaction([
        ctx.db.activityLog.deleteMany({
          where: { userId: input.userId },
        }),
        ctx.db.weeklySession.deleteMany({
          where: { userId: input.userId },
        }),
        ctx.db.leadMeasureOwner.deleteMany({
          where: { userId: input.userId },
        }),
        ctx.db.teamMembership.deleteMany({
          where: { userId: input.userId },
        }),
        ctx.db.orgMembership.deleteMany({
          where: { userId: input.userId },
        }),
        ctx.db.user.delete({
          where: { id: input.userId },
        }),
      ]);

      return { success: true };
    }),
});
