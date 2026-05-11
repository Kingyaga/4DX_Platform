"use client";

import { useEffect, useState } from "react";
import { useUserStore } from "@/lib/stores/user-store";
import { useTeamStore } from "@/lib/stores/team-store";
import { useWIGs, useMyTeams } from "@/lib/hooks";
import { ErrorState, EmptyState } from "@/lib/components/states";
import Link from "next/link";

export default function TeamLeadReportsPage() {
  const { orgSlug } = useUserStore();
  const { currentTeamSlug, setCurrentTeamSlug } = useTeamStore();
  const { wigs, isLoading, error } = useWIGs(currentTeamSlug);
  const { teams, isLoading: teamsLoading, error: teamsError } = useMyTeams(orgSlug);
  const [selectedReport, setSelectedReport] = useState<"execution" | "lag" | "lead" | null>(null);

  useEffect(() => {
    if (!currentTeamSlug && !teamsLoading && teams.length > 0) {
      // Auto-select first team if none is currently selected
      setCurrentTeamSlug(teams[0].slug);
    }
  }, [currentTeamSlug, teamsLoading, teams, setCurrentTeamSlug]);

  if (error) return <ErrorState error={error} />;
  if (isLoading) {
    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <div style={{ textAlign: "center", color: "#71717a" }}>Loading reports...</div>
      </main>
    );
  }

  if (!currentTeamSlug) {
    if (teamsLoading) {
      return (
        <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
          <div style={{ textAlign: "center", color: "#71717a" }}>Loading teams...</div>
        </main>
      );
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
  const executionScore = allLeadMeasures.length > 0
    ? Math.round(
        allLeadMeasures.reduce((sum: number, lm: any) => {
          const current = lm.activityLogs?.[0]?.value || 0;
          return sum + Math.min((current / (lm.targetValue || 1)) * 100, 100);
        }, 0) / allLeadMeasures.length
      )
    : 0;

  const onTrackCount = allLeadMeasures.filter((lm: any) => (lm.activityLogs?.[0]?.value || 0) >= lm.targetValue).length;
  const lagMeasures = wigs.map((w: any) => ({
    title: w.title,
    current: w.currentValue || 0,
    target: w.toValue,
    progress: Math.round(((w.currentValue || 0) / w.toValue) * 100),
  }));

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", margin: "0 0 8px 0" }}>Team Reports</h1>
          <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>Performance analysis and insights</p>
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
                    {measure.current} of {measure.target} target
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
              Detailed tracking of all lead measures. Track weekly progress and adjust cadence as needed.
            </p>
            <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {allLeadMeasures.slice(0, 10).map((lm: any, i: number) => {
                const current = lm.activityLogs?.[0]?.value || 0;
                const isOnTrack = current >= lm.targetValue;
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
          <div style={{ display: "flex", gap: "12px" }}>
            <button
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
              style={{
                padding: "12px 24px",
                backgroundColor: "white",
                color: "#18181b",
                border: "1px solid #e4e4e7",
                borderRadius: "6px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              Share Report
            </button>
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
