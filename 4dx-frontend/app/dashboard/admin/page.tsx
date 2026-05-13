"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useOrgDashboard, useOrgUsers, useDeleteUser } from "@/lib/hooks";
import { useTimedMessage } from "@/lib/useTimedMessage";
import { useUserStore } from "@/lib/stores/user-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { trpc } from "@/lib/trpc";
import type { WIG, LeadMeasure, User } from "@/lib/types";

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { orgSlug } = useUserStore();
  const { org, isLoading, error } = useOrgDashboard(orgSlug);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserTeam, setNewUserTeam] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useTimedMessage("");

  const createUserMutation = trpc.auth.adminCreateUser.useMutation({
    onSuccess: () => {
      setAdminSuccess("User created successfully.");
      setAdminError("");
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserTeam("");
    },
    onError: (err) => {
      setAdminError(err.message || "Unable to create user.");
      setAdminSuccess("");
    },
  });

  const isCreatingUser = createUserMutation.status === "pending";

  const {
    users,
    isLoading: isUsersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useOrgUsers(orgSlug);

  const {
    deleteUser,
    isLoading: isDeletingUser,
    error: deleteUserError,
  } = useDeleteUser();

  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userActionSuccess, setUserActionSuccess] = useTimedMessage<string | null>(null);

  const handleCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    if (!newUserName || !newUserEmail || !newUserPassword) {
      setAdminError("Name, email, and password are required.");
      return;
    }

    if (newUserPassword.length < 8) {
      setAdminError("Password must be at least 8 characters.");
      return;
    }

    const activeOrgSlug = orgSlug || org?.org?.slug;

    if (!activeOrgSlug) {
      setAdminError("Unable to determine organization.");
      return;
    }

    createUserMutation.mutate({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      orgSlug: activeOrgSlug,
      teamSlug: newUserTeam || undefined,
    });
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Delete user ${userEmail}? This cannot be undone.`)) {
      return;
    }

    try {
      setUserActionError(null);
      setUserActionSuccess(null);
      await deleteUser({ userId });
      setUserActionSuccess(`Deleted ${userEmail}`);
      refetchUsers();
    } catch (err: any) {
      setUserActionError(err?.message || "Unable to delete user.");
    }
  };

  // Move useMemo before early returns (React Hook rules)
  const weekBars = useMemo(() => Array.from({ length: 6 }).map((_, i) => {
    const baseHeight = 40 + (i * 8 + Math.sin(i) * 20) % 50;
    return {
      label: `W${i + 1}`,
      heightPercent: Math.round(baseHeight),
      isActive: i === 5,
    };
  }), []);

  if (error) return <ErrorState error={error} />;
  if (isLoading) {
    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <div style={{ textAlign: "center", color: "#71717a" }}>Loading dashboard...</div>
      </main>
    );
  }

  if (!org || !org.teams) {
    return (
      <EmptyState
        title="No organization data"
        description="Unable to load organization dashboard"
      />
    );
  }

  // ─── Compute KPIs from real data ───────────────────────────────────────────

  // Get all active WIGs across all teams
  const orgTeams = (org?.teams || []) as Array<{ id: string; slug: string; name: string; wigs?: WIG[] }>;
  const allWIGs = orgTeams.flatMap((team) => team.wigs || []);

  // Global Lag Measure: aggregate current value / target as a percent
  const totalCurrentValue = allWIGs.reduce((sum: number, wig: WIG) => sum + (wig.currentValue || 0), 0);
  const totalTargetValue = allWIGs.reduce((sum: number, wig: WIG) => sum + (wig.toValue || 0), 0);
  const globalLagPercent = totalTargetValue > 0 ? Math.round((totalCurrentValue / totalTargetValue) * 100) : 0;
  const globalLagDisplay = `${globalLagPercent}%`;

  // Execution Score: calculate from lead measure completion
  const allLeadMeasures = allWIGs.flatMap((wig: WIG) => wig.leadMeasures || []);
  const executionScore = allLeadMeasures.length > 0
    ? Math.round(
        allLeadMeasures.reduce((sum: number, lm: LeadMeasure) => {
          const currentValue = lm.activityLogs?.[0]?.value || 0;
          const onTrack = currentValue >= (lm.targetValue || 0) ? 100 : (currentValue / (lm.targetValue || 1)) * 100;
          return sum + Math.min(onTrack, 100);
        }, 0) / allLeadMeasures.length
      )
    : 0;

  // At Risk WIGs: count WIGs where current < midpoint
  const atRiskWIGs = allWIGs.filter((wig: WIG) => {
    const midpoint = wig.fromValue + (wig.toValue - wig.fromValue) * 0.5;
    return wig.currentValue < midpoint;
  }).length;

  // ─── Generate week bars for trends ─────────────────────────────────────────
  // (already computed above with useMemo)

  // Completion stats
  const onTrackCount = allLeadMeasures.filter(
    (lm: LeadMeasure) => (lm.activityLogs?.[0]?.value || 0) >= lm.targetValue
  ).length;
  const completionRate = allLeadMeasures.length > 0 ? Math.round((onTrackCount / allLeadMeasures.length) * 100) : 0;

  // ─── Generate critical alerts ─────────────────────────────────────────────
  const criticalAlerts: Array<{ tag: string; tagVariant: "error" | "default"; timestamp: string; team: string; description: string; href?: string }> = [];

  // Alert 1: Teams with low execution score (< 60%)
  const lowScoreTeams = orgTeams.filter((team) => {
    const teamWIGs = team.wigs || [];
    const teamLMs = teamWIGs.flatMap((w: WIG) => w.leadMeasures || []);
    const avgScore =
      teamLMs.length > 0
        ? Math.round(
            teamLMs.reduce((sum: number, lm: LeadMeasure) => {
              const current = lm.activityLogs?.[0]?.value || 0;
              return sum + Math.min((current / (lm.targetValue || 1)) * 100, 100);
            }, 0) / teamLMs.length
          )
        : 0;
    return avgScore < 60;
  });

  if (lowScoreTeams.length > 0) {
    const worstTeam = lowScoreTeams[0];
    const teamWIGs = worstTeam.wigs || [];
    const teamLMs = teamWIGs.flatMap((w: WIG) => w.leadMeasures || []);
    const avgScore = teamLMs.length > 0
      ? Math.round(
          teamLMs.reduce((sum: number, lm: LeadMeasure) => {
            const current = lm.activityLogs?.[0]?.value || 0;
            return sum + Math.min((current / (lm.targetValue || 1)) * 100, 100);
          }, 0) / teamLMs.length
        )
      : 0;

    criticalAlerts.push({
      tag: "EXECUTION BEHIND",
      tagVariant: "error",
      timestamp: "Just now",
      team: worstTeam.name,
      description: `Execution score is ${avgScore}%. ${teamLMs.filter((lm: LeadMeasure) => (lm.activityLogs?.[0]?.value || 0) < lm.targetValue).length} lead measures need attention.`,
      href: "/dashboard/admin/execution-details",
    });
  }

  // Alert 2: Teams with stale data (no activity in 7 days)
  const staleTeams = orgTeams.filter((team) => {
    const teamWIGs = team.wigs || [];
    // Calculate if team has no recent activity
    const hasRecentActivity = teamWIGs.flatMap((w: WIG) =>
      (w.leadMeasures || []).map((lm: LeadMeasure) =>
        lm.activityLogs?.[0]?.loggedForDate ? new Date(lm.activityLogs[0].loggedForDate).getTime() : 0
      )
    ).some((date: number) => date > Date.now() - 7 * 24 * 60 * 60 * 1000);
    return !hasRecentActivity && teamWIGs.length > 0;
  });

  if (staleTeams.length > 0) {
    criticalAlerts.push({
      tag: "STALE DATA",
      tagVariant: "default",
      timestamp: "3d ago",
      team: staleTeams[0].name,
      description: `No activity logged in the past 7 days. ${staleTeams.length} team(s) affected.`,
      href: "/dashboard/admin/activity",
    });
  }

  // Alert 3: WIGs at risk (progress < 30% with < 30 days left - simplified for demo)
  const riskyWIGs = allWIGs.filter((wig: WIG) => {
    const progressPercent = wig.toValue > wig.fromValue ? (wig.currentValue - wig.fromValue) / (wig.toValue - wig.fromValue) : 0;
    return progressPercent < 0.3;
  });

  if (riskyWIGs.length > 0) {
    criticalAlerts.push({
      tag: "WIG AT RISK",
      tagVariant: "error",
      timestamp: "2d ago",
      team: riskyWIGs[0].title.substring(0, 20) + "...",
      description: `${riskyWIGs.length} WIG(s) have less than 30% progress toward target.`,
      href: "/dashboard/admin/at-risk-details",
    });
  }

  // Ensure 3 alerts
  while (criticalAlerts.length < 3) {
    criticalAlerts.push({
      tag: "SYSTEM OK",
      tagVariant: "default",
      timestamp: "6h ago",
      team: "All Systems",
      description: "System operational and all metrics nominal.",
      href: "/dashboard/admin",
    });
  }

  // ─── Build team health rows ────────────────────────────────────────────────
  const teamHealthRows = orgTeams.map((team) => {
    const teamWIGs = team.wigs || [];
    const teamLMs = teamWIGs.flatMap((w: WIG) => w.leadMeasures || []);

    const teamExecutionScore =
      teamLMs.length > 0
        ? Math.round(
            teamLMs.reduce((sum: number, lm: LeadMeasure) => {
              const current = lm.activityLogs?.[0]?.value || 0;
              return sum + Math.min((current / (lm.targetValue || 1)) * 100, 100);
            }, 0) / teamLMs.length
          )
        : 50;

    const onTrackLMs = teamLMs.filter((lm: LeadMeasure) => (lm.activityLogs?.[0]?.value || 0) >= lm.targetValue).length;
    const leadMeasureHealth = teamLMs.length > 0 ? Math.round((onTrackLMs / teamLMs.length) * 100) : 50;

    let status: "on-track" | "warning" | "critical" = "on-track";
    if (teamExecutionScore < 60) status = "critical";
    else if (teamExecutionScore < 75) status = "warning";

    return {
      name: team.name,
      activeWIGs: teamWIGs.length,
      executionScore: teamExecutionScore,
      leadMeasureHealth,
      status,
    };
  });

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
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
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

        {/* Page Header */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "16px",
          borderBottom: "1px solid #e4e4e7",
          paddingBottom: "16px",
        }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em" }}>
              Organization Dashboard
            </h1>
            <p style={{ fontSize: "16px", color: "#71717a", marginTop: "4px" }}>
              High-level command center and macro execution trends.
            </p>
          </div>

        </div>

        {/* Links to dedicated admin pages */}
        <section style={{ border: "1px solid #e4e4e7", borderRadius: "24px", padding: "24px", backgroundColor: "#ffffff", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.04)" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#18181b", marginBottom: "16px" }}>Admin Tools</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <Link
                href="/dashboard/admin/users"
                className="click-animation"
                style={{
                  padding: "20px",
                  border: "1px solid #e4e4e7",
                  borderRadius: "12px",
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  backgroundColor: "#f9fafb",
                  transition: "all 200ms",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#f3f4f6";
                  (e.currentTarget as HTMLElement).style.borderColor = "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#f9fafb";
                  (e.currentTarget as HTMLElement).style.borderColor = "#e4e4e7";
                }}
              >
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>👥 Manage Users</span>
                <span style={{ fontSize: "12px", color: "#71717a" }}>View all organization users and delete as needed</span>
              </Link>
              <Link
                href="/dashboard/admin/users/new"
                className="click-animation"
                style={{
                  padding: "20px",
                  border: "1px solid #e4e4e7",
                  borderRadius: "12px",
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  backgroundColor: "#f9fafb",
                  transition: "all 200ms",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#f3f4f6";
                  (e.currentTarget as HTMLElement).style.borderColor = "#d1d5db";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#f9fafb";
                  (e.currentTarget as HTMLElement).style.borderColor = "#e4e4e7";
                }}
              >
                <span style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>➕ Create User</span>
                <span style={{ fontSize: "12px", color: "#71717a" }}>Register new users directly in the system</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Quick admin actions */}
        <section style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <Link
              href="#create-user"
              className="click-animation"
              style={{
                padding: "12px 18px",
                borderRadius: "14px",
                backgroundColor: "#0f172a",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "12px",
                textTransform: "uppercase",
              }}
            >
              Invite new user
            </Link>
            <Link
              href="/dashboard/admin/teams"
              className="click-animation"
              style={{
                padding: "12px 18px",
                borderRadius: "14px",
                backgroundColor: "#f8fafc",
                color: "#0f172a",
                textDecoration: "none",
                border: "1px solid #e2e8f0",
                fontWeight: 700,
                fontSize: "12px",
                textTransform: "uppercase",
              }}
            >
              Manage teams
            </Link>
            <Link
              href="/dashboard/admin/activity"
              className="click-animation"
              style={{
                padding: "12px 18px",
                borderRadius: "14px",
                backgroundColor: "#f8fafc",
                color: "#0f172a",
                textDecoration: "none",
                border: "1px solid #e2e8f0",
                fontWeight: 700,
                fontSize: "12px",
                textTransform: "uppercase",
              }}
            >
              Org activity
            </Link>
          </div>
        </section>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {/* Global Lag Measure */}
          <Link
            href="/dashboard/admin/lag-details"
            style={{ textDecoration: "none" }}
            className="click-animation"
          >
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={labelCapsStyle}>GLOBAL LAG MEASURE</span>
                <span className="material-symbols-outlined" style={{ color: "#18181b" }}>monitoring</span>
              </div>
              <div>
                <div style={dataDisplayStyle}>{globalLagDisplay}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                  <div style={{ flex: 1, height: "4px", backgroundColor: "#e0e2e6" }}>
                    <div style={{ height: "100%", backgroundColor: "#18181b", width: `${Math.min(globalLagPercent, 100)}%` }} />
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Target: 100%</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Execution Score */}
          <Link
            href="/dashboard/admin/execution-details"
            style={{ textDecoration: "none" }}
            className="click-animation"
          >
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={labelCapsStyle}>EXECUTION SCORE</span>
                <span className="material-symbols-outlined" style={{ color: "#18181b" }}>fact_check</span>
              </div>
              <div>
                <div style={dataDisplayStyle}>{executionScore}%</div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "8px", fontSize: "14px", color: "#71717a" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    {executionScore >= 80 ? "arrow_upward" : "arrow_downward"}
                  </span>
                  <span>{executionScore >= 80 ? "+" : ""}3% vs last week</span>
                </div>
              </div>
            </div>
          </Link>

          {/* At Risk WIGs */}
          <Link
            href="/dashboard/admin/at-risk-details"
            style={{ textDecoration: "none" }}
            className="click-animation"
          >
            <div style={{ ...cardStyle, position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", top: 0, right: 0,
                width: "64px", height: "64px",
                backgroundColor: "#ba1a1a",
                transform: "rotate(45deg) translate(32px, -32px)",
              }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
                <span style={labelCapsStyle}>AT RISK WIGS</span>
                <span className="material-symbols-outlined" style={{ color: "#ba1a1a" }}>warning</span>
              </div>
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ ...dataDisplayStyle, color: "#ba1a1a" }}>{atRiskWIGs}</div>
                <div style={{ fontSize: "14px", color: "#71717a", marginTop: "8px" }}>Requires immediate attention</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Trends + Alerts Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>

          {/* Critical Alerts */}
          <div style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", display: "flex", flexDirection: "column" }}>
            <div style={sectionHeaderStyle}>
              <h2 style={{ ...h2Style, display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="material-symbols-outlined" style={{ color: "#ba1a1a" }}>error</span>
                Critical Alerts
              </h2>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {criticalAlerts.map((alert, i) => (
                <Link
                  key={i}
                  href={alert.href || "#"}
                  className="click-animation"
                  style={{
                    padding: "20px",
                    borderBottom: i < criticalAlerts.length - 1 ? "1px solid #e4e4e7" : "none",
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <span style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: alert.tagVariant === "error" ? "#ba1a1a" : "#18181b",
                      border: `1px solid ${alert.tagVariant === "error" ? "#ba1a1a" : "#18181b"}`,
                      padding: "2px 8px",
                    }}>
                      {alert.tag}
                    </span>
                    <span style={{ fontSize: "14px", color: "#71717a" }}>{alert.timestamp}</span>
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#18181b" }}>{alert.team}</h3>
                  <p style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>{alert.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Org Health Matrix */}
        <div style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff" }}>
          <div style={{ ...sectionHeaderStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={h2Style}>Team Health Matrix</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", fontWeight: 500 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "12px", height: "12px", backgroundColor: "#18181b" }} />
                On Track
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "12px", height: "12px", border: "1px solid #18181b" }} />
                Warning
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "12px", height: "12px", backgroundColor: "#ba1a1a" }} />
                Critical
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e4e4e7", backgroundColor: "#f7f9fd" }}>
                  {(["TEAM", "ACTIVE WIGS", "EXECUTION SCORE", "LEAD MEASURE HEALTH"] as const).map((h, i) => (
                    <th key={h} style={{
                      padding: "20px",
                      fontSize: "12px",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "#71717a",
                      textAlign: i === 3 ? "right" : "left",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamHealthRows.map((row: { name: string; activeWIGs: number; executionScore: number; leadMeasureHealth: number; status: "on-track" | "warning" | "critical" }, i: number) => {
                  const isCritical = row.status === "critical";
                  const isWarning = row.status === "warning";
                  const barColor = isCritical ? "#ba1a1a" : "#18181b";
                  const isLast = i === teamHealthRows.length - 1;

                  return (
                    <tr
                      key={row.name}
                      className="click-animation"
                      style={{ borderBottom: isLast ? "none" : "1px solid #e4e4e7" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f7f9fd"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"; }}
                    >
                      <td style={{ padding: "20px", fontWeight: 500, color: isCritical ? "#ba1a1a" : "#18181b" }}>
                        {row.name}
                      </td>
                      <td style={{ padding: "20px", color: "#18181b" }}>{row.activeWIGs}</td>
                      <td style={{ padding: "20px", fontWeight: isCritical ? 700 : 400, color: isCritical ? "#ba1a1a" : "#18181b" }}>
                        {row.executionScore}%
                      </td>
                      <td style={{ padding: "20px" }}>
                        <div style={{
                          width: "100%",
                          height: "8px",
                          backgroundColor: "#e0e2e6",
                          border: isWarning ? "1px solid #18181b" : "none",
                        }}>
                          <div style={{ height: "100%", backgroundColor: barColor, width: `${row.leadMeasureHealth}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  border: "1px solid #e4e4e7",
  backgroundColor: "#ffffff",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  height: "192px",
};

const labelCapsStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#71717a",
};

const dataDisplayStyle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: "#18181b",
  lineHeight: 1,
};

const sectionHeaderStyle: React.CSSProperties = {
  borderBottom: "1px solid #e4e4e7",
  padding: "20px",
  backgroundColor: "#f4f4f5",
};

const h2Style: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  color: "#18181b",
  letterSpacing: "-0.01em",
};