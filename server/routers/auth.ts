import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendNewUserDetailsEmail, sendPasswordResetEmail } from "../email";
import { checkRateLimit, getRequestIp } from "../rateLimit";

const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(8);

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getFrontendUrl() {
  return (
    process.env.PASSWORD_RESET_BASE_URL ||
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_NEXTAUTH_URL ||
    process.env.NEXTAUTH_URL?.replace(":3001", ":3000") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function getAppLoginUrl() {
  const baseUrl = (
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_NEXTAUTH_URL ||
    process.env.NEXTAUTH_URL?.replace(":3001", ":3000") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  return `${baseUrl}/login`;
}

export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const lookup = ctx.session.user.id
      ? { id: ctx.session.user.id }
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
            team: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
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
      teamMemberships: user.teamMemberships,
      mustChangePassword: user.mustChangePassword,
    };
  }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ ctx, input }) => {
      const ip = getRequestIp(ctx.req);
      checkRateLimit({
        key: `password-reset:ip:${ip}`,
        limit: 8,
        windowMs: 15 * 60 * 1000,
      });
      checkRateLimit({
        key: `password-reset:email:${input.email}`,
        limit: 3,
        windowMs: 60 * 60 * 1000,
      });

      const user = await ctx.db.user.findUnique({ where: { email: input.email } });

      if (user) {
        const token = crypto.randomBytes(32).toString("base64url");
        const tokenHash = hashToken(token);
        await ctx.db.passwordResetToken.create({
          data: {
            tokenHash,
            userId: user.id,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });

        const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
        const emailSent = await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
        });

        if (!emailSent && process.env.NODE_ENV !== "production") {
          return {
            success: true,
            emailSent: false,
            resetUrl,
            message: "Email delivery is not configured. Use the local reset link below.",
          };
        }
      }

      return {
        success: true,
        emailSent: true,
        message: "If an account exists for that email, a reset link has been sent.",
      };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(20),
        password: passwordSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tokenHash = hashToken(input.token);
      const resetToken = await ctx.db.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link is invalid or has expired.",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      await ctx.db.$transaction([
        ctx.db.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash, mustChangePassword: false },
        }),
        ctx.db.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
        ctx.db.passwordResetToken.deleteMany({
          where: {
            userId: resetToken.userId,
            usedAt: null,
            id: { not: resetToken.id },
          },
        }),
      ]);

      return { success: true };
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: passwordSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const user = await ctx.db.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      if (!user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This account does not have a password set. Use password reset to create one.",
        });
      }

      const passwordMatch = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!passwordMatch) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Current password is incorrect.",
        });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      });

      await ctx.db.notification.create({
        data: {
          userId: user.id,
          type: "PASSWORD_CHANGED",
          payloadJson: { changedAt: new Date().toISOString() },
        },
      });

      return { success: true };
    }),

  signup: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: emailSchema,
        password: passwordSchema,
        token: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.inviteToken.findUnique({
        where: { token: input.token },
        include: {
          org: true,
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

      const normalizedEmail = input.email;

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
          mustChangePassword: true,
        },
      });

      await ctx.db.orgMembership.create({
        data: {
          userId: user.id,
          orgId: invite.orgId,
          role: invite.role,
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

      await ctx.db.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      return { id: user.id, email: user.email };
    }),
  adminCreateUser: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: emailSchema,
        password: passwordSchema,
        orgSlug: z.string().min(1),
        teamSlug: z.string().optional(),
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
          message: "Only organization admins can create users.",
        });
      }

      const normalizedEmail = input.email;

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
          mustChangePassword: true,
        },
      });

      await ctx.db.orgMembership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: "MEMBER",
        },
      });

      let assignedTeamName: string | undefined;

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

        assignedTeamName = team.name;
      }

      const emailSent = await sendNewUserDetailsEmail({
        to: user.email,
        name: user.name,
        email: user.email,
        temporaryPassword: input.password,
        orgName: org.name,
        teamName: assignedTeamName,
        loginUrl: getAppLoginUrl(),
      });

      return { id: user.id, email: user.email, emailSent };
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
            userId: ctx.session.user.id,
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
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          defaultTeamId: true,
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
            select: {
              id: true,
              role: true,
              joinedAt: true,
              userId: true,
              teamId: true,
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
            userId: ctx.session.user.id,
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

      if (input.userId === ctx.session.user.id) {
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

  // Find a user by email — for team leads to look up users before adding them
  findByEmail: protectedProcedure
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No user found with that email address.",
        });
      }

      return user;
    }),
});
