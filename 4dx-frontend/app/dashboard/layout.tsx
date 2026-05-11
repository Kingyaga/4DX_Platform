"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useCurrentUser, useMyTeams } from "@/lib/hooks";
import { useUserStore } from "@/lib/stores/user-store";
import { useTeamStore } from "@/lib/stores/team-store";

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  
  // Fetch current user profile with role from backend
  useCurrentUser();
  
  const { userRole, clearUser, orgSlug } = useUserStore();
  const { currentTeamSlug, setCurrentTeamSlug } = useTeamStore();
  const { teams, isLoading: teamsLoading } = useMyTeams(orgSlug);

  // Auto-select first team if none selected yet
  useEffect(() => {
    if (!currentTeamSlug && !teamsLoading && teams.length > 0) {
      setCurrentTeamSlug(teams[0]?.slug || null);
    }
  }, [currentTeamSlug, teamsLoading, teams, setCurrentTeamSlug]);

  // Debug logging
  console.log("Dashboard layout - userRole:", userRole);
  console.log("Dashboard layout - pathname:", pathname);

  // Clear user store if session is lost
  useEffect(() => {
    if (status === "unauthenticated") {
      clearUser();
      router.push("/login");
    }
  }, [status, clearUser, router]);

  // Redirect to appropriate dashboard based on role
  useEffect(() => {
    if (pathname === "/dashboard" && userRole) {
      if (userRole === "ADMIN") {
        router.push("/dashboard/admin");
      } else if (userRole === "TEAM_LEAD") {
        router.push("/dashboard/team-lead");
      } else if (userRole === "MEMBER") {
        router.push("/dashboard/scoreboard");
      }
    }
  }, [pathname, userRole, router]);

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
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
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
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Settings */}
        <div style={{ borderTop: "1px solid #e4e4e7" }}>
          <Link
            href="/dashboard/settings"
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