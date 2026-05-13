"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUserStore } from "@/lib/stores/user-store";
import { useOrgDashboard } from "@/lib/hooks";
import { ErrorState, EmptyState } from "@/lib/components/states";

export default function ExecutionDetailsPage() {
  const router = useRouter();
  const { orgSlug } = useUserStore();
  const { org, isLoading, error } = useOrgDashboard(orgSlug);

  if (error) return <ErrorState error={error} />;
  if (isLoading) {
    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <div style={{ textAlign: "center", color: "#71717a" }}>Loading execution details...</div>
      </main>
    );
  }

  if (!org || !org.teams) {
    return (
      <EmptyState
        title="No organization data"
        description="Unable to load execution details"
      />
    );
  }

  // Calculate execution details
  const orgTeams = (org?.teams || []) as Array<{ id: string; slug: string; name: string; wigs?: any[] }>;
  const allWIGs = orgTeams.flatMap((team) => team.wigs || []);
  const allLeadMeasures = allWIGs.flatMap((wig: any) => wig.leadMeasures || []);

  const executionScore = allLeadMeasures.length > 0
    ? Math.round(
        allLeadMeasures.reduce((sum: number, lm: any) => {
          const currentValue = lm.activityLogs?.[0]?.value || 0;
          const onTrack = currentValue >= (lm.targetValue || 0) ? 100 : (currentValue / (lm.targetValue || 1)) * 100;
          return sum + Math.min(onTrack, 100);
        }, 0) / allLeadMeasures.length
      )
    : 0;

  // Group by team
  const teamExecutionData = orgTeams.map((team) => {
    const teamWIGs = team.wigs || [];
    const teamLMs = teamWIGs.flatMap((w: any) => w.leadMeasures || []);

    const teamExecutionScore =
      teamLMs.length > 0
        ? Math.round(
            teamLMs.reduce((sum: number, lm: any) => {
              const current = lm.activityLogs?.[0]?.value || 0;
              return sum + Math.min((current / (lm.targetValue || 1)) * 100, 100);
            }, 0) / teamLMs.length
          )
        : 50;

    const onTrackCount = teamLMs.filter((lm: any) => (lm.activityLogs?.[0]?.value || 0) >= lm.targetValue).length;

    return {
      teamName: team.name,
      executionScore: teamExecutionScore,
      totalLeadMeasures: teamLMs.length,
      onTrackCount,
      wigs: teamWIGs,
    };
  });

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: "8px",
              border: "1px solid #e4e4e7",
              borderRadius: "6px",
              backgroundColor: "#ffffff",
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#18181b", margin: 0 }}>
              Execution Score Details
            </h1>
            <p style={{ fontSize: "16px", color: "#71717a", margin: "4px 0 0 0" }}>
              Overall execution score: {executionScore}% across {allLeadMeasures.length} lead measures
            </p>
          </div>
        </div>

        {/* Team Breakdown */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", backgroundColor: "#ffffff" }}>
          <div style={{ padding: "20px", borderBottom: "1px solid #e4e4e7" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", margin: 0 }}>
              Team Execution Breakdown
            </h2>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e4e4e7", backgroundColor: "#f7f9fd" }}>
                  {["TEAM", "EXECUTION SCORE", "LEAD MEASURES", "ON TRACK", "STATUS"].map((h) => (
                    <th key={h} style={{
                      padding: "16px",
                      fontSize: "12px",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "#71717a",
                      textAlign: "left",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamExecutionData.map((team, i) => (
                  <tr key={team.teamName} style={{ borderBottom: i < teamExecutionData.length - 1 ? "1px solid #e4e4e7" : "none" }}>
                    <td style={{ padding: "16px", fontWeight: 500, color: "#18181b" }}>
                      {team.teamName}
                    </td>
                    <td style={{ padding: "16px", fontWeight: 600, color: team.executionScore >= 75 ? "#22c55e" : team.executionScore >= 50 ? "#f59e0b" : "#ef4444" }}>
                      {team.executionScore}%
                    </td>
                    <td style={{ padding: "16px", color: "#18181b" }}>
                      {team.totalLeadMeasures}
                    </td>
                    <td style={{ padding: "16px", color: "#18181b" }}>
                      {team.onTrackCount} / {team.totalLeadMeasures}
                    </td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        color: team.executionScore >= 75 ? "#22c55e" : team.executionScore >= 50 ? "#f59e0b" : "#ef4444",
                      }}>
                        {team.executionScore >= 75 ? "On Track" : team.executionScore >= 50 ? "Warning" : "Behind"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lead Measure Details */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", backgroundColor: "#ffffff" }}>
          <div style={{ padding: "20px", borderBottom: "1px solid #e4e4e7" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", margin: 0 }}>
              Lead Measure Performance
            </h2>
          </div>

          <div style={{ padding: "20px" }}>
            <div style={{ display: "grid", gap: "16px" }}>
              {allLeadMeasures.map((lm: any) => {
                const currentValue = lm.activityLogs?.[0]?.value || 0;
                const targetValue = lm.targetValue || 0;
                const progressPercent = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
                const isOnTrack = currentValue >= targetValue;

                return (
                  <div key={lm.id} style={{
                    padding: "16px",
                    border: "1px solid #e4e4e7",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#18181b", margin: "0 0 4px 0" }}>
                        {lm.title}
                      </h3>
                      <p style={{ fontSize: "14px", color: "#71717a", margin: "0 0 8px 0" }}>
                        Current: {currentValue} | Target: {targetValue}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ flex: 1, height: "6px", backgroundColor: "#e0e2e6", borderRadius: "3px" }}>
                          <div style={{
                            height: "100%",
                            backgroundColor: isOnTrack ? "#22c55e" : progressPercent >= 50 ? "#f59e0b" : "#ef4444",
                            width: `${progressPercent}%`,
                            borderRadius: "3px"
                          }} />
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 500, color: "#71717a" }}>
                          {Math.round(progressPercent)}%
                        </span>
                      </div>
                    </div>
                    <div style={{
                      marginLeft: "16px",
                      padding: "8px 12px",
                      borderRadius: "16px",
                      backgroundColor: isOnTrack ? "#dcfce7" : "#fef3c7",
                      color: isOnTrack ? "#166534" : "#92400e",
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}>
                      {isOnTrack ? "On Track" : "Behind"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}