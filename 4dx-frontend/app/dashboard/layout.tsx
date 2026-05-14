"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useCurrentUser, useMyTeams, usePendingActivityRequests } from "@/lib/hooks";
import { useUserStore } from "@/lib/stores/user-store";
import { useTeamStore } from "@/lib/stores/team-store";
import { LoadingSpinner } from "@/lib/components/loading-spinner";
import type { MyTeamsResponse, UserRole } from "@/lib/types";

interface NavItem {
  icon: string;
  label: string;
  href: string;
  roles?: ("ADMIN" | "TEAM_LEAD" | "MEMBER")[];
}

const allNavItems: NavItem[] = [
  { icon: "scoreboard", label: "Scoreboard", href: "/dashboard/scoreboard", roles: ["TEAM_LEAD", "MEMBER"] },
  { icon: "emoji_events", label: "WIGs", href: "/dashboard/wigs", roles: ["TEAM_LEAD", "MEMBER"] },
  { icon: "history", label: "Activity Log", href: "/dashboard/activity", roles: ["TEAM_LEAD", "MEMBER"] },
  { icon: "event", label: "Weekly Session", href: "/dashboard/session", roles: ["TEAM_LEAD", "MEMBER"] },
  { icon: "groups", label: "Members", href: "/dashboard/members", roles: ["TEAM_LEAD", "MEMBER"] },
  { icon: "dashboard_customize", label: "Org Dashboard", href: "/dashboard", roles: ["TEAM_LEAD"] },
  { icon: "leaderboard", label: "Team Lead Dashboard", href: "/dashboard/team-lead", roles: ["TEAM_LEAD"] },
  { icon: "pending_actions", label: "Requests", href: "/dashboard/team-lead/requests", roles: ["TEAM_LEAD"] },
  { icon: "bar_chart", label: "Team Reports", href: "/dashboard/team-lead/reports", roles: ["TEAM_LEAD"] },
  { icon: "admin_panel_settings", label: "Dashboard", href: "/dashboard/admin", roles: ["ADMIN"] },
  { icon: "groups", label: "Teams", href: "/dashboard/admin/teams", roles: ["ADMIN"] },
  { icon: "people", label: "Users", href: "/dashboard/admin/users", roles: ["ADMIN"] },
  { icon: "person_add", label: "Create User", href: "/dashboard/admin/users/new", roles: ["ADMIN"] },
  { icon: "insights", label: "Org Activity", href: "/dashboard/admin/activity", roles: ["ADMIN"] },
];

function getTeamRole(team?: MyTeamsResponse | null): UserRole | null {
  if (!team) return null;
  return team.members?.[0]?.role === "LEAD" ? "TEAM_LEAD" : "MEMBER";
}

function getDefaultRouteForRole(role: UserRole | null) {
  if (role === "ADMIN") return "/dashboard/admin";
  if (role === "TEAM_LEAD") return "/dashboard/team-lead";
  return "/dashboard/scoreboard";
}

