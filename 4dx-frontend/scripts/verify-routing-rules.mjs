const DEFAULT_MEMBER_ROUTE = "/dashboard/scoreboard";
const DEFAULT_TEAM_LEAD_ROUTE = "/dashboard/team-lead";
const DEFAULT_ADMIN_ROUTE = "/dashboard/admin";

function getDefaultRouteForRole(role) {
  if (role === "ADMIN") return DEFAULT_ADMIN_ROUTE;
  if (role === "TEAM_LEAD") return DEFAULT_TEAM_LEAD_ROUTE;
  return DEFAULT_MEMBER_ROUTE;
}

function isRouteAllowedForRole(pathname, role) {
  if (!role) return true;
  if (pathname === "/dashboard/settings") return true;
  if (role === "ADMIN") return pathname.startsWith("/dashboard/admin");
  if (role === "TEAM_LEAD") return !pathname.startsWith("/dashboard/admin");
  return !pathname.startsWith("/dashboard/admin") && !pathname.startsWith("/dashboard/team-lead");
}

const cases = [
  ["ADMIN", "/dashboard/admin", true],
  ["ADMIN", "/dashboard/scoreboard", false],
  ["TEAM_LEAD", "/dashboard/team-lead", true],
  ["TEAM_LEAD", "/dashboard/scoreboard", true],
  ["TEAM_LEAD", "/dashboard/admin", false],
  ["MEMBER", "/dashboard/scoreboard", true],
  ["MEMBER", "/dashboard/team-lead", false],
  ["MEMBER", "/dashboard/admin/users", false],
  ["MEMBER", "/dashboard/settings", true],
];

for (const role of ["ADMIN", "TEAM_LEAD", "MEMBER", null]) {
  const route = getDefaultRouteForRole(role);
  if (!route.startsWith("/dashboard/")) {
    throw new Error(`Invalid default route for ${role}: ${route}`);
  }
}

for (const [role, route, expected] of cases) {
  const actual = isRouteAllowedForRole(route, role);
  if (actual !== expected) {
    throw new Error(`Route rule failed for ${role} at ${route}: expected ${expected}, got ${actual}`);
  }
}

console.log("Routing rules verified.");

