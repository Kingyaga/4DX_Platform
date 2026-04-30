import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "./db";
import { type NextRequest } from "next/server";

export async function requireAuth(req: NextRequest) {
  // Check session cookie first (web app users)
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return {
      authorized: true as const,
      userId: (session.user as any).id as string,
      type: "session" as const,
    };
  }

  // Check API key header (future external consumers)
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const key = await db.apiKey.findUnique({
      where: { key: apiKey },
    });

    if (
      !key ||
      key.revokedAt ||
      (key.expiresAt && key.expiresAt < new Date())
    ) {
      return { authorized: false as const };
    }

    // Log when this key was last used
    await db.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      authorized: true as const,
      orgId: key.orgId,
      type: "apiKey" as const,
    };
  }

  return { authorized: false as const };
}
