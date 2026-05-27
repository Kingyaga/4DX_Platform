"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUserStore } from "@/lib/stores/user-store";
import { useOrgDashboard } from "@/lib/hooks";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { PageLoader } from "@/lib/components/loading-spinner";

export default function LagMeasureDetailsPage() {
  const router = useRouter();
  const { orgSlug } = useUserStore();
  const { org, isLoading, error } = useOrgDashboard(orgSlug);

  if (error) return <ErrorState error={error} />;
  if (isLoading) {
    return <PageLoader text="Loading lag measure details..." />;
  }

  if (!org || !org.teams) {
    return (
      <EmptyState
        title="No organization data"
        description="Unable to load lag measure details"
      />
    );
  }

  // Calculate lag measure details
  const orgTeams = (org?.teams || []) as Array<{ id: string; slug: string; name: string; wigs?: any[] }>;
  const allWIGs = orgTeams.flatMap((team) => team.wigs || []);

  const totalCurrentValue = allWIGs.reduce((sum: number, wig: any) => sum + (wig.currentValue || 0), 0);
  const totalTargetValue = allWIGs.reduce((sum: number, wig: any) => sum + (wig.toValue || 0), 0);
  const globalLagPercent = totalTargetValue > 0 ? Math.round((totalCurrentValue / totalTargetValue) * 100) : 0;

  // Group by team
  const teamLagData = orgTeams.map((team) => {
    const teamWIGs = team.wigs || [];
    const teamCurrentValue = teamWIGs.reduce((sum: number, wig: any) => sum + (wig.currentValue || 0), 0);
    const teamTargetValue = teamWIGs.reduce((sum: number, wig: any) => sum + (wig.toValue || 0), 0);
    const teamLagPercent = teamTargetValue > 0 ? Math.round((teamCurrentValue / teamTargetValue) * 100) : 0;

    return {
      teamName: team.name,
      lagPercent: teamLagPercent,
      status: teamLagPercent >= 75 ? "On Track" : teamLagPercent >= 50 ? "Warning" : "Behind",
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
              Global Lag Measure Details
            </h1>
            <p style={{ fontSize: "16px", color: "#71717a", margin: "4px 0 0 0" }}>
              Current progress: {globalLagPercent}% of target
            </p>
          </div>
        </div>

        {/* Team Breakdown */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", backgroundColor: "#ffffff" }}>
          <div style={{ padding: "20px", borderBottom: "1px solid #e4e4e7" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", margin: 0 }}>
              Team Breakdown
            </h2>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e4e4e7", backgroundColor: "#f7f9fd" }}>
                  {["TEAM", "PROGRESS", "STATUS"].map((h) => (
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
                {teamLagData.map((team, i) => (
                  <tr key={team.teamName} style={{ borderBottom: i < teamLagData.length - 1 ? "1px solid #e4e4e7" : "none" }}>
                    <td style={{ padding: "16px", fontWeight: 500, color: "#18181b" }}>
                      {team.teamName}
                    </td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ flex: 1, height: "8px", backgroundColor: "#e0e2e6", borderRadius: "4px" }}>
                          <div style={{
                            height: "100%",
                            backgroundColor: team.lagPercent >= 75 ? "#22c55e" : team.lagPercent >= 50 ? "#f59e0b" : "#ef4444",
                            width: `${Math.min(team.lagPercent, 100)}%`,
                            borderRadius: "4px"
                          }} />
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: 500, color: "#18181b" }}>
                          {team.lagPercent}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        color: team.lagPercent >= 75 ? "#22c55e" : team.lagPercent >= 50 ? "#f59e0b" : "#ef4444",
                      }}>
                        {team.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* WIG Details */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", backgroundColor: "#ffffff" }}>
          <div style={{ padding: "20px", borderBottom: "1px solid #e4e4e7" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", margin: 0 }}>
              WIG Details
            </h2>
          </div>

          <div style={{ padding: "20px" }}>
            <div style={{ display: "grid", gap: "16px" }}>
              {allWIGs.map((wig: any) => (
                <div key={wig.id} style={{
                  padding: "16px",
                  border: "1px solid #e4e4e7",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#18181b", margin: "0 0 4px 0" }}>
                      {wig.title}
                    </h3>
                    <p style={{ fontSize: "14px", color: "#71717a", margin: 0 }}>
                        Current: {wig.currentValue || 0} | Target: {wig.toValue || 0}
                    </p>
                  </div>
                  <div style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    backgroundColor: "#f0f0f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#18181b",
                  }}>
                    {Math.round(((wig.currentValue || 0) / wig.toValue) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
