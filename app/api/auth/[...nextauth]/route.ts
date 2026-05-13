import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import { db } from "@/server/db";
import bcrypt from "bcryptjs";
import { type JWT } from "next-auth/jwt";
import { type Session } from "next-auth";
import { checkBooleanRateLimit, getRequestIp } from "@/server/rateLimit";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
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

      const allowed = checkBooleanRateLimit({
        key: `login:${getRequestIp(req as any)}:${normalizedEmail}`,
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

        if (!user) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        );

        if (!isPasswordValid) return null;

        return { id: user.id, email: user.email, name: user.name };
      } catch (error) {
        console.error("Auth error:", error);
        return null;
      }
    },
  }),
];

if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  providers.push(
    AzureADProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: process.env.MICROSOFT_TENANT_ID || "common",
    }),
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: "jwt" as const,
    maxAge: 10 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "azure-ad") return true;

      const email = user.email?.toLowerCase().trim();
      if (!email) return false;

      const existingUser = await db.user.findUnique({ where: { email } });
      return Boolean(existingUser);
    },
    async jwt({ token, user }: { token: JWT; user?: any }) {
      if (user?.id) {
        token.id = user.id;
      }
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
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user = {
          ...(session.user as any),
          id: token.id as string,
        } as any;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
