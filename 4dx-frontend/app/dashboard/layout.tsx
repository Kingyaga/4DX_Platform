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
  useChangePassword,
} from "@/lib/hooks";
import { useUserStore } from "@/lib/stores/user-store";
import { useTeamStore } from "@/lib/stores/team-store";
import { LoadingSpinner } from "@/lib/components/loading-spinner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OnboardingTour } from "@/lib/components/onboarding-tour";
import { getDefaultRouteForRole, getTeamRole, isRouteAllowedForRole } from "@/lib/team-routing";
import type { MyTeamsResponse } from "@/lib/types";

function getNotificationMessage(notif: any): string {
  const p = notif.payloadJson as any;
  if (p?.message) return p.message;

  switch (notif.type) {
    case "SESSION_READY":
      return `Your weekly session for ${p?.wigTitle || "your WIG"} is ready.`;
    case "SESSION_OVERDUE":
      return `Session overdue: ${p?.wigTitle || "your WIG"}. Complete it now.`;
    case "WIG_CLOSED":
      return `WIG ${p?.wigTitle || ""} was closed as ${p?.status || "unknown"}.`;
    case "ACTIVITY_APPROVED":
      return `Activity approved: ${p?.value ?? ""} ${p?.unit ?? ""} on ${p?.leadMeasureName || "a lead measure"}.`.replace(/\s{2,}/g, " ").trim();
    case "ACTIVITY_DECLINED":
      return `Activity declined on ${p?.leadMeasureName || "a lead measure"}. Check the activity log.`;
    case "WIG_DEADLINE_PASSED":
      return `WIG deadline passed: ${p?.wigTitle || "your WIG"}. Close it with an outcome.`;
    case "LEAD_MEASURE_OWNER_ADDED":
      return `You were added as owner of: ${p?.leadMeasureName || "a lead measure"}.`;
    case "LEAD_MEASURE_OWNER_REMOVED":
      return `You were removed from: ${p?.leadMeasureName || "a lead measure"}.`;
    case "WIG_AT_RISK":
      return `WIG at risk: ${p?.wigTitle || "your WIG"} is behind schedule.`;
    case "WIG_CREATED":
      return `New WIG created: "${p?.title || "a WIG"}" on team ${p?.teamName || ""}.`.trim();
    default:
      return notif.type;
  }
}

function getNotificationIcon(notif: any): string {
  switch (notif.type) {
    case "SESSION_READY":
    case "SESSION_OVERDUE":
      return "event_available";
    case "WIG_AT_RISK":
    case "WIG_DEADLINE_PASSED":
      return "priority_high";
    case "ACTIVITY_APPROVED":
      return "task_alt";
    case "ACTIVITY_DECLINED":
      return "do_not_disturb_on";
    case "LEAD_MEASURE_OWNER_ADDED":
    case "LEAD_MEASURE_OWNER_REMOVED":
      return "assignment_ind";
    case "WIG_CREATED":
    case "WIG_CLOSED":
      return "emoji_events";
    default:
      return "notifications";
  }
}

