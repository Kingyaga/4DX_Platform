import { type NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { type JWT } from "next-auth/jwt";
import { type Session } from "next-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db";
import { checkBooleanRateLimit, getRequestIp } from "./rateLimit";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAllowedMicrosoftDomain() {
  return (process.env.MICROSOFT_ALLOWED_DOMAIN || process.env.COMPANY_EMAIL_DOMAIN || "").trim().toLowerCase().replace(/^@/, "");
}

function isAllowedMicrosoftEmail(email: string) {
  const allowedDomain = getAllowedMicrosoftDomain();
  return !allowedDomain || email.toLowerCase().endsWith(`@${allowedDomain}`);
}

async function provisionMicrosoftUser(user: { email?: string | null; name?: string | null }) {
  const email = user.email?.toLowerCase().trim();
  if (!email || !isAllowedMicrosoftEmail(email)) return false;

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) return true;

  const invite = await db.inviteToken.findFirst({
    where: { email, usedAt: null, expiresAt: { gt: new Date() } },
  });
  const defaultOrgSlug = process.env.MICROSOFT_DEFAULT_ORG_SLUG || process.env.DEFAULT_ORG_SLUG;
  const defaultOrg = !invite && defaultOrgSlug
    ? await db.organization.findUnique({ where: { slug: defaultOrgSlug } })
    : null;

  if (!invite && !defaultOrg) return false;

  await db.user.create({
    data: {
      email,
      name: user.name || email.split("@")[0],
      passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
      orgMemberships: {
        create: {
          orgId: invite?.orgId || defaultOrg!.id,
          role: invite?.role || "MEMBER",
        },
      },
      ...(invite?.teamId
        ? {
            teamMemberships: { create: { teamId: invite.teamId, role: "MEMBER" } },
            defaultTeamId: invite.teamId,
          }
        : {}),
    },
  });

  if (invite) {
    await db.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
  }

  return true;
}

function microsoftProvider() {
  const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || process.env.AZURE_AD_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || process.env.AZURE_AD_TENANT_ID || "common";

  if (!clientId || !clientSecret) {
    return null;
  }

  return AzureADProvider({
    clientId,
    clientSecret,
    tenantId,
  });
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials, req) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const normalizedEmail = credentials.email.toLowerCase().trim();
      if (!emailRegex.test(normalizedEmail)) {
        return null;
      }

      const ip = getRequestIp(req as Request);
      const allowed = checkBooleanRateLimit({
        key: `login:${ip}:${normalizedEmail}`,
        limit: 5,
        windowMs: 15 * 60 * 1000,
      });

      if (!allowed) {
        return null;
      }

      const user = await db.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
        },
      });

      if (!user) {
        return null;
      }

      const passwordMatch = await bcrypt.compare(
        credentials.password,
        user.passwordHash,
      );

      if (!passwordMatch) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    },
  }),
];

const azureProvider = microsoftProvider();
if (azureProvider) {
  providers.push(azureProvider);
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: "jwt",
    maxAge: 10 * 60,
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "azure-ad") return true;
      return provisionMicrosoftUser(user);
    },
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      if (!token.id && token.email) {
        const existingUser = await db.user.findUnique({
          where: { email: token.email.toLowerCase() },
          select: { id: true, name: true, email: true },
        });
        if (existingUser) {
          token.id = existingUser.id;
          token.name = existingUser.name;
          token.email = existingUser.email;
        }
      }
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user = {
          ...session.user,
          id: token.id as string,
        } as Session["user"];
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
