import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";
import { db } from "./db";
import { type NextRequest } from "next/server";

export async function createContext(req: NextRequest) {
  const session = await getServerSession(authOptions);
  return {
    db,
    session,
    req,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
