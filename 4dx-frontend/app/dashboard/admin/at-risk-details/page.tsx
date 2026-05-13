"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUserStore } from "@/lib/stores/user-store";
import { useOrgDashboard } from "@/lib/hooks";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { LoadingSpinner } from "@/lib/components/loading-spinner";

export default function AtRiskDetailsPage() {
  const router = useRouter();
  const { orgSlug } = useUserStore();
  const { org, isLoading, error } = useOrgDashboard(orgSlug);

  if (error) return <ErrorState error={error} />;
  if (isLoading) {
    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <LoadingSpinner size="large" text="" className="min-h-[420px] flex items-center justify-center" />
      </main>
    );
  }

  if (!org || !org.teams) {
    return (
      <EmptyState
        title="No organization data"
        description="Unable to load at-risk details"
      />
    );
  }

  // Calculate at-risk WIGs
  const orgTeams = (org?.teams || []) as Array<{ id: string; slug: string; name: string; wigs?: any[] }>;
  const allWIGs = orgTeams.flatMap((team) => team.wigs || []);

  const atRiskWIGs = allWIGs.filter((wig: any) => {
    const midpoint = wig.fromValue + (wig.toValue - wig.fromValue) * 0.5;
    return wig.currentValue < midpoint;
  });

  // Group at-risk WIGs by team
  const teamAtRiskData = orgTeams.map((team) => {
    const teamWIGs = team.wigs || [];
    const teamAtRiskWIGs = teamWIGs.filter((wig: any) => {
      const midpoint = wig.fromValue + (wig.toValue - wig.fromValue) * 0.5;
      return wig.currentValue < midpoint;
    });

    return {
      teamName: team.name,
      atRiskWIGs: teamAtRiskWIGs,
      totalWIGs: teamWIGs.length,
    };
  }).filter((team) => team.atRiskWIGs.length > 0);

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
              At-Risk WIGs Details
            </h1>
            <p style={{ fontSize: "16px", color: "#71717a", margin: "4px 0 0 0" }}>
              {atRiskWIGs.length} WIGs require immediate attention
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "20px", backgroundColor: "#ffffff" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#71717a" }}>Total At-Risk WIGs</p>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#18181b" }}>{atRiskWIGs.length}</div>
          </div>
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "20px", backgroundColor: "#ffffff" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#71717a" }}>Affected Teams</p>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#18181b" }}>{teamAtRiskData.length}</div>
          </div>
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "20px", backgroundColor: "#ffffff" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#71717a" }}>Total WIGs</p>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#18181b" }}>{allWIGs.length}</div>
          </div>
        </div>

        {/* Team Breakdown */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", backgroundColor: "#ffffff" }}>
          <div style={{ padding: "20px", borderBottom: "1px solid #e4e4e7" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", margin: 0 }}>
              At-Risk WIGs by Team
            </h2>
          </div>

          <div style={{ padding: "20px" }}>
            <div style={{ display: "grid", gap: "24px" }}>
              {teamAtRiskData.map((team) => (
                <div key={team.teamName} style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#18181b", margin: 0 }}>
                      {team.teamName}
                    </h3>
                    <span style={{
                      padding: "4px 12px",
                      borderRadius: "12px",
                      backgroundColor: "#f4f4f5",
                      color: "#3f3f46",
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}>
                      {team.atRiskWIGs.length} at risk
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: "12px" }}>
                    {team.atRiskWIGs.map((wig: any) => {
                      const progressPercent = wig.toValue > wig.fromValue ? (wig.currentValue - wig.fromValue) / (wig.toValue - wig.fromValue) : 0;
                      const midpoint = 0.5;

                      return (
                        <div key={wig.id} style={{
                          padding: "16px",
                          border: "1px solid #e4e4e7",
                          borderRadius: "8px",
                          backgroundColor: "#ffffff",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                            <h4 style={{ fontSize: "16px", fontWeight: 600, color: "#18181b", margin: "0 0 4px 0" }}>
                              {wig.title}
                            </h4>
                          </div>

                          <p style={{ fontSize: "14px", color: "#71717a", margin: "0 0 12px 0" }}>
                            Current: ${(wig.currentValue / 1000000).toFixed(1)}M |
                            Target: ${(wig.toValue / 1000000).toFixed(1)}M |
                            Progress: {Math.round(progressPercent * 100)}%
                          </p>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ flex: 1, height: "8px", backgroundColor: "#e0e2e6", borderRadius: "4px" }}>
                              <div style={{
                                height: "100%",
                                backgroundColor: "#f59e0b",
                                width: `${Math.min(progressPercent * 100, 100)}%`,
                                borderRadius: "4px"
                              }} />
                            </div>
                            <div style={{
                              width: "2px",
                              height: "12px",
                              backgroundColor: "#71717a",
                              position: "relative",
                              left: `${midpoint * 100}%`,
                              transform: "translateX(-50%)",
                            }} />
                            <span style={{ fontSize: "12px", fontWeight: 500, color: "#71717a", minWidth: "60px" }}>
                              Midpoint
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
