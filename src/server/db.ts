import { createPrismaClient } from "./prisma-client";

export function getDb() {
  return createPrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });
}

export const db = getDb();
