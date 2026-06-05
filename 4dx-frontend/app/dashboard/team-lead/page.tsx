"use client";

import { useEffect } from "react";
import { useTeamStore } from "@/lib/stores/team-store";
import { useUserStore } from "@/lib/stores/user-store";
import { useWIGs, useTeamSessions, useMyTeams } from "@/lib/hooks";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { PageLoader } from "@/lib/components/loading-spinner";
import Link from "next/link";

function getLeadMeasureScore(leadMeasure: any) {
  if (leadMeasure.trackingType === "MILESTONE") {
    const latest = [...(leadMeasure.activityLogs || [])].sort((a: any, b: any) => new Date(b.loggedForDate).getTime() - new Date(a.loggedForDate).getTime())[0];
    if (latest?.progressStatus === "DONE") return 100;
    if (latest?.progressStatus === "IN_PROGRESS") return 50;
    if (latest?.progressStatus === "BLOCKED") return 25;
    return 0;
  }

  const current = (leadMeasure.activityLogs || []).reduce((sum: number, log: any) => sum + (log.value ?? 0), 0);
  const target = leadMeasure.targetValue ?? 0;
  return target > 0 ? Math.min((current / target) * 100, 100) : 0;
}

function getWigScore(wig: any) {
  if (wig.trackingType === "MILESTONE") {
    const leadMeasures = wig.leadMeasures || [];
    return leadMeasures.length > 0
      ? Math.round(leadMeasures.reduce((sum: number, leadMeasure: any) => sum + getLeadMeasureScore(leadMeasure), 0) / leadMeasures.length)
      : 0;
  }

  const fromValue = wig.fromValue ?? 0;
  const toValue = wig.toValue ?? 0;
  const currentValue = wig.currentValue ?? fromValue;
  const denominator = toValue - fromValue;
  return denominator > 0 ? Math.max(0, Math.min(100, Math.round(((currentValue - fromValue) / denominator) * 100))) : 0;
}

