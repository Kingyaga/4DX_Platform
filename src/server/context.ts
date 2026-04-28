import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "./db";
import { type NextRequest } from "next/server";

export async function createContext(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    return {
      db,
      session: session
        ? {
            ...session,
            user: { ...session.user, id: (session.user as any).id },
          }
        : null,
    };
  } catch (error) {
    // Auth errors are fine - not all requests need auth
    return {
      db,
      session: null,
    };
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>;
