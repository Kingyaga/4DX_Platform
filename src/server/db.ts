import { PrismaClient } from "@prisma/client";

export function getDb() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });
}

export const db = getDb();
