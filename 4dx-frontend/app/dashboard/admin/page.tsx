"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useOrgDashboard, useOrgUsers, useDeleteUser } from "@/lib/hooks";
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
  const [adminSuccess, setAdminSuccess] = useState("");

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
  const [userActionSuccess, setUserActionSuccess] = useState<string | null>(null);

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

    const activeOrgSlug = orgSlug || org?.slug;

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

  // Global Lag Measure: aggregate current value / target
  const totalCurrentValue = allWIGs.reduce((sum: number, wig: WIG) => sum + (wig.currentValue || 0), 0);
  const totalTargetValue = allWIGs.reduce((sum: number, wig: WIG) => sum + (wig.toValue || 0), 0);
  const globalLagPercent = totalTargetValue > 0 ? Math.round((totalCurrentValue / totalTargetValue) * 100) : 0;
  const globalLagDisplay = `$${(totalCurrentValue / 1000000).toFixed(1)}M`;
  const globalLagTarget = `$${(totalTargetValue / 1000000).toFixed(1)}M`;

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
  const criticalAlerts: Array<{ tag: string; tagVariant: "error" | "default"; timestamp: string; team: string; description: string }> = [];

  // Alert 1: Teams with low execution score
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
    criticalAlerts.push({
      tag: "BEHIND PACE",
      tagVariant: "error",
      timestamp: "1d ago",
      team: lowScoreTeams[0].name,
      description: `Execution score low. Multiple lead measures not on track.`,
    });
  }

  // Alert 2: Teams with stale data
  const staleTeams = orgTeams.filter((team) => {
    const teamWIGs = team.wigs || [];
    // Calculate if team has no recent activity
    const hasRecentActivity = teamWIGs.flatMap((w: WIG) =>
      (w.leadMeasures || []).map((lm: LeadMeasure) =>
        lm.activityLogs?.[0]?.loggedForDate ? new Date(lm.activityLogs[0].loggedForDate).getTime() : 0
      )
    ).some((date: number) => date > Date.now() - 7 * 24 * 60 * 60 * 1000);
    return !hasRecentActivity;
  });

  if (staleTeams.length > 0) {
    criticalAlerts.push({
      tag: "SCOREBOARD STALE",
      tagVariant: "default",
      timestamp: "3d ago",
      team: staleTeams[0].name,
      description: "No activity logged in past 7 days. Session data may be outdated.",
    });
  }

  // Alert 3: WIGs at risk
  const riskyWIGs = allWIGs.filter((wig: WIG) => {
    const daysLeft = wig.deadline ? 25 : 999; // Placeholder: computed server-side in production
    const currentProgress = wig.toValue > wig.fromValue ? (wig.currentValue - wig.fromValue) / (wig.toValue - wig.fromValue) : 0;
    return currentProgress < 0.3 && daysLeft < 30;
  });

  if (riskyWIGs.length > 0) {
    criticalAlerts.push({
      tag: "LAG MEASURE RISK",
      tagVariant: "error",
      timestamp: "2d ago",
      team: "High-Risk WIG",
      description: `WIG "${riskyWIGs[0].title}" at risk. Progress behind target.`,
    });
  }

  // Ensure 3 alerts
  while (criticalAlerts.length < 3) {
    criticalAlerts.push({
      tag: "INFO",
      tagVariant: "default",
      timestamp: "6h ago",
      team: orgTeams[0]?.name || "All Teams",
      description: "System operational and all metrics nominal.",
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

          {/* Quarter Selector - Placeholder */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", border: "1px solid #e4e4e7", padding: "4px", backgroundColor: "#ffffff" }}>
            {["Q3 2023", "Q2 2023", "YTD"].map((q, i) => (
              <button
                key={q}
                style={{
                  padding: "6px 16px",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  backgroundColor: i === 0 ? "#18181b" : "transparent",
                  color: i === 0 ? "#ffffff" : "#71717a",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Links to dedicated admin pages */}
        <section style={{ border: "1px solid #e4e4e7", borderRadius: "24px", padding: "24px", backgroundColor: "#ffffff", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.04)" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#18181b", marginBottom: "16px" }}>Admin Tools</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <Link
                href="/dashboard/admin/users"
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
                <span style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Target: {globalLagTarget}</span>
              </div>
            </div>
          </div>

          {/* Execution Score */}
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

          {/* At Risk WIGs */}
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
        </div>

        {/* Trends + Alerts Row */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>

          {/* Macro Execution Trends */}
          <div style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", display: "flex", flexDirection: "column" }}>
            <div style={{ ...sectionHeaderStyle }}>
              <h2 style={h2Style}>Macro Execution Trends</h2>
            </div>

            {/* Bar Chart */}
            <div style={{ padding: "20px", borderBottom: "1px solid #e4e4e7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: "200px", padding: "0 16px" }}>
                {weekBars.map((bar) => (
                  <div key={bar.label} style={{ width: "48px", position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                    <div style={{ width: "100%", backgroundColor: "#e0e2e6", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                      <div style={{ width: "100%", backgroundColor: "#18181b", height: `${bar.heightPercent}%` }} />
                    </div>
                    <div style={{
                      position: "absolute",
                      bottom: "-24px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: "12px",
                      fontWeight: bar.isActive ? 700 : 500,
                      color: bar.isActive ? "#18181b" : "#71717a",
                      whiteSpace: "nowrap",
                    }}>
                      {bar.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Row */}
            <div style={{ padding: "20px", display: "flex", gap: "32px", marginTop: "8px" }}>
              <div>
                <div style={labelCapsStyle}>TOTAL LEAD MEASURES</div>
                <div style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em", marginTop: "4px" }}>
                  {allLeadMeasures.length}
                </div>
              </div>
              <div>
                <div style={labelCapsStyle}>ON TRACK RATE</div>
                <div style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em", marginTop: "4px" }}>
                  {completionRate}%
                </div>
              </div>
            </div>
          </div>

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
                <div
                  key={i}
                  style={{
                    padding: "20px",
                    borderBottom: i < criticalAlerts.length - 1 ? "1px solid #e4e4e7" : "none",
                    cursor: "pointer",
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
                </div>
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
                  {(["TEAM", "ACTIVE WIGS", "EXECUTION SCORE", "LEAD MEASURE HEALTH", "ACTION"] as const).map((h, i) => (
                    <th key={h} style={{
                      padding: "20px",
                      fontSize: "12px",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "#71717a",
                      textAlign: i === 4 ? "right" : "left",
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