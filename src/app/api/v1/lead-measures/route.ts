import { type NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireAuth } from "@/server/apiAuth";
import { apiSuccess, apiError } from "@/server/apiResponse";

// GET /api/v1/lead-measures?wigId=xxx
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authorized) {
    return apiError("UNAUTHORIZED", "You must be logged in.", 401);
  }

  const wigId = req.nextUrl.searchParams.get("wigId");
  if (!wigId) {
    return apiError("BAD_REQUEST", "wigId query parameter is required.", 400);
  }

  const wig = await db.wIG.findUnique({
    where: { id: wigId },
  });

  if (!wig) {
    return apiError("NOT_FOUND", "WIG not found.", 404);
  }

  const leadMeasures = await db.leadMeasure.findMany({
    where: {
      wigId,
      archivedAt: null,
    },
    include: {
      owners: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      activityLogs: {
        orderBy: { loggedForDate: "desc" },
        take: 10,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess(leadMeasures);
}
