import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "./db";
import { type NextRequest } from "next/server";

export async function createContext(req: NextRequest) {
  const session = await getServerSession(authOptions);
  return {
    db,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