export default function TeamLeadPage() {
  const { orgSlug } = useUserStore();
  const { currentTeamSlug, setCurrentTeamSlug } = useTeamStore();
  const { teams, isLoading: teamsLoading, error: teamsError } = useMyTeams(orgSlug);
  const { wigs, isLoading: wigsLoading, error: wigsError } = useWIGs(currentTeamSlug);
  const { sessions, isLoading: sessionsLoading, error: sessionsError } = useTeamSessions(currentTeamSlug);

  useEffect(() => {
    if (!teamsLoading && teams.length > 0 && (!currentTeamSlug || !teams.some((team: any) => team.slug === currentTeamSlug))) {
      // Auto-select first team if none is currently selected or the stored team is invalid
      setCurrentTeamSlug(teams[0].slug);
    }
  }, [currentTeamSlug, teamsLoading, teams, setCurrentTeamSlug]);

  const isLoading = wigsLoading || sessionsLoading;
  const error = wigsError || sessionsError;

  if (error) return <ErrorState error={error} />;
  if (isLoading) {
    return <PageLoader text="Loading team dashboard..." />;
  }

  if (!currentTeamSlug) {
    if (teamsLoading) {
      return <PageLoader text="Loading teams..." />;
    }

    if (teamsError) {
      return (
        <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
          <ErrorState error={teamsError} title="Unable to load teams" />
        </main>
      );
    }

    if (!teams || teams.length === 0) {
      return (
        <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
          <EmptyState
            title="No teams assigned"
            description="You need at least one team before you can use the team dashboard. Contact your admin to join a team."
          />
        </main>
      );
    }

    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#18181b", marginBottom: "8px" }}>Select your team</h1>
            <p style={{ fontSize: "14px", color: "#71717a" }}>
              Choose the team you want to lead before reviewing WIGs, activity, and sessions.
            </p>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {teams.map((team: any) => (
              <button
                key={team.slug}
                onClick={() => setCurrentTeamSlug(team.slug)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "18px 20px",
                  borderRadius: "16px",
                  border: "1px solid #e4e4e7",
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#18181b",
                }}
              >
                <span>{team.name}</span>
                <span style={{ fontSize: "12px", color: "#71717a" }}>{team.wigs?.length || 0} WIGs</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Compute metrics
  const totalWIGs = wigs.length;
  const activeWigList = wigs.filter((w: any) => w.status === "ACTIVE" && !w.archivedAt);
  const activeWIGs = activeWigList.length;

  const allLeadMeasures = activeWigList.flatMap((w: any) => w.leadMeasures || []);
  const onTrackCount = allLeadMeasures.filter((lm: any) => getLeadMeasureScore(lm) >= 100).length;
  const executionScore = allLeadMeasures.length > 0 ? Math.round((onTrackCount / allLeadMeasures.length) * 100) : 0;

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", margin: "0 0 8px 0" }}>Team Dashboard</h1>
            <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>Manage WIGs and lead measures for your team</p>
          </div>
          <Link
            href="/dashboard/wigs"
            style={{
              backgroundColor: "#000000",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              padding: "10px 16px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textDecoration: "none",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
            Create WIG
          </Link>
        </div>

        {/* KPI Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {/* Execution Score */}
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "16px", backgroundColor: "white" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>Execution Score</p>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#18181b" }}>{executionScore}%</div>
            <div style={{ marginTop: "8px", height: "4px", backgroundColor: "#e4e4e7", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${executionScore}%`, backgroundColor: executionScore >= 75 ? "#22c55e" : executionScore >= 50 ? "#f59e0b" : "#ef4444" }} />
            </div>
          </div>

          {/* Active WIGs */}
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "16px", backgroundColor: "white" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>Active WIGs</p>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#18181b" }}>{activeWIGs}</div>
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#a1a1aa" }}>of {totalWIGs} total</p>
          </div>

          {/* Lead Measure Health */}
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "16px", backgroundColor: "white" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>On Track</p>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#18181b" }}>{onTrackCount}</div>
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#a1a1aa" }}>of {allLeadMeasures.length} lead measures</p>
          </div>

          {/* Sessions This Week */}
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "16px", backgroundColor: "white" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>Sessions</p>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#18181b" }}>{sessions.length}</div>
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#a1a1aa" }}>this week</p>
          </div>
        </div>

        {/* Session completion this week */}
        <div style={{ border: "1px solid #e4e4e7", padding: "20px", backgroundColor: "#ffffff" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
            This Week's Sessions
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ fontSize: "32px", fontWeight: 700, color: "#18181b" }}>
              {sessions.filter((s: any) => s.status === "COMPLETE").length}
            </span>
            <span style={{ fontSize: "14px", color: "#71717a" }}>
              / {sessions.length} complete
            </span>
          </div>
          <div style={{ width: "100%", height: "8px", backgroundColor: "#e4e4e7" }}>
            <div style={{
              height: "100%",
              backgroundColor: "#18181b",
              width: sessions.length > 0 ? `${Math.round((sessions.filter((s: any) => s.status === "COMPLETE").length / sessions.length) * 100)}%` : "0%",
              transition: "width 0.3s ease",
            }} />
          </div>
          <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
            {(["COMPLETE", "IN_PROGRESS", "PENDING", "OVERDUE"] as const).map((status) => {
              const count = sessions.filter((s: any) => s.status === status).length;
              if (count === 0) return null;
              const colors: Record<string, string> = { COMPLETE: "#16A34A", IN_PROGRESS: "#EAB308", PENDING: "#71717a", OVERDUE: "#dc2626" };
              return (
                <div key={status} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: colors[status], display: "inline-block" }} />
                  <span style={{ fontSize: "12px", color: "#71717a" }}>{count} {status.replace("_", " ").toLowerCase()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active WIGs List */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "20px", backgroundColor: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>Active WIGs</h2>
            <Link href="/dashboard/wigs" style={{ fontSize: "12px", color: "#3b82f6", textDecoration: "none" }}>
              View all →
            </Link>
          </div>

          {activeWigList.length === 0 ? (
            <p style={{ margin: 0, color: "#a1a1aa", fontSize: "14px" }}>No active WIGs yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {activeWigList.slice(0, 5).map((wig: any) => (
                <div
                  key={wig.id}
                  style={{
                    padding: "12px",
                    border: "1px solid #e4e4e7",
                    borderRadius: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: "500", fontSize: "14px" }}>{wig.title}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#71717a" }}>
                      {wig.trackingType === "MILESTONE" ? "Outcome-based WIG" : `${wig.currentValue ?? 0} / ${wig.toValue ?? 0}`}
                    </p>
                  </div>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      backgroundColor: "#f0f0f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#18181b",
                    }}
                  >
                    {getWigScore(wig)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session Roster — who completed vs pending this week */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "20px", backgroundColor: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>Weekly Session Roster</h2>
            <span style={{ fontSize: "12px", color: "#71717a" }}>
              {sessions.filter((s: any) => s.status === "COMPLETE").length} / {sessions.length} complete
            </span>
          </div>

          {sessions.length === 0 ? (
            <p style={{ margin: 0, color: "#a1a1aa", fontSize: "14px" }}>No sessions generated for this week yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {sessions.map((session: any) => {
                const statusColor =
                  session.status === "COMPLETE" ? "#16A34A" :
                  session.status === "OVERDUE"  ? "#ef4444" :
                  session.status === "IN_PROGRESS" ? "#EAB308" : "#71717a";
                const statusLabel =
                  session.status === "COMPLETE" ? "Complete" :
                  session.status === "OVERDUE"  ? "Overdue" :
                  session.status === "IN_PROGRESS" ? "In Progress" : "Pending";

                return (
                  <div
                    key={session.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      border: "1px solid #e4e4e7",
                      borderRadius: "6px",
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: "500", fontSize: "14px" }}>
                        {session.user?.name || session.user?.email || "Unknown"}
                      </p>
                      {session.wig?.title && (
                        <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#71717a" }}>{session.wig.title}</p>
                      )}
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: statusColor,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: statusColor, display: "inline-block" }} />
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <Link
            href="/dashboard/wigs"
            style={{
              padding: "12px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: "500",
              textAlign: "center",
              fontSize: "14px",
            }}
          >
            Manage WIGs
          </Link>
          <Link
            href="/dashboard/team-lead/requests"
            style={{
              padding: "12px 16px",
              backgroundColor: "white",
              color: "#18181b",
              border: "1px solid #e4e4e7",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: "500",
              textAlign: "center",
              fontSize: "14px",
            }}
          >
            Approve Activity
          </Link>
          <Link
            href="/dashboard/team-lead/reports"
            style={{
              padding: "12px 16px",
              backgroundColor: "white",
              color: "#18181b",
              border: "1px solid #e4e4e7",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: "500",
              textAlign: "center",
              fontSize: "14px",
            }}
          >
            Session Reports
          </Link>
        </div>
      </div>
    </main>
  );
}
