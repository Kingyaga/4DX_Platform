import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import { type JWT } from "next-auth/jwt";
import { type Session } from "next-auth";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { checkBooleanRateLimit, getRequestIp } from "./rateLimit";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function validateAzureInviteOnly(
  database: Pick<typeof db, "user" | "invite">,
  email: string,
) {
  const normalizedEmail = email.toLowerCase();
  const existingUser = await database.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existingUser) return true;

  const invite = await database.invite.findFirst({
    where: { email: normalizedEmail, usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });

  if (!invite) {
    throw new Error("AccessDenied");
  }

  return true;
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

      if (!user.passwordHash) {
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

if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID) {
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  jwt: {
    maxAge: 28800,
  },
  callbacks: {
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
      if (token.id) {
        const membership = await db.orgMembership.findFirst({
          where: { userId: token.id as string },
          select: { orgId: true, role: true },
        });
        if (membership) {
          token.orgId = membership.orgId;
          token.role = membership.role;
        }
      }
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user = {
          ...session.user,
          id: token.id as string,
          orgId: token.orgId as string,
          role: token.role as string,
        } as Session["user"];
      }
      return session;
    },
    async signIn({ account, profile }) {
      if (account?.provider === "azure-ad") {
        const email = profile?.email?.toLowerCase();
        if (!email) return false;

        await validateAzureInviteOnly(db, email);
      }

      return true;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
