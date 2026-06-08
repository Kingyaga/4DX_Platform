"use client";

import { useState, useEffect } from "react";
import { useWIGs } from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { LoadingSpinner } from "@/lib/components/loading-spinner";
import type { LeadMeasure, ActivityLogEntry } from "@/lib/types";
import { getLeadMeasureApprovedTotal, getLeadMeasureProgress, getLatestProgressStatus, getWigProgress, isProgressStatusLeadMeasure } from "@/lib/metrics";

export default function ScoreboardPage() {
  const { currentTeamSlug } = useTeamStore();
  const { wigs, isLoading, error } = useWIGs(currentTeamSlug);
  const [selectedWigId, setSelectedWigId] = useState<string>("");
  const [displayMode, setDisplayMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    // Local countdown clock only; data refetch polling is intentionally disabled.
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Enter/exit display mode with Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDisplayMode(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const activeWigs = (wigs as any[]).filter((wig) => wig.status === "ACTIVE" && !wig.archivedAt);
  const selected = selectedWigId ? activeWigs.find((w) => w.id === selectedWigId) : activeWigs[0];

  // Days remaining to deadline
  const daysRemaining = selected
    ? Math.max(0, Math.ceil((new Date(selected.deadline).getTime() - currentTime) / 86_400_000))
    : 0;

  const getStatusColor = (progressPercent: number): string => {
    const progress = progressPercent / 100;
    if (progress >= 0.9) return "#16A34A";
    if (progress >= 0.7) return "#84cc16";
    if (progress >= 0.5) return "#EAB308";
    return "#ba1a1a";
  };

  // Render the core scoreboard content (reused in both normal and display modes)
  const renderContent = (isDark: boolean = false) => {
    const cardBg = isDark ? "#18181b" : "#ffffff";
    const cardBorder = isDark ? "1px solid #3f3f46" : "1px solid #e4e4e7";
    const headingColor = isDark ? "#ffffff" : "#18181b";
    const secondaryColor = isDark ? "#a1a1aa" : "#71717a";
    const bodyTextColor = isDark ? "#d4d4d8" : "#52525b";
    const completionScore = getWigProgress(selected);

    return (
      <>
        {/* WIG Selector Tabs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "32px" }}>
          {activeWigs.map((wig) => {
            const wigScore = getWigProgress(wig);
            const statusColor = getStatusColor(wigScore);
            return (
              <button
                key={wig.id}
                onClick={() => setSelectedWigId(wig.id)}
                style={{
                  padding: "16px 20px",
                  border: selected.id === wig.id ? "1px solid #18181b" : cardBorder,
                  borderRadius: "8px",
                  backgroundColor: selected.id === wig.id ? "#18181b" : cardBg,
                  cursor: "pointer",
                  textAlign: "left",
                  minWidth: "200px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: statusColor, display: "inline-block" }}></span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: selected.id === wig.id ? "#ffffff" : secondaryColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {wig.status}
                  </span>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: selected.id === wig.id ? "#ffffff" : headingColor, lineHeight: "1.3" }}>{wig.title}</div>
                <div style={{ marginTop: "10px", fontSize: "12px", color: selected.id === wig.id ? "#d4d4d8" : secondaryColor }}>
                  {wigScore}% lead measure score
                </div>
              </button>
            );
          })}
        </div>

        {/* Lead measures complete banner */}
        {completionScore >= 100 && (
          <div style={{ marginBottom: "20px", padding: "16px 20px", backgroundColor: "#fffbeb", border: "1px solid #f59e0b", display: "flex", alignItems: "center", gap: "12px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "#f59e0b" }}>emoji_events</span>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#92400e" }}>Lead Measures Complete!</div>
              <div style={{ fontSize: "13px", color: "#92400e", marginTop: "2px" }}>
                This WIG&apos;s lead measures are complete. The team lead can now close it as <strong>ACHIEVED</strong> from the WIGs page.
              </div>
            </div>
          </div>
        )}

        {/* Lag Measure */}
        <div style={{ backgroundColor: cardBg, border: cardBorder, padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "16px" }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: secondaryColor, display: "block", marginBottom: "8px" }}>Lag Measure Progress</span>
              <span style={{ fontSize: isDark ? "48px" : "32px", fontWeight: 700, letterSpacing: "-0.03em", color: headingColor }}>
                {completionScore}%
              </span>
              <span style={{ fontSize: "12px", color: secondaryColor, display: "block", marginTop: "4px" }}>
                lead measure completion score
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: secondaryColor, display: "block", marginBottom: "8px" }}>WIG Completion</span>
              <span style={{ fontSize: "20px", fontWeight: 600, color: headingColor }}>
                {completionScore}% complete
              </span>
              <span style={{ fontSize: "12px", color: secondaryColor, display: "block", marginTop: "4px" }}>
                {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
              </span>
            </div>
          </div>
          <div style={{ width: "100%", height: "8px", backgroundColor: isDark ? "#3f3f46" : "#e4e4e7", marginBottom: "8px", position: "relative" }}>
            <div
              style={{
                height: "100%",
                backgroundColor: getStatusColor(completionScore),
                width: `${completionScore}%`,
              }}
            ></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: secondaryColor }}>
            <span>{selected.leadMeasures.length} lead measure{selected.leadMeasures.length === 1 ? "" : "s"}</span>
            <span>Deadline: {new Date(selected.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          <p style={{ fontSize: "12px", color: secondaryColor, marginTop: "8px", fontStyle: "italic" }}>
            Progress reflects approved activity only. Pending logs appear on your Activity page.
          </p>
        </div>

        {/* Lead Measures */}
        <h2 style={{ fontSize: "20px", fontWeight: 600, color: headingColor, marginBottom: "16px" }}>Lead Measures</h2>
        <div style={{ display: "grid", gridTemplateColumns: isDark ? "1fr 1fr 1fr" : "1fr 1fr", gap: "16px" }}>
          {selected.leadMeasures.map((lm: LeadMeasure, i: number) => {
            const recentLogs = (lm.activityLogs || []).slice(0, 6).reverse();
            const trend = recentLogs.map((log: ActivityLogEntry) => log.value ?? 0);
            // Cumulative total of all approved activity (correct 4DX lead measure tracking)
            const current = getLeadMeasureApprovedTotal(lm);
            const pct = getLeadMeasureProgress(lm);
            const onTrack = pct >= 100;
            const latestStatus = getLatestProgressStatus(lm);

            // Group activity logs by owner for per-owner contribution
            const ownerContributions: Record<string, { name: string; total: number }> = {};
            for (const log of (lm.activityLogs || []) as any[]) {
              if (!log.userId) continue;
              const ownerName = log.user?.name || log.user?.email || log.userId;
              if (!ownerContributions[log.userId]) {
                ownerContributions[log.userId] = { name: ownerName, total: 0 };
              }
              ownerContributions[log.userId].total += isProgressStatusLeadMeasure(lm.trackingType) ? 1 : (log.value ?? 0);
            }
            const ownerList = Object.values(ownerContributions).sort((a, b) => b.total - a.total);

            return (
              <div key={lm.id} style={{ backgroundColor: cardBg, border: cardBorder, padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div>
                    <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: secondaryColor, display: "block", marginBottom: "4px" }}>Lead Measure {i + 1}</span>
                    <span style={{ fontSize: "16px", fontWeight: 500, color: headingColor }}>{lm.name}</span>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: onTrack ? "#16A34A" : "#ba1a1a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {onTrack ? "Completed" : isProgressStatusLeadMeasure(lm.trackingType) ? latestStatus?.replace(/_/g, " ") || "Pending" : "Behind"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "12px" }}>
                  <span style={{ fontSize: isDark ? "40px" : "32px", fontWeight: 700, color: headingColor, letterSpacing: "-0.03em" }}>
                    {isProgressStatusLeadMeasure(lm.trackingType) ? `${pct}%` : current}
                  </span>
                  <span style={{ fontSize: "16px", color: secondaryColor, marginBottom: "6px" }}>
                    {isProgressStatusLeadMeasure(lm.trackingType) ? latestStatus?.replace(/_/g, " ") || "No update" : `/ ${lm.targetValue ?? 0} ${lm.unit ?? ""}`}
                  </span>
                </div>

                <div style={{ width: "100%", height: "4px", backgroundColor: isDark ? "#3f3f46" : "#e4e4e7", marginBottom: "16px" }}>
                  <div style={{ height: "100%", backgroundColor: isDark ? "#a1a1aa" : "#18181b", width: `${pct}%` }}></div>
                </div>

                {onTrack && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", marginBottom: "16px", border: "1px solid #16A34A", backgroundColor: isDark ? "#052e16" : "#f0fdf4", color: "#16A34A", fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>check_circle</span>
                    Completed
                  </div>
                )}

                {/* Per-owner contribution breakdown */}
                {ownerList.length > 0 && (
                  <div style={{ marginBottom: "16px", borderTop: `1px solid ${isDark ? "#3f3f46" : "#f4f4f5"}`, paddingTop: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: secondaryColor, display: "block", marginBottom: "8px" }}>By Owner</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {ownerList.map((owner) => (
                        <div key={owner.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", color: bodyTextColor }}>{owner.name}</span>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: headingColor }}>{isProgressStatusLeadMeasure(lm.trackingType) ? `${owner.total} update${owner.total !== 1 ? "s" : ""}` : `${owner.total.toFixed(1)} ${lm.unit ?? ""}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                            backgroundColor: j === trend.length - 1 ? (isDark ? "#ffffff" : "#18181b") : (isDark ? "#3f3f46" : "#e4e4e7"),
                            transition: "height 0.2s",
                          }}
                        ></div>
                      );
                    })
                  ) : (
                    <div style={{ flex: 1, height: "4px", backgroundColor: isDark ? "#3f3f46" : "#e4e4e7" }}></div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  <span style={{ fontSize: "11px", color: secondaryColor }}>{trend.length > 1 ? `${trend.length} weeks ago` : "This week"}</span>
                  <span style={{ fontSize: "11px", color: secondaryColor }}>This week</span>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // Display Mode — full-screen, no sidebar/header
  if (displayMode) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "#0a0a0a",
          color: "#ffffff",
          zIndex: 9999,
          overflowY: "auto",
          padding: "40px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em", textTransform: "uppercase", margin: 0 }}>
              SCOREBOARD
            </h1>
            <p style={{ fontSize: "13px", color: "#71717a", marginTop: "4px" }}>Live — updates every 60 seconds</p>
          </div>
          <button
            onClick={() => setDisplayMode(false)}
            style={{
              backgroundColor: "transparent",
              border: "1px solid #3f3f46",
              color: "#a1a1aa",
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close_fullscreen</span>
            Exit (Esc)
          </button>
        </div>
        {renderContent(true)}
      </div>
    );
  }

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: "32px", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em", textTransform: "uppercase" }}>Scoreboard</h1>
          <p style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>Track WIG and lead measure performance in real time.</p>
        </div>
        {!isLoading && !error && selected && (
          <button
            onClick={() => setDisplayMode(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#18181b",
              color: "#ffffff",
              border: "none",
              padding: "10px 16px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>open_in_full</span>
            Display Mode
          </button>
        )}
      </div>

      {/* Error State */}
      {error && <ErrorState error={error} onRetry={() => window.location.reload()} />}

      {/* Loading State */}
      {isLoading && (
        <LoadingSpinner size="xlarge" text="" className="min-h-[520px] flex items-center justify-center" />
      )}

      {/* Empty State */}
      {!isLoading && !error && activeWigs.length === 0 && (
        <EmptyState title="No active WIGs yet" description="Activate a WIG to start tracking scoreboard performance." />
      )}

      {/* Content */}
      {!isLoading && !error && selected && renderContent(false)}

    </main>
  );
}
