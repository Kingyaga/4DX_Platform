import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "../../../../server/db";
import * as bcrypt from "bcryptjs";
import { type JWT } from "next-auth/jwt";
import { type Session } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("Authorize called with:", { email: credentials?.email });
        if (!credentials?.email || !credentials?.password) {
          console.log("Missing credentials");
          return null;
        }

        try {
          const normalizedEmail = credentials.email.toLowerCase();
          console.log("Looking up user:", normalizedEmail);

          const user = await db.user.findUnique({
            where: { email: normalizedEmail },
          });

          if (!user) {
            console.log("User not found");
            return null;
          }

          console.log("User found:", user.id);

          const passwordMatch = await bcrypt.compare(
            credentials.password,
            user.passwordHash,
          );

          console.log("Password match:", passwordMatch);

          if (!passwordMatch) {
            console.log("Password doesn't match");
            return null;
          }

          console.log("Authentication successful");
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
  ],
  session: { 
    strategy: "jwt",
    maxAge: 10 * 60, // 10 minutes
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
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
