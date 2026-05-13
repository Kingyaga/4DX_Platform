"use client";

import { useState } from "react";
import { useWIGs } from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { LoadingSpinner } from "@/lib/components/loading-spinner";
import type { WIG, LeadMeasure, ActivityLogEntry } from "@/lib/types";

export default function ScoreboardPage() {
  const { currentTeamSlug } = useTeamStore();
  const { wigs, isLoading, error } = useWIGs(currentTeamSlug);
  const [selectedWigId, setSelectedWigId] = useState<string>("");

  // Auto-select first WIG when data loads
  const selected = selectedWigId ? (wigs as any[]).find((w) => w.id === selectedWigId) : wigs[0];

  // Helper: compute status color based on progress
  const getStatusColor = (current: number, target: number, baseline: number): string => {
    const progress = (current - baseline) / (target - baseline);
    if (progress >= 0.9) return "#16A34A"; // On Track
    if (progress >= 0.7) return "#84cc16"; // Good Progress
    if (progress >= 0.5) return "#EAB308"; // At Risk
    return "#ba1a1a"; // Off Track
  };

  // Helper: format numbers with $ or unit
  const formatValue = (value: number, unit: string): string => {
    if (unit === "$") return `$${value.toLocaleString()}`;
    return `${value}${unit}`;
  };

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: "32px", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em", textTransform: "uppercase" }}>Scoreboard</h1>
        <p style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>Track WIG and lead measure performance in real time.</p>
      </div>

      {/* Error State */}
      {error && <ErrorState error={error} onRetry={() => window.location.reload()} />}

      {/* Loading State */}
      {isLoading && (
        <LoadingSpinner size="large" text="" className="min-h-[420px] flex items-center justify-center" />
      )}

      {/* Empty State */}
      {!isLoading && !error && wigs.length === 0 && (
        <EmptyState title="No WIGs yet" description="Create a WIG to start tracking performance." />
      )}

      {/* Content */}
      {!isLoading && !error && selected && (
        <>
          {/* WIG Selector Tabs */}
          <div style={{ display: "flex", gap: "0", marginBottom: "32px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", overflowX: "auto" }}>
            {(wigs as any[]).map((wig) => {
              const statusColor = getStatusColor(wig.currentValue, wig.toValue, wig.fromValue);
              return (
                <button
                  key={wig.id}
                  onClick={() => setSelectedWigId(wig.id)}
                  style={{
                    padding: "16px 20px",
                    border: "none",
                    borderRight: "1px solid #e4e4e7",
                    backgroundColor: selected.id === wig.id ? "#18181b" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    minWidth: "200px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: statusColor, display: "inline-block" }}></span>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: selected.id === wig.id ? "#ffffff" : "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {wig.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: selected.id === wig.id ? "#ffffff" : "#18181b", lineHeight: "1.3" }}>{wig.title}</div>
                </button>
              );
            })}
          </div>

          {/* Lag Measure */}
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "24px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "8px" }}>Lag Measure Progress</span>
                <span style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.03em", color: "#18181b" }}>
                  {formatValue(selected.currentValue, selected.unit)}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "8px" }}>Target</span>
                <span style={{ fontSize: "20px", fontWeight: 600, color: "#18181b" }}>
                  {formatValue(selected.toValue, selected.unit)}
                </span>
              </div>
            </div>
            <div style={{ width: "100%", height: "8px", backgroundColor: "#e4e4e7", marginBottom: "8px", position: "relative" }}>
              <div
                style={{
                  height: "100%",
                  backgroundColor: getStatusColor(selected.currentValue, selected.toValue, selected.fromValue),
                  width: `${((selected.currentValue - selected.fromValue) / (selected.toValue - selected.fromValue)) * 100}%`,
                }}
              ></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#71717a" }}>
              <span>Baseline: {formatValue(selected.fromValue, selected.unit)}</span>
              <span>Deadline: {new Date(selected.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
          </div>

          {/* Lead Measures */}
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", marginBottom: "16px" }}>Lead Measures</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {selected.leadMeasures.map((lm: LeadMeasure, i: number) => {
              // Get last 6 activity logs
              const recentLogs = (lm.activityLogs || []).slice(0, 6).reverse();
              const trend = recentLogs.map((log: ActivityLogEntry) => log.value);
              const current = (lm.activityLogs || []).length > 0 ? (lm.activityLogs || [])[0].value : 0;
              const onTrack = current >= lm.targetValue;
              const pct = Math.min(100, Math.round((current / lm.targetValue) * 100));

              return (
                <div key={lm.id} style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "4px" }}>Lead Measure {i + 1}</span>
                      <span style={{ fontSize: "16px", fontWeight: 500, color: "#18181b" }}>{lm.name}</span>
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: onTrack ? "#16A34A" : "#ba1a1a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {onTrack ? "On Track" : "Behind"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 700, color: "#18181b", letterSpacing: "-0.03em" }}>{current}</span>
                    <span style={{ fontSize: "16px", color: "#71717a", marginBottom: "6px" }}>/ {lm.targetValue}</span>
                  </div>

                  <div style={{ width: "100%", height: "4px", backgroundColor: "#e4e4e7", marginBottom: "16px" }}>
                    <div style={{ height: "100%", backgroundColor: "#18181b", width: `${pct}%` }}></div>
                  </div>

                  {/* Mini sparkline */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "40px" }}>
                    {trend.length > 0 ? (
                      trend.map((val: number, j: number) => {
                        const maxVal = Math.max(...trend);
                        const height = Math.max(4, (val / maxVal) * 40);
                        return (
                          <div
                            key={j}
                            style={{
                              flex: 1,
                              height: `${height}px`,
                              backgroundColor: j === trend.length - 1 ? "#18181b" : "#e4e4e7",
                              transition: "height 0.2s",
                            }}
                          ></div>
                        );
                      })
                    ) : (
                      <div style={{ flex: 1, height: "4px", backgroundColor: "#e4e4e7" }}></div>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                    <span style={{ fontSize: "11px", color: "#71717a" }}>{trend.length > 1 ? `${trend.length} weeks ago` : "This week"}</span>
                    <span style={{ fontSize: "11px", color: "#71717a" }}>This week</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

    </main>
  );
}
