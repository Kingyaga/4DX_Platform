import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { type JWT } from "next-auth/jwt";
import { type Session } from "next-auth";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { checkBooleanRateLimit, getRequestIp } from "./rateLimit";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export const authOptions: NextAuthOptions = {
  providers,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
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
