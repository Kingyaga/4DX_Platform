import "dotenv/config";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function getDatabaseUrl() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
}

const adapter = new PrismaPg(getDatabaseUrl());

type PrismaClientOptions = Omit<
  Prisma.PrismaClientOptions,
  "adapter" | "accelerateUrl"
>;

export function createPrismaClient(options?: PrismaClientOptions) {
  return new PrismaClient({
    adapter,
    ...options,
  });
}

export { PrismaClient };
