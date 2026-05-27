"use client";

import { useEffect, useState } from "react";
import { useUserStore } from "@/lib/stores/user-store";
import { useTeamStore } from "@/lib/stores/team-store";
import { useWIGs, useMyTeams, useTeamSessions, useExportReport, useShareReport } from "@/lib/hooks";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { LoadingSpinner, PageLoader } from "@/lib/components/loading-spinner";
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

export default function TeamLeadReportsPage() {
  const { orgSlug } = useUserStore();
  const { currentTeamSlug, setCurrentTeamSlug } = useTeamStore();
  const { wigs, isLoading, error } = useWIGs(currentTeamSlug);
  const { teams, isLoading: teamsLoading, error: teamsError } = useMyTeams(orgSlug);
  const [selectedReport, setSelectedReport] = useState<"execution" | "lag" | "lead" | null>(null);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [reportActionMessage, setReportActionMessage] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diff);
    monday.setUTCHours(0, 0, 0, 0);
    return monday.toISOString().split("T")[0];
  });
  const { sessions, isLoading: sessionsLoading } = useTeamSessions(currentTeamSlug, selectedWeek);
  const { exportReport } = useExportReport();
  const { shareReport, isLoading: isSharingReport } = useShareReport();

  useEffect(() => {
    if (!teamsLoading && teams.length > 0 && (!currentTeamSlug || !teams.some((team: any) => team.slug === currentTeamSlug))) {
      // Auto-select first team if none is currently selected or if the selected team is no longer valid
      setCurrentTeamSlug(teams[0].slug);
    }
  }, [currentTeamSlug, teamsLoading, teams, setCurrentTeamSlug]);

  if (error) return <ErrorState error={error} />;
  if (isLoading) {
    return <PageLoader text="Loading reports..." />;
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

    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <EmptyState
          title="No team selected"
          description="Choose your team from the Team Lead dashboard or select one in the sidebar."
        />
      </main>
    );
  }

  // Compute report data
  const allLeadMeasures = wigs.flatMap((w: any) => w.leadMeasures || []);
  const incompleteLeadMeasures = allLeadMeasures.filter((lm: any) => getLeadMeasureScore(lm) < 100);
  const executionScore = allLeadMeasures.length > 0
    ? Math.round(
        allLeadMeasures.reduce((sum: number, lm: any) => {
          return sum + getLeadMeasureScore(lm);
        }, 0) / allLeadMeasures.length
      )
    : 0;

  const onTrackCount = allLeadMeasures.filter((lm: any) => getLeadMeasureScore(lm) >= 100).length;
  const lagMeasures = wigs.map((w: any) => {
    const fromValue = w.fromValue || 0;
    const toValue = w.toValue || 0;
    const currentValue = w.currentValue ?? fromValue;

    return {
      title: w.title,
      baseline: fromValue,
      current: currentValue,
      target: toValue,
      progress: getWigScore(w),
    };
  });

  const handleDownloadReport = async () => {
    if (!selectedReport || !currentTeamSlug) return;

    setReportActionMessage(null);
    const report = await exportReport({ teamSlug: currentTeamSlug, reportType: selectedReport });
    const blob = new Blob([report.csv], { type: report.contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = report.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloadMessage("Report downloaded.");
    window.setTimeout(() => setDownloadMessage(""), 2500);
  };

  const handleShareReport = async () => {
    if (!selectedReport || !currentTeamSlug) return;

    const result = await shareReport({ teamSlug: currentTeamSlug, reportType: selectedReport });
    if (!result.emailConfigured) {
      setReportActionMessage("Report share is wired up, but no email was sent because RESEND_API_KEY / EMAIL_FROM is not configured.");
      return;
    }
    setReportActionMessage(`Report shared with ${result.sent} of ${result.recipients} team members.`);
  };

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", margin: "0 0 8px 0" }}>Team Reports</h1>
          <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>Performance analysis and insights</p>
        </div>

        {/* Week selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button
            onClick={() => {
              const d = new Date(selectedWeek);
              d.setUTCDate(d.getUTCDate() - 7);
              setSelectedWeek(d.toISOString().split("T")[0]);
            }}
            style={{ padding: "8px 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
          >
            ← Prev week
          </button>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#18181b" }}>
            Week of {new Date(selectedWeek).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <button
            onClick={() => {
              const now = new Date();
              const day = now.getUTCDay();
              const diff = day === 0 ? -6 : 1 - day;
              const thisMonday = new Date(now);
              thisMonday.setUTCDate(now.getUTCDate() + diff);
              thisMonday.setUTCHours(0, 0, 0, 0);
              const currentMondayStr = thisMonday.toISOString().split("T")[0];
              if (selectedWeek >= currentMondayStr) return;
              const d = new Date(selectedWeek);
              d.setUTCDate(d.getUTCDate() + 7);
              setSelectedWeek(d.toISOString().split("T")[0]);
            }}
            disabled={(() => {
              const now = new Date();
              const day = now.getUTCDay();
              const diff = day === 0 ? -6 : 1 - day;
              const thisMonday = new Date(now);
              thisMonday.setUTCDate(now.getUTCDate() + diff);
              thisMonday.setUTCHours(0, 0, 0, 0);
              return selectedWeek >= thisMonday.toISOString().split("T")[0];
            })()}
            style={{ padding: "8px 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", cursor: "pointer", fontSize: "13px", fontWeight: 600, opacity: selectedWeek >= new Date().toISOString().split("T")[0] ? 0.4 : 1 }}
          >
            Next week →
          </button>
        </div>

        {/* Session completion for selected week */}
        <div style={{ border: "1px solid #e4e4e7", padding: "20px", marginBottom: "24px", backgroundColor: "#ffffff" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a", marginBottom: "16px" }}>
            Session Status — Week of {new Date(selectedWeek).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </h3>
          {sessionsLoading ? (
            <div style={{ minHeight: "220px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LoadingSpinner size="large" text="Loading sessions..." />
            </div>
          ) : sessions.length === 0 ? (
            <p style={{ color: "#71717a", fontSize: "14px" }}>No sessions generated for this week.</p>
          ) : (
            <div>
              <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
                {(["COMPLETE", "IN_PROGRESS", "PENDING", "OVERDUE"] as const).map((status) => {
                  const count = sessions.filter((s: any) => s.status === status).length;
                  const colors: Record<string, string> = { COMPLETE: "#16A34A", IN_PROGRESS: "#EAB308", PENDING: "#71717a", OVERDUE: "#dc2626" };
                  return (
                    <div key={status} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "28px", fontWeight: 700, color: colors[status] }}>{count}</div>
                      <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a" }}>{status.replace("_", " ")}</div>
                    </div>
                  );
                })}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e4e4e7" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase" }}>Member</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase" }}>WIG</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase" }}>Commitments</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s: any, i: number) => {
                    const statusColors: Record<string, string> = { COMPLETE: "#16A34A", IN_PROGRESS: "#EAB308", PENDING: "#71717a", OVERDUE: "#dc2626" };
                    return (
                      <tr key={s.id} style={{ borderBottom: i < sessions.length - 1 ? "1px solid #f4f4f5" : "none" }}>
                        <td style={{ padding: "10px 12px", fontSize: "14px", color: "#18181b" }}>{s.user?.name || s.user?.email || "—"}</td>
                        <td style={{ padding: "10px 12px", fontSize: "13px", color: "#71717a" }}>{s.wig?.title || "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: statusColors[s.status] || "#71717a" }}>
                            {s.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "13px", color: "#71717a" }}>
                          {s.commitments?.length ?? 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Report Type Selection */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <button
            onClick={() => setSelectedReport("execution")}
            style={{
              padding: "16px",
              border: selectedReport === "execution" ? "2px solid #3b82f6" : "1px solid #e4e4e7",
              borderRadius: "8px",
              backgroundColor: selectedReport === "execution" ? "#eff6ff" : "white",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            Execution Score
          </button>
          <button
            onClick={() => setSelectedReport("lag")}
            style={{
              padding: "16px",
              border: selectedReport === "lag" ? "2px solid #3b82f6" : "1px solid #e4e4e7",
              borderRadius: "8px",
              backgroundColor: selectedReport === "lag" ? "#eff6ff" : "white",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            Lag Measures
          </button>
          <button
            onClick={() => setSelectedReport("lead")}
            style={{
              padding: "16px",
              border: selectedReport === "lead" ? "2px solid #3b82f6" : "1px solid #e4e4e7",
              borderRadius: "8px",
              backgroundColor: selectedReport === "lead" ? "#eff6ff" : "white",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            Lead Measures
          </button>
        </div>

        {/* Report Content */}
        {selectedReport === "execution" && (
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "24px", backgroundColor: "white" }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "600" }}>Execution Score Report</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              <div>
                <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#71717a" }}>Overall Score</p>
                <div style={{ fontSize: "40px", fontWeight: "700", color: executionScore >= 75 ? "#22c55e" : executionScore >= 50 ? "#f59e0b" : "#ef4444" }}>
                  {executionScore}%
                </div>
              </div>
              <div>
                <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#71717a" }}>On Track</p>
                <div style={{ fontSize: "40px", fontWeight: "700", color: "#3b82f6" }}>{onTrackCount}</div>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#a1a1aa" }}>of {allLeadMeasures.length}</p>
              </div>
              <div>
                <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#71717a" }}>Behind Pace</p>
                <div style={{ fontSize: "40px", fontWeight: "700", color: "#ef4444" }}>{allLeadMeasures.length - onTrackCount}</div>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#a1a1aa" }}>lead measures</p>
              </div>
            </div>

            <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", fontWeight: "600" }}>Interpretation</p>
              <p style={{ margin: 0, fontSize: "14px", color: "#525252", lineHeight: "1.6" }}>
                {executionScore >= 75
                  ? "Team is exceeding execution expectations. Continue current momentum and maintain discipline."
                  : executionScore >= 50
                  ? "Team is making progress but some lead measures need attention. Focus on priority areas."
                  : "Team needs to refocus efforts on lead measures. Schedule meeting to discuss blockers and adjustments."}
              </p>
            </div>
          </div>
        )}

        {selectedReport === "lag" && (
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "24px", backgroundColor: "white" }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "600" }}>Lag Measures Report</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {lagMeasures.map((measure: any, i: number) => (
                <div key={i} style={{ padding: "16px", border: "1px solid #e4e4e7", borderRadius: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <p style={{ margin: 0, fontWeight: "500" }}>{measure.title}</p>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#18181b" }}>{measure.progress}%</span>
                  </div>
                  <div style={{ height: "8px", backgroundColor: "#e4e4e7", borderRadius: "4px", overflow: "hidden", marginBottom: "8px" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${measure.progress}%`,
                        backgroundColor: measure.progress >= 75 ? "#22c55e" : measure.progress >= 50 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "#71717a" }}>
                    Baseline {measure.baseline} · Current {measure.current} · Target {measure.target}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedReport === "lead" && (
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "24px", backgroundColor: "white" }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "600" }}>Lead Measures Report</h2>
            <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>
              Detailed tracking of lead measures still in progress. Completed lead measures are excluded.
            </p>
            <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {incompleteLeadMeasures.length === 0 && (
                <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>
                  No incomplete lead measures to report.
                </p>
              )}
              {incompleteLeadMeasures.slice(0, 10).map((lm: any, i: number) => {
                const isOnTrack = getLeadMeasureScore(lm) >= 100;
                return (
                  <div key={i} style={{ padding: "12px", backgroundColor: "#f9fafb", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: "500", fontSize: "14px" }}>{lm.name || "Lead Measure"}</p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#71717a" }}>
                        Cadence: {lm.cadence || "Weekly"}
                      </p>
                    </div>
                    <div
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        backgroundColor: isOnTrack ? "#dcfce7" : "#fee2e2",
                        color: isOnTrack ? "#166534" : "#991b1b",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      {isOnTrack ? "ON TRACK" : "BEHIND"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Generate Report Button */}
        {selectedReport && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {reportActionMessage && (
              <div style={{ padding: "12px", border: "1px solid #fde68a", backgroundColor: "#fffbeb", color: "#92400e", borderRadius: "6px", fontSize: "14px", fontWeight: 600 }}>
                {reportActionMessage}
              </div>
            )}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleDownloadReport}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Download Report
              </button>
              <button
                type="button"
                onClick={handleShareReport}
                disabled={isSharingReport}
                style={{
                  padding: "12px 24px",
                  backgroundColor: isSharingReport ? "#f4f4f5" : "white",
                  color: isSharingReport ? "#71717a" : "#18181b",
                  border: "1px solid #e4e4e7",
                  borderRadius: "6px",
                  fontWeight: "500",
                  cursor: isSharingReport ? "not-allowed" : "pointer",
                }}
              >
                {isSharingReport ? "Sharing..." : "Share Report"}
              </button>
              {downloadMessage && (
                <span style={{ alignSelf: "center", fontSize: "13px", color: "#166534", fontWeight: 600 }}>
                  {downloadMessage}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Back Link */}
        <Link href="/dashboard/team-lead" style={{ fontSize: "14px", color: "#3b82f6", textDecoration: "none" }}>
          ← Back to Team Dashboard
        </Link>
      </div>
    </main>
  );
}
