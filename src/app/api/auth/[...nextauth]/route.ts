import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
<<<<<<< HEAD
import { db } from "../../../../server/db";
=======
import { PrismaClient } from "@prisma/client";
>>>>>>> origin/main
import bcrypt from "bcryptjs";
import { type JWT } from "next-auth/jwt";
import { type Session } from "next-auth";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

<<<<<<< HEAD
        const normalizedEmail = credentials.email.toLowerCase();

        const user = await db.user.findUnique({
          where: { email: normalizedEmail },
        });
=======
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
>>>>>>> origin/main

          if (!user) return null;

          const passwordMatch = await bcrypt.compare(
            credentials.password,
            user.passwordHash,
          );

          if (!passwordMatch) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
<<<<<<< HEAD
    session({ session, token }) {
      if (session.user) {
        session.user = {
          ...(session.user as any),
          id: token.id as string,
        } as any;
      }
=======
    session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) session.user.id = token.id as string;
>>>>>>> origin/main
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
