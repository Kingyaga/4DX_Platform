"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
import { trpcClient } from "@/lib/trpc";
import { useWIGs, useLogActivity } from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import type { WIG, LeadMeasure, ActivityLogEntry } from "@/lib/types";

type AggregatedActivityLog = ActivityLogEntry & {
  leadMeasureId: string;
  leadMeasureName: string;
  wigTitle: string;
};

export default function ActivityLogPage() {
  const { currentTeamSlug } = useTeamStore();
  const { wigs, isLoading, error } = useWIGs(currentTeamSlug);
  const { logActivity, isLoading: isSubmitting, error: submitError } = useLogActivity();

  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [selectedLeadMeasureId, setSelectedLeadMeasureId] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState<string>("");
  const [activityLogs, setActivityLogs] = useState<AggregatedActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsRefreshIndex, setLogsRefreshIndex] = useState(0);

  const allLeadMeasures = useMemo(() =>
    wigs.flatMap((wig: WIG) =>
      wig.leadMeasures.map((lm: LeadMeasure) => ({ id: lm.id, name: lm.name, wigTitle: wig.title })),
    ), [wigs]
  );

  // Set default selected lead measure when data loads
  useEffect(() => {
    if (!selectedLeadMeasureId && allLeadMeasures.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedLeadMeasureId(allLeadMeasures[0].id);
    }
  }, [allLeadMeasures, selectedLeadMeasureId]);

  useEffect(() => {
    if (!allLeadMeasures.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivityLogs([]);
      setLogsError(null);
      return;
    }

    let canceled = false;

    const loadLogs = async () => {
      setLogsLoading(true);
      setLogsError(null);

      try {
        const loadedLogs: AggregatedActivityLog[] = [];

        for (const wig of wigs) {
          for (const lm of wig.leadMeasures) {
            const logs = await trpcClient.activityLogs.getByLeadMeasure.query({ leadMeasureId: lm.id });
            const aggregatedLogs = logs.map((log: ActivityLogEntry) => ({
              ...log,
              leadMeasureId: lm.id,
              leadMeasureName: lm.name,
              wigTitle: wig.title,
            }));
            loadedLogs.push(...aggregatedLogs);
          }
        }

        if (!canceled) {
          setActivityLogs(loadedLogs);
        }
      } catch (err: unknown) {
        if (!canceled) {
          const errorMessage = err instanceof Error ? err.message : "Unable to load activity logs.";
          setLogsError(errorMessage);
        }
      } finally {
        if (!canceled) {
          setLogsLoading(false);
        }
      }
    };

    loadLogs();

    return () => {
      canceled = true;
    };
  }, [allLeadMeasures, logsRefreshIndex, wigs]);

  const sortedLogs = [...activityLogs].sort((a: AggregatedActivityLog, b: AggregatedActivityLog) =>
    new Date(b.loggedForDate).getTime() - new Date(a.loggedForDate).getTime(),
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentTeamSlug || !selectedLeadMeasureId || !value || !logDate) return;

    try {
      await logActivity({
        leadMeasureId: selectedLeadMeasureId,
        value: parseFloat(value),
        loggedForDate: new Date(logDate),
        note: note || undefined,
      });

      setSelectedLeadMeasureId("");
      setValue("");
      setLogDate(new Date().toISOString().split("T")[0]);
      setNote("");
      setLogsRefreshIndex((current) => current + 1);
    } catch {
      // error handled inside hook
    }
  };

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em", textTransform: "uppercase" }}>Activity Log</h1>
          <p style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>
            Submit activity as a request. Your team lead must approve it before the log appears on the scoreboard.
          </p>
        </div>
        {error && <ErrorState error={error} onRetry={() => window.location.reload()} />}

        <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "560px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "20px", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ paddingBottom: "16px", borderBottom: "1px solid #e4e4e7" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em" }}>Record Execution</h2>
            <p style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>Log your lead measure performance to update the scoreboard instantly.</p>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b", display: "block", marginBottom: "8px" }}>
              Lead Measure
            </label>
            <div style={{ position: "relative" }}>
              <select
                value={selectedLeadMeasureId}
                onChange={(e) => setSelectedLeadMeasureId(e.target.value)}
                disabled={isLoading}
                style={{ width: "100%", height: "48px", padding: "0 16px", border: "1px solid #e4e4e7", backgroundColor: isLoading ? "#f4f4f5" : "#ffffff", fontSize: "16px", color: "#18181b", outline: "none", borderRadius: "0", appearance: "none", cursor: isLoading ? "not-allowed" : "pointer" }}
              >
                <option value="">
                  {isLoading ? "Loading lead measures..." : "Select a lead measure"}
                </option>
                {allLeadMeasures.map((lm) => (
                  <option key={lm.id} value={lm.id}>
                    {lm.name} ({lm.wigTitle})
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#71717a" }}>
                arrow_drop_down
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b", display: "block", marginBottom: "8px" }}>
                Numeric Value
              </label>
              <input
                type="number"
                placeholder="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={isSubmitting}
                style={{ width: "100%", height: "48px", padding: "0 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", fontSize: "32px", fontWeight: 700, color: "#18181b", outline: "none", borderRadius: "0", cursor: isSubmitting ? "not-allowed" : "text" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b", display: "block", marginBottom: "8px" }}>
                Date
              </label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                disabled={isSubmitting}
                style={{ width: "100%", height: "48px", padding: "0 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", fontSize: "16px", color: "#18181b", outline: "none", borderRadius: "0", cursor: isSubmitting ? "not-allowed" : "text" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b", display: "block", marginBottom: "8px" }}>
              Optional Note
            </label>
            <textarea
              rows={2}
              placeholder="Context or specific details..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
              style={{ width: "100%", padding: "12px 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", fontSize: "14px", color: "#18181b", outline: "none", borderRadius: "0", resize: "none", fontFamily: "'Inter', sans-serif", cursor: isSubmitting ? "not-allowed" : "text" }}
            />
          </div>

          {(submitError || logsError) && (
            <div style={{ padding: "12px", backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "14px", borderRadius: "4px" }}>
              {submitError?.message || logsError}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading || !selectedLeadMeasureId || !value}
            style={{ height: "56px", width: "100%", backgroundColor: isSubmitting || isLoading ? "#a1a1a1" : "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", border: "none", cursor: isSubmitting || isLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginTop: "16px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
              {isSubmitting ? "hourglass_empty" : "pending_actions"}
            </span>
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "900px", marginTop: "48px", marginBottom: "48px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", marginBottom: "24px", paddingBottom: "8px", borderBottom: "1px solid #e4e4e7" }}>
            Recent Logs
          </h2>

          {logsLoading ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#71717a" }}>Loading activity history...</div>
          ) : sortedLogs.length === 0 ? (
            <EmptyState title="No activity logs yet" description="Start logging lead measure values to build your activity history." />
          ) : (
            <div style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", backgroundColor: "#f4f4f5", borderBottom: "1px solid #e4e4e7", textAlign: "left", width: "180px" }}>
                      Date / Time
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", backgroundColor: "#f4f4f5", borderBottom: "1px solid #e4e4e7", textAlign: "left" }}>
                      Measure
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", backgroundColor: "#f4f4f5", borderBottom: "1px solid #e4e4e7", textAlign: "right", width: "80px" }}>
                      Value
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", backgroundColor: "#f4f4f5", borderBottom: "1px solid #e4e4e7", textAlign: "left" }}>
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLogs.map((log, i) => (
                    <tr
                      key={log.id}
                      style={{ borderBottom: "1px solid #f4f4f5", backgroundColor: hoveredRow === i ? "#f7f9fd" : "transparent", transition: "background 0.075s" }}
                      onMouseEnter={() => setHoveredRow(i)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td style={{ padding: "16px", fontSize: "13px", color: "#18181b", whiteSpace: "nowrap" }}>
                        {new Date(log.loggedForDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", color: "#18181b", fontWeight: 500 }}>
                        {log.leadMeasureName}
                      </td>
                      <td style={{ padding: "16px", fontSize: "16px", color: "#18181b", fontWeight: 700, textAlign: "right" }}>
                        {log.value}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", color: "#71717a", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.note || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sortedLogs.length > 0 && (
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "center" }}>
              <button style={{ padding: "8px 24px", border: "1px solid #e4e4e7", backgroundColor: "transparent", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", color: "#18181b" }}>
                View Full History
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
