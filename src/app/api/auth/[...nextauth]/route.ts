import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import { db } from "../../../../server/db";
import * as bcrypt from "bcryptjs";
import { type JWT } from "next-auth/jwt";
import { type Session } from "next-auth";
import { checkBooleanRateLimit, getRequestIp } from "../../../../server/rateLimit";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function microsoftProvider() {
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    return null;
  }

  return AzureADProvider({
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    tenantId: process.env.MICROSOFT_TENANT_ID || "common",
  });
}

const providers = [
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

      const ip = getRequestIp(req as any);
      const allowed = checkBooleanRateLimit({
        key: `login:${ip}:${normalizedEmail}`,
        limit: 5,
        windowMs: 15 * 60 * 1000,
      });

      if (!allowed) {
        return null;
      }

      try {
        const user = await db.user.findUnique({
          where: { email: normalizedEmail },
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
      } catch (error) {
        console.error("Auth error:", error);
        return null;
      }
    },
  }),
];

const azureProvider = microsoftProvider();
if (azureProvider) providers.push(azureProvider as any);

export const authOptions: NextAuthOptions = {
  providers,
  session: { 
    strategy: "jwt",
    maxAge: 10 * 60, // 10 minutes
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "azure-ad") return true;

      const email = user.email?.toLowerCase().trim();
      if (!email) return false;

      const existingUser = await db.user.findUnique({ where: { email } });
      return Boolean(existingUser);
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
          ...(session.user as any),
          id: token.id as string,
        } as any;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export const GET = handler;
export const POST = handler;
export const HEAD = handler;
