import { type NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireAuth } from "@/server/apiAuth";
import { apiSuccess, apiError } from "@/server/apiResponse";

// GET /api/v1/wigs?teamSlug=engineering
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authorized) {
    return apiError("UNAUTHORIZED", "You must be logged in.", 401);
  }

  const teamSlug = req.nextUrl.searchParams.get("teamSlug");
  if (!teamSlug) {
    return apiError(
      "BAD_REQUEST",
      "teamSlug query parameter is required.",
      400,
    );
  }

  const team = await db.team.findUnique({
    where: { slug: teamSlug },
  });

  if (!team) {
    return apiError("NOT_FOUND", "Team not found.", 404);
  }

  const wigs = await db.wIG.findMany({
    where: { teamId: team.id },
    include: {
      leadMeasures: {
        where: { archivedAt: null },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(wigs);
}