function isRouteAllowedForRole(pathname: string, role: UserRole | null) {
  if (!role) return true;
  if (pathname === "/dashboard/settings") return true;
  if (role === "ADMIN") return pathname.startsWith("/dashboard/admin");
  if (role === "TEAM_LEAD") return !pathname.startsWith("/dashboard/admin");
  return !pathname.startsWith("/dashboard/admin") && !pathname.startsWith("/dashboard/team-lead");
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  
  // Fetch current user profile with role from backend
  const { isLoading: userLoading } = useCurrentUser();
  
  const { user, userRole, clearUser, orgSlug } = useUserStore();
  const setUserRole = useUserStore((state) => state.setUserRole);
  const { currentTeamSlug, setCurrentTeamSlug } = useTeamStore();
  const { teams, isLoading: teamsLoading } = useMyTeams(orgSlug);
  const { pendingRequests } = usePendingActivityRequests(currentTeamSlug);
  const pendingRequestCount = pendingRequests.length;

  const handleTeamChange = (nextTeamSlug: string) => {
    const nextTeam = teams.find((team: MyTeamsResponse) => team.slug === nextTeamSlug);
    const nextRole = getTeamRole(nextTeam);

    setCurrentTeamSlug(nextTeamSlug || null);

    if (nextRole) {
      setUserRole(nextRole);
      router.replace(getDefaultRouteForRole(nextRole));
      router.refresh();
    }
  };

  // Auto-select first team if none selected yet or if the selected team is no longer valid
  useEffect(() => {
    if (!teamsLoading && teams.length > 0 && (!currentTeamSlug || !teams.some((team: any) => team.slug === currentTeamSlug))) {
      setCurrentTeamSlug(teams[0]?.slug || null);
    }
  }, [currentTeamSlug, teamsLoading, teams, setCurrentTeamSlug]);

  useEffect(() => {
    if (!user || user.role === "ADMIN" || teamsLoading) return;

    const activeTeam = teams.find((team: MyTeamsResponse) => team.slug === currentTeamSlug) || teams[0];
    const activeRole = getTeamRole(activeTeam);
    if (activeRole) {
      setUserRole(activeRole);
    }
  }, [currentTeamSlug, setUserRole, teams, teamsLoading, user]);

  // Clear user store if session is lost
  useEffect(() => {
    if (status === "unauthenticated") {
      clearUser();
      router.replace("/login");
    }
  }, [status, clearUser, router]);

  // Redirect to appropriate dashboard based on role
  useEffect(() => {
    if (pathname === "/dashboard" && userRole) {
      router.replace(getDefaultRouteForRole(userRole));
      return;
    }

    if (userRole && !isRouteAllowedForRole(pathname, userRole)) {
      router.replace(getDefaultRouteForRole(userRole));
    }
  }, [pathname, userRole, router]);

  // Show loading spinner while session or user data is loading
  if (status === "loading" || userLoading || (status === "authenticated" && !userRole) || (userRole && teamsLoading)) {
    return <LoadingSpinner size="large" text="Loading dashboard..." className="min-h-screen flex items-center justify-center" />;
  }

  // Debug logging
  console.log("Dashboard layout - userRole:", userRole);
  console.log("Dashboard layout - pathname:", pathname);

  // Filter nav items based on user role
  const navItems = allNavItems.filter((item) => {
    if (!item.roles) return true;
    return userRole ? item.roles.includes(userRole) : false;
  });

  console.log("Filtered navItems:", navItems.map(item => item.label));

  const activeHref = navItems.reduce<string | null>((currentActive, item) => {
    if (pathname === item.href) {
      return item.href;
    }

    if (pathname.startsWith(`${item.href}/`)) {
      if (!currentActive || item.href.length > currentActive.length) {
        return item.href;
      }
    }

    return currentActive;
  }, null);

  const isActive = (href: string): boolean => {
    return pathname === href || activeHref === href;
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "'Inter', sans-serif",
        backgroundColor: "#f7f9fd",
      }}
    >
      <style jsx global>{`
        .click-animation {
          transition: transform 0.1s ease-in-out;
        }
        .click-animation:active {
          transform: scale(0.95);
        }
        .click-animation:hover {
          cursor: pointer;
        }
      `}</style>
      {/* Sidebar */}
      <nav
        style={{
          width: "256px",
          backgroundColor: "#ffffff",
          borderRight: "1px solid #e4e4e7",
          position: "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          paddingTop: "24px",
          paddingBottom: "24px",
          zIndex: 40,
        }}
      >
        <div
          style={{
            paddingLeft: "24px",
            paddingRight: "24px",
            marginBottom: "32px",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#18181b",
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
            }}
          >
            STRATEGY
          </h2>
          <p
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "#71717a",
              marginTop: "4px",
              textTransform: "uppercase",
            }}
          >
            Operational Discipline
          </p>
          {user?.name && (
            <p
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "#18181b",
                marginTop: "12px",
                textTransform: "none",
              }}
            >
              Welcome, {user.name}
            </p>
          )}
          {teams.length > 0 && (
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginTop: "16px",
                fontSize: "11px",
                fontWeight: 700,
                color: "#71717a",
                textTransform: "uppercase",
              }}
            >
              Active team
              <select
                value={currentTeamSlug || ""}
                onChange={(event) => handleTeamChange(event.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #d4d4d8",
                  borderRadius: "6px",
                  padding: "9px 10px",
                  backgroundColor: "#ffffff",
                  color: "#18181b",
                  fontSize: "13px",
                  fontWeight: 600,
                  textTransform: "none",
                }}
              >
                {teams.map((team: MyTeamsResponse) => {
                  const role = getTeamRole(team) === "TEAM_LEAD" ? "Lead" : "Member";
                  return (
                    <option key={team.slug} value={team.slug}>
                      {team.name} - {role}
                    </option>
                  );
                })}
              </select>
            </label>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="click-animation"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    fontSize: "12px",
                    fontWeight: isActive(item.href) ? 700 : 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: isActive(item.href) ? "#ffffff" : "#71717a",
                    backgroundColor: isActive(item.href)
                      ? "#18181b"
                      : "transparent",
                    borderRight: isActive(item.href)
                      ? "4px solid #000000"
                      : "none",
                    textDecoration: "none ",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "20px" }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {item.label}
                    {item.href === "/dashboard/team-lead/requests" && pendingRequestCount > 0 && (
                      <span
                        style={{
                          minWidth: "24px",
                          borderRadius: "999px",
                          backgroundColor: "#ef4444",
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          textAlign: "center",
                        }}
                      >
                        {pendingRequestCount}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Settings */}
        <div style={{ borderTop: "1px solid #e4e4e7" }}>
          <Link
            href="/dashboard/settings"
            className="click-animation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "16px",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color:
                pathname === "/dashboard/settings"
                  ? "#ffffff"
                  : "#71717a",
              backgroundColor:
                pathname === "/dashboard/settings"
                  ? "#18181b"
                  : "transparent",
              textDecoration: "none",
            }}
          >
            <span className="material-symbols-outlined">
              settings
            </span>
            Settings
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div
        style={{
          marginLeft: "256px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}