function getNotificationTone(notif: any): { background: string; color: string; border: string } {
  switch (notif.type) {
    case "SESSION_OVERDUE":
    case "WIG_AT_RISK":
    case "WIG_DEADLINE_PASSED":
      return { background: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
    case "ACTIVITY_APPROVED":
      return { background: "#f0fdf4", color: "#15803d", border: "#bbf7d0" };
    case "ACTIVITY_DECLINED":
      return { background: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
    default:
      return { background: "#eef4ff", color: "#1d4ed8", border: "#c7d8ff" };
  }
}

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
  { icon: "leaderboard", label: "Team Lead Dashboard", href: "/dashboard/team-lead", roles: ["TEAM_LEAD"] },
  { icon: "pending_actions", label: "Requests", href: "/dashboard/team-lead/requests", roles: ["TEAM_LEAD"] },
  { icon: "bar_chart", label: "Team Reports", href: "/dashboard/team-lead/reports", roles: ["TEAM_LEAD"] },
  { icon: "admin_panel_settings", label: "Dashboard", href: "/dashboard/admin", roles: ["ADMIN"] },
  { icon: "groups", label: "Teams", href: "/dashboard/admin/teams", roles: ["ADMIN"] },
  { icon: "people", label: "Users", href: "/dashboard/admin/users", roles: ["ADMIN"] },
  { icon: "mail", label: "Invites", href: "/dashboard/admin/invites", roles: ["ADMIN"] },
  { icon: "insights", label: "Org Activity", href: "/dashboard/admin/activity", roles: ["ADMIN"] },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  // Fetch current user profile with role from backend
  const { data: meData, isLoading: userLoading, refetch: refetchMe } = useCurrentUser();

  const { user, userRole, clearUser, orgSlug } = useUserStore();
  const setUserRole = useUserStore((state) => state.setUserRole);
  const { currentTeamSlug, setCurrentTeamSlug } = useTeamStore();
  const { teams, isLoading: teamsLoading } = useMyTeams(orgSlug);
  const { pendingRequests } = usePendingActivityRequests(currentTeamSlug);
  const pendingRequestCount = pendingRequests.length;

  // Force password change modal
  const mustChangePassword = (meData as any)?.mustChangePassword === true;
  const [forceNewPassword, setForceNewPassword] = useState("");
  const [forceConfirmPassword, setForceConfirmPassword] = useState("");
  const [forcePasswordError, setForcePasswordError] = useState("");
  const [forceCurrentPassword, setForceCurrentPassword] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { changePassword, isLoading: isChangingForcePassword } = useChangePassword();
  const sessionExpiresAt = session?.expires ? new Date(session.expires).getTime() : null;
  const sessionMsRemaining = sessionExpiresAt ? sessionExpiresAt - nowMs : null;
  const showSessionExpiryWarning =
    status === "authenticated" &&
    sessionMsRemaining !== null &&
    sessionMsRemaining > 0 &&
    sessionMsRemaining <= 5 * 60 * 1000;

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleForcePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setForcePasswordError("");
    if (forceNewPassword.length < 8) {
      setForcePasswordError("Password must be at least 8 characters.");
      return;
    }
    if (forceNewPassword !== forceConfirmPassword) {
      setForcePasswordError("Passwords do not match.");
      return;
    }
    try {
      await changePassword({ currentPassword: forceCurrentPassword, newPassword: forceNewPassword });
      await refetchMe();
      setForceNewPassword("");
      setForceConfirmPassword("");
      setForceCurrentPassword("");
    } catch (err: any) {
      setForcePasswordError(err?.message || "Failed to update password.");
    }
  };

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

  const replayOnboardingTour = () => {
    window.dispatchEvent(new Event("4dx:start-onboarding-tour"));
  };

  const getNavTourId = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

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
  if (status === "unauthenticated") {
    return <LoadingSpinner size="large" text="Signing out..." className="min-h-screen flex items-center justify-center" />;
  }

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

  const hasNoTeamAssignment = userRole !== "ADMIN" && !teamsLoading && teams.length === 0;

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
        @keyframes notificationPanelIn {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes notificationBadgePulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.38);
          }
          50% {
            box-shadow: 0 0 0 5px rgba(239, 68, 68, 0);
          }
        }
      `}</style>

      {/* Force password change modal */}
      {mustChangePassword && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "40px", maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#18181b", margin: "0 0 8px 0" }}>Set your password</h2>
              <p style={{ fontSize: "14px", color: "#71717a", margin: 0, lineHeight: "1.5" }}>
                Your account was created with a temporary password. Please set a new password before continuing.
              </p>
            </div>

            <form onSubmit={handleForcePasswordChange} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Temporary Password
                <input
                  type="password"
                  value={forceCurrentPassword}
                  onChange={(e) => setForceCurrentPassword(e.target.value)}
                  placeholder="Enter the password you received"
                  required
                  style={{ padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "6px", fontSize: "14px", color: "#18181b", fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                New Password
                <input
                  type="password"
                  value={forceNewPassword}
                  onChange={(e) => setForceNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  style={{ padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "6px", fontSize: "14px", color: "#18181b", fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Confirm New Password
                <input
                  type="password"
                  value={forceConfirmPassword}
                  onChange={(e) => setForceConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  required
                  style={{ padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "6px", fontSize: "14px", color: "#18181b", fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}
                />
              </label>

              {forcePasswordError && (
                <div style={{ padding: "10px 14px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "13px", color: "#dc2626" }}>
                  {forcePasswordError}
                </div>
              )}

              <button
                type="submit"
                disabled={isChangingForcePassword}
                style={{ padding: "12px", backgroundColor: isChangingForcePassword ? "#a1a1aa" : "#18181b", color: "#ffffff", border: "none", borderRadius: "6px", fontSize: "14px", fontWeight: 700, cursor: isChangingForcePassword ? "not-allowed" : "pointer", marginTop: "8px" }}
              >
                {isChangingForcePassword ? "Updating…" : "Set New Password & Continue"}
              </button>
            </form>
          </div>
        </div>
      )}

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
            <div data-tour="brand">
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
            <div ref={notifRef} data-tour="notifications" style={{ position: "relative" }}>
              <button
                onClick={() => setNotifOpen((o) => !o)}
                style={{
                  background: notifOpen ? "#f4f6fb" : "#ffffff",
                  border: "1px solid #e4e4e7",
                  borderRadius: "8px",
                  cursor: "pointer",
                  width: "36px",
                  height: "36px",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#71717a",
                  transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease",
                  boxShadow: notifOpen ? "0 8px 20px rgba(15, 23, 42, 0.08)" : "none",
                }}
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "21px", color: unreadCount > 0 ? "#18181b" : "#71717a" }}>notifications</span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-5px",
                      right: "-5px",
                      minWidth: "16px",
                      height: "16px",
                      borderRadius: "999px",
                      backgroundColor: "#ef4444",
                      border: "2px solid #ffffff",
                      color: "#ffffff",
                      fontSize: "10px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 3px",
                      animation: "notificationBadgePulse 1.8s ease-in-out infinite",
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
                    top: "46px",
                    left: "0",
                    width: "360px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #dbe1ea",
                    borderRadius: "8px",
                    boxShadow: "0 22px 60px rgba(15,23,42,0.18)",
                    zIndex: 100,
                    maxHeight: "460px",
                    overflow: "hidden",
                    animation: "notificationPanelIn 160ms ease-out",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderBottom: "1px solid #edf1f7", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#18181b" }}>
                        Notifications
                      </span>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#71717a", lineHeight: 1.35 }}>
                        {unreadCount > 0 ? `${unreadCount} unread update${unreadCount !== 1 ? "s" : ""}` : "You are all caught up"}
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{ background: "#18181b", border: "1px solid #18181b", borderRadius: "6px", cursor: "pointer", fontSize: "11px", color: "#ffffff", fontWeight: 700, padding: "7px 10px" }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ padding: "36px 20px", textAlign: "center", color: "#71717a", fontSize: "13px" }}>
                      <span className="material-symbols-outlined" style={{ width: "44px", height: "44px", borderRadius: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f4f6fb", color: "#52525b", fontSize: "24px", marginBottom: "12px" }}>
                        task_alt
                      </span>
                      <p style={{ margin: 0, fontWeight: 700, color: "#18181b" }}>No unread notifications</p>
                      <p style={{ margin: "6px 0 0 0", lineHeight: 1.5 }}>New approvals, risks, and session reminders will appear here.</p>
                    </div>
                  ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: "8px", maxHeight: "356px", overflowY: "auto" }}>
                      {notifications.map((notif: any) => {
                        const tone = getNotificationTone(notif);
                        return (
                          <li
                            key={notif.id}
                            style={{
                              padding: "12px",
                              borderBottom: "1px solid #f4f4f5",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: "10px",
                              backgroundColor: "#ffffff",
                              borderRadius: "6px",
                              transition: "background-color 150ms ease, transform 150ms ease",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ width: "32px", height: "32px", borderRadius: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "18px", color: tone.color, backgroundColor: tone.background, border: `1px solid ${tone.border}` }}>
                              {getNotificationIcon(notif)}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: "13px", color: "#18181b", lineHeight: "1.45", fontWeight: 600 }}>
                                {getNotificationMessage(notif)}
                              </p>
                              <p style={{ margin: "5px 0 0 0", fontSize: "11px", color: "#71717a" }}>
                                {new Date(notif.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <button
                              onClick={() => handleMarkRead(notif.id)}
                              style={{ background: "#f8fafc", border: "1px solid #e4e4e7", borderRadius: "6px", cursor: "pointer", color: "#52525b", padding: "6px", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                              title="Mark as read"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>done</span>
                            </button>
                          </li>
                        );
                      })}
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
              data-tour="team-switcher"
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

        <div data-tour="navigation" style={{ flex: 1, overflowY: "auto" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="click-animation"
                  data-tour={`nav-${getNavTourId(item.label)}`}
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
          <button
            type="button"
            onClick={replayOnboardingTour}
            className="click-animation"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "14px 16px",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#71717a",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: "1px solid #e4e4e7",
              textAlign: "left",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
              help
            </span>
            Tutorial
          </button>
          <Link
            href="/dashboard/settings"
            className="click-animation"
            data-tour="nav-settings"
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
        {showSessionExpiryWarning && (
          <div
            role="status"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 24px",
              backgroundColor: "#fef3c7",
              color: "#92400e",
              fontSize: "13px",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>timer</span>
            Your session expires in less than 5 minutes.
          </div>
        )}
        {userRole === "TEAM_LEAD" && pendingRequestCount > 0 && pathname !== "/dashboard/team-lead/requests" && (
          <Link
            href="/dashboard/team-lead/requests"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 24px",
              backgroundColor: "#f59e0b",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              flexShrink: 0,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>pending_actions</span>
              {pendingRequestCount} activity log{pendingRequestCount !== 1 ? "s" : ""} waiting for approval
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", opacity: 0.85, fontSize: "12px" }}>
              Review now
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            </span>
          </Link>
        )}
        <ErrorBoundary>
        {hasNoTeamAssignment ? (
          <main data-tour="main-content" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" }}>
            <section style={{ width: "100%", maxWidth: "720px", backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "40px", boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "#71717a", marginBottom: "16px" }}>groups</span>
              <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700, color: "#18181b" }}>Team assignment pending</h1>
              <p style={{ margin: "12px 0 0 0", fontSize: "15px", lineHeight: 1.7, color: "#52525b" }}>
                Your account is active in the organization, but you have not been added to a team yet. Once an admin assigns you to a team, your WIGs, scoreboard, sessions, and activity log tools will appear here.
              </p>
              <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", fontSize: "14px", lineHeight: 1.6 }}>
                You can still open Settings from the sidebar to manage your profile and password while you wait.
              </div>
            </section>
          </main>
        ) : (
          <div data-tour="main-content" style={{ flex: 1, minHeight: 0 }}>
            {children}
          </div>
        )}
        </ErrorBoundary>
      </div>
      <OnboardingTour userId={user?.id} role={userRole} />
    </div>
  );
}
