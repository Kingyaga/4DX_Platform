"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  useCurrentUser,
  useMyTeams,
  usePendingActivityRequests,
  useCurrentSessions,
  useNotificationCount,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/lib/hooks";
import { useUserStore } from "@/lib/stores/user-store";
import { useTeamStore } from "@/lib/stores/team-store";
import { LoadingSpinner } from "@/lib/components/loading-spinner";
import { getDefaultRouteForRole, getTeamRole, isRouteAllowedForRole } from "@/lib/team-routing";
import type { MyTeamsResponse } from "@/lib/types";

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
  const { isLoading: userLoading } = useCurrentUser();

  const { user, userRole, clearUser, orgSlug } = useUserStore();
  const setUserRole = useUserStore((state) => state.setUserRole);
  const { currentTeamSlug, setCurrentTeamSlug } = useTeamStore();
  const { teams, isLoading: teamsLoading } = useMyTeams(orgSlug);
  const { pendingRequests } = usePendingActivityRequests(currentTeamSlug);
  const pendingRequestCount = pendingRequests.length;

  // Notification bell
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { count: unreadCount, refetch: refetchCount } = useNotificationCount();
  const { notifications, refetch: refetchNotifs } = useNotifications();
  const { markRead } = useMarkNotificationRead();
  const { markAllRead } = useMarkAllNotificationsRead();

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  const handleMarkAllRead = async () => {
    await markAllRead();
    refetchCount();
    refetchNotifs();
  };

  const handleMarkRead = async (notifId: string) => {
    await markRead({ notificationId: notifId });
    refetchCount();
    refetchNotifs();
  };

  const { sessions: currentSessions } = useCurrentSessions(
    userRole !== "ADMIN" ? currentTeamSlug : null,
  );
  const hasPendingSession = currentSessions.some(
    (s: any) => s.status === "PENDING" || s.status === "IN_PROGRESS",
  );

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
    if (!teamsLoading && teams.length > 0 && (!currentTeamSlug || !teams.some((team: MyTeamsResponse) => team.slug === currentTeamSlug))) {
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

  // Filter nav items based on user role
  const navItems = allNavItems.filter((item) => {
    if (!item.roles) return true;
    return userRole ? item.roles.includes(userRole) : false;
  });

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
          {/* Logo + notification bell row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
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

            {/* Notification bell */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                onClick={() => setNotifOpen((o) => !o)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  color: "#71717a",
                }}
                aria-label="Notifications"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>notifications</span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "0",
                      right: "0",
                      minWidth: "16px",
                      height: "16px",
                      borderRadius: "999px",
                      backgroundColor: "#ef4444",
                      color: "#ffffff",
                      fontSize: "10px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 3px",
                    }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {notifOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "32px",
                    left: "0",
                    width: "320px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #e4e4e7",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                    zIndex: 100,
                    maxHeight: "400px",
                    overflowY: "auto",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e4e4e7" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#18181b" }}>
                      Notifications {unreadCount > 0 && `(${unreadCount})`}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#71717a", fontWeight: 600 }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ padding: "24px 16px", textAlign: "center", color: "#71717a", fontSize: "13px" }}>
                      No unread notifications
                    </div>
                  ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {notifications.map((notif: any) => (
                        <li
                          key={notif.id}
                          style={{
                            padding: "12px 16px",
                            borderBottom: "1px solid #f4f4f5",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "8px",
                            backgroundColor: "#fafafa",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: "13px", color: "#18181b", lineHeight: "1.4" }}>
                              {(notif.payloadJson as any)?.message ||
                                (notif.type === "SESSION_READY" ? "Your weekly session is ready." :
                                 notif.type === "SESSION_OVERDUE" ? "You have an overdue session." :
                                 notif.type === "WIG_CLOSED" ? `WIG closed: ${(notif.payloadJson as any)?.wigTitle || ""}` :
                                 notif.type)}
                            </p>
                            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#71717a" }}>
                              {new Date(notif.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <button
                            onClick={() => handleMarkRead(notif.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#71717a", padding: "0", flexShrink: 0 }}
                            title="Mark as read"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>check</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

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
        {hasPendingSession && pathname !== "/dashboard/session" && (
          <Link
            href="/dashboard/session"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 24px",
              backgroundColor: "#18181b",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              flexShrink: 0,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                event_available
              </span>
              Your weekly session is due — complete it before end of week.
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", opacity: 0.7, fontSize: "12px" }}>
              Start session
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            </span>
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}
