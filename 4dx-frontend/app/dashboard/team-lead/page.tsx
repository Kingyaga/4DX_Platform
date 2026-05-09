"use client";

import { useEffect, useMemo } from "react";
import { useTeamStore } from "@/lib/stores/team-store";
import { useWIGs, useCurrentSessions } from "@/lib/hooks";
import { ErrorState, EmptyState } from "@/lib/components/states";
import Link from "next/link";

export default function TeamLeadPage() {
  const { currentTeamSlug } = useTeamStore();
  const { wigs, isLoading: wigsLoading, error: wigsError } = useWIGs(currentTeamSlug);
  const { sessions, isLoading: sessionsLoading, error: sessionsError } = useCurrentSessions(currentTeamSlug);

  const isLoading = wigsLoading || sessionsLoading;
  const error = wigsError || sessionsError;

  if (error) return <ErrorState error={error} />;
  if (isLoading) {
    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <div style={{ textAlign: "center", color: "#71717a" }}>Loading team dashboard...</div>
      </main>
    );
  }

  if (!currentTeamSlug) {
    return <EmptyState title="No team selected" description="Select a team from the sidebar" />;
  }

  // Compute metrics
  const totalWIGs = wigs.length;
  const activeWIGs = wigs.filter((w: any) => w.status === "ACTIVE").length;

  const allLeadMeasures = wigs.flatMap((w: any) => w.leadMeasures || []);
  const onTrackCount = allLeadMeasures.filter((lm: any) => (lm.activityLogs?.[0]?.value || 0) >= lm.targetValue).length;
  const executionScore = allLeadMeasures.length > 0 ? Math.round((onTrackCount / allLeadMeasures.length) * 100) : 0;

  const weekBars = useMemo(() =>
    Array.from({ length: 6 }).map((_, i) => ({
      label: `W${i + 1}`,
      value: 40 + ((i * 15 + Math.sin(i) * 25) % 60),
    })),
    []
  );

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", margin: "0 0 8px 0" }}>Team Dashboard</h1>
          <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>Manage WIGs and lead measures for your team</p>
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

        {/* Trend Chart Placeholder */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "20px", backgroundColor: "white" }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>6-Week Trend</h2>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: "160px", gap: "8px" }}>
            {weekBars.map((bar: any, i: number) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flex: 1 }}>
                <div style={{ width: "100%", height: `${bar.value}%`, backgroundColor: "#3b82f6", borderRadius: "4px 4px 0 0" }} />
                <span style={{ fontSize: "12px", fontWeight: "500", color: "#71717a" }}>{bar.label}</span>
              </div>
            ))}
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

          {wigs.length === 0 ? (
            <p style={{ margin: 0, color: "#a1a1aa", fontSize: "14px" }}>No WIGs yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {wigs.slice(0, 5).map((wig: any) => (
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
                      {wig.currentValue || 0} / {wig.toValue}
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
                    {Math.round(((wig.currentValue || 0) / wig.toValue) * 100)}%
                  </div>
                </div>
              ))}
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
            href="/dashboard/activity"
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
            Activity Log
          </Link>
          <Link
            href="/dashboard/session"
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
            Team Sessions
          </Link>
        </div>
      </div>
    </main>
  );
}
