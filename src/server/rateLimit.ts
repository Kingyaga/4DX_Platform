import { TRPCError } from "@trpc/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit({
  key,
  limit,
  windowMs,
  message = "Too many attempts. Please wait a few minutes and try again.",
}: {
  key: string;
  limit: number;
  windowMs: number;
  message?: string;
}) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
  }
}

export function checkBooleanRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= limit;
}

export function getRequestIp(req?: Request | { headers?: Headers } | null) {
  const headers = req?.headers;
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers?.get("x-real-ip") || "unknown";
}
