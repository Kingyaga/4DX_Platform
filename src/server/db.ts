import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function getDb() {
  if (process.env.NODE_ENV === "production") {
    return new PrismaClient({
      log: ["error"],
    });
  }

  // In development, reuse the Prisma client to avoid connection leaks
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: ["error"],
    });
  }
  return globalForPrisma.prisma;
}

export const db = getDb();
