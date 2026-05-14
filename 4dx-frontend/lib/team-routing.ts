import type { MyTeamsResponse, UserRole } from "@/lib/types";

export const DEFAULT_MEMBER_ROUTE = "/dashboard/scoreboard";
export const DEFAULT_TEAM_LEAD_ROUTE = "/dashboard/team-lead";
export const DEFAULT_ADMIN_ROUTE = "/dashboard/admin";

export function getTeamRole(team?: Pick<MyTeamsResponse, "members"> | null): UserRole | null {
  if (!team) return null;
  return team.members?.[0]?.role === "LEAD" ? "TEAM_LEAD" : "MEMBER";
}

export function getDefaultRouteForRole(role: UserRole | null) {
  if (role === "ADMIN") return DEFAULT_ADMIN_ROUTE;
  if (role === "TEAM_LEAD") return DEFAULT_TEAM_LEAD_ROUTE;
  return DEFAULT_MEMBER_ROUTE;
}

export function isRouteAllowedForRole(pathname: string, role: UserRole | null) {
  if (!role) return true;
  if (pathname === "/dashboard/settings") return true;
  if (role === "ADMIN") return pathname.startsWith("/dashboard/admin");
  if (role === "TEAM_LEAD") return !pathname.startsWith("/dashboard/admin");
  return !pathname.startsWith("/dashboard/admin") && !pathname.startsWith("/dashboard/team-lead");
}

