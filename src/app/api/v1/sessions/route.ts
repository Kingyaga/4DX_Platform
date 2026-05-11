import { type NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireAuth } from "@/server/apiAuth";
import { apiSuccess, apiError } from "@/server/apiResponse";

// GET /api/v1/sessions?wigId=xxx&userId=xxx
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authorized) {
    return apiError("UNAUTHORIZED", "You must be logged in.", 401);
  }

  const wigId = req.nextUrl.searchParams.get("wigId");
  const userId = req.nextUrl.searchParams.get("userId");

  if (!wigId || !userId) {
    return apiError(
      "BAD_REQUEST",
      "Both wigId and userId query parameters are required.",
      400,
    );
  }

  const sessions = await db.weeklySession.findMany({
    where: { wigId, userId },
    include: {
      commitments: true,
      wig: {
        select: { id: true, title: true, status: true },
      },
    },
    orderBy: { weekStarting: "desc" },
  });

  return apiSuccess(sessions);
}
