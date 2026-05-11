import { type NextRequest } from "next/server";
import { db } from "@/server/db";
import { requireAuth } from "@/server/apiAuth";
import { apiSuccess, apiError } from "@/server/apiResponse";

// GET /api/v1/teams?orgSlug=my-org
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.authorized) {
    return apiError("UNAUTHORIZED", "You must be logged in.", 401);
  }

  const orgSlug = req.nextUrl.searchParams.get("orgSlug");
  if (!orgSlug) {
    return apiError("BAD_REQUEST", "orgSlug query parameter is required.", 400);
  }

  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!org) {
    return apiError("NOT_FOUND", "Organization not found.", 404);
  }

  const teams = await db.team.findMany({
    where: { orgId: org.id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      wigs: {
        where: { status: "ACTIVE" },
      },
    },
    orderBy: { name: "asc" },
  });

  return apiSuccess(teams);
}
