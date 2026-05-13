import { createPrismaClient } from "./prisma-client";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export function getDb() {
  if (process.env.NODE_ENV === "production") {
    return createPrismaClient({
      log: ["error"],
    });
  }

  // In development, reuse the Prisma client to avoid connection leaks
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient({
      log: ["error"],
    });
  }
  return globalForPrisma.prisma;
}

export const db = getDb();
