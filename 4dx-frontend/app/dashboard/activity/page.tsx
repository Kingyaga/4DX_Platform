"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
import { useWIGs, useLogActivity, useActivityLogsByUser, useEditActivity } from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { useUserStore } from "@/lib/stores/user-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { LoadingSpinner } from "@/lib/components/loading-spinner";
import type { LeadMeasure, ActivityLogEntry } from "@/lib/types";

type AggregatedActivityLog = ActivityLogEntry & {
  leadMeasureId: string;
  leadMeasureName: string;
  wigTitle: string;
};

export default function ActivityLogPage() {
  const { currentTeamSlug } = useTeamStore();
  const { user } = useUserStore();
  const userId = user?.id;
  const { wigs, isLoading, error } = useWIGs(currentTeamSlug);
  const { logActivity, isLoading: isSubmitting, error: submitError } = useLogActivity();
  const { activityLogs: myAllLogs } = useActivityLogsByUser(userId ?? null);
  const { editActivity } = useEditActivity();

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [selectedLeadMeasureId, setSelectedLeadMeasureId] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState<string>("");
  const [activityLogs, setActivityLogs] = useState<AggregatedActivityLog[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsRefreshIndex, setLogsRefreshIndex] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const PREVIEW_COUNT = 10;

  const allLeadMeasures = useMemo(() =>
    (wigs as any[]).flatMap((wig) =>
      (wig.leadMeasures || [])
        .filter((lm: LeadMeasure) => {
          const approvedTotal = (lm.activityLogs || [])
            .filter((log) => log.status === "APPROVED")
            .reduce((sum, log) => sum + log.value, 0);

          return (
            wig.status === "ACTIVE" &&
            approvedTotal < lm.targetValue &&
            (!userId || (lm.owners || []).some((owner) => owner.userId === userId))
          );
        })
        .map((lm: LeadMeasure) => ({ id: lm.id, name: lm.name, wigTitle: wig.title, unit: (lm as any).unit || "" })),
    ), [wigs, userId]
  );

  const selectedLM = allLeadMeasures.find((lm) => lm.id === selectedLeadMeasureId);
  const selectedUnit = selectedLM?.unit && selectedLM.unit.toLowerCase() !== "none" ? selectedLM.unit : "";

  const hasLeadMeasures = allLeadMeasures.length > 0;

  // Set default selected lead measure when data loads
  useEffect(() => {
    const selectionStillAvailable = allLeadMeasures.some((lm) => lm.id === selectedLeadMeasureId);

    if (hasLeadMeasures && (!selectedLeadMeasureId || !selectionStillAvailable)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedLeadMeasureId(allLeadMeasures[0].id);
    }
    if (!hasLeadMeasures && selectedLeadMeasureId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedLeadMeasureId("");
    }
  }, [allLeadMeasures, hasLeadMeasures, selectedLeadMeasureId]);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 7000);

    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Extract activity logs from WIGs data
  useEffect(() => {
    if (!wigs.length) {
      setActivityLogs([]);
      setLogsError(null);
      return;
    }

    try {
      const loadedLogs: AggregatedActivityLog[] = [];

      for (const wig of wigs as any[]) {
        for (const lm of (wig.leadMeasures || []) as any[]) {
          // Activity logs might not be included in the response depending on backend query
          const logs = lm.activityLogs;
          if (logs && Array.isArray(logs)) {
            const aggregatedLogs = logs
              .filter((log: ActivityLogEntry) => (log as any).userId === userId)
              .map((log: ActivityLogEntry) => ({
                ...log,
                leadMeasureId: lm.id,
                leadMeasureName: lm.name,
                wigTitle: wig.title,
                unit: lm.unit,
              }));
            loadedLogs.push(...aggregatedLogs);
          }
        }
      }

      setActivityLogs(loadedLogs);
      setLogsError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unable to load activity logs.";
      setLogsError(errorMessage);
    }
  }, [wigs, logsRefreshIndex, userId]);

  const pendingLogs = (myAllLogs as any[]).filter((log: any) => log.status === "PENDING");

  const sortedLogs = [...activityLogs].sort((a: AggregatedActivityLog, b: AggregatedActivityLog) =>
    new Date(b.loggedForDate).getTime() - new Date(a.loggedForDate).getTime(),
  );
  const visibleLogs = showAllLogs ? sortedLogs : sortedLogs.slice(0, PREVIEW_COUNT);

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

      setSuccessMessage("Your request has been sent, awaiting confirmation.");
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

        {successMessage && (
          <div style={{ padding: "16px", borderRadius: "16px", backgroundColor: "#ecfdf5", color: "#166534", fontWeight: 600, marginBottom: "16px" }}>
            {successMessage}
          </div>
        )}

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
                disabled={isLoading || !hasLeadMeasures}
                style={{ width: "100%", height: "48px", padding: "0 16px", border: "1px solid #e4e4e7", backgroundColor: isLoading || !hasLeadMeasures ? "#f4f4f5" : "#ffffff", fontSize: "16px", color: "#18181b", outline: "none", borderRadius: "0", appearance: "none", cursor: isLoading || !hasLeadMeasures ? "not-allowed" : "pointer" }}
              >
                <option value="" disabled>
                  {isLoading ? "Loading lead measures..." : hasLeadMeasures ? "Select a lead measure" : "No lead measures available"}
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
                Value{selectedUnit ? ` (${selectedUnit})` : ""}
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

          {!hasLeadMeasures && (
            <div style={{ padding: "12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", fontSize: "14px", borderRadius: "4px" }}>
              You do not own any lead measures on this team yet. Ask your team lead to assign you before submitting activity.
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading || !hasLeadMeasures || !selectedLeadMeasureId || !value}
            style={{ height: "56px", width: "100%", backgroundColor: isSubmitting || isLoading || !hasLeadMeasures ? "#a1a1a1" : "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", border: "none", cursor: isSubmitting || isLoading || !hasLeadMeasures ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginTop: "16px" }}
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
          {pendingLogs.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a", marginBottom: "12px" }}>
                Awaiting Approval ({pendingLogs.length})
              </h3>
              {pendingLogs.map((log: any) => {
                const isEditable = currentTime - new Date(log.createdAt).getTime() < 24 * 60 * 60 * 1000;
                return (
                  <div key={log.id} style={{ marginBottom: "8px" }}>
                    <div style={{ padding: "12px 16px", border: "1px solid #e4e4e7", backgroundColor: "#fffbeb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#18181b" }}>{log.leadMeasure?.name ?? "Lead Measure"}</span>
                        <span style={{ fontSize: "12px", color: "#71717a", marginLeft: "8px" }}>{new Date(log.loggedForDate).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#18181b" }}>{log.value} {log.leadMeasure?.unit ?? ""}</span>
                        <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#B45309", backgroundColor: "#FEF3C7", padding: "2px 8px", borderRadius: "4px" }}>Pending</span>
                        {isEditable && (
                          <button
                            onClick={() => { setEditingLogId(log.id); setEditValue(String(log.value)); setEditNote(log.note ?? ""); }}
                            style={{ fontSize: "12px", color: "#71717a", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {editingLogId === log.id && (
                      <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center", padding: "8px 16px", border: "1px solid #e4e4e7", backgroundColor: "#f8fafc" }}>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          style={{ width: "80px", padding: "4px 8px", border: "1px solid #e4e4e7", fontSize: "13px" }}
                        />
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Note (optional)"
                          style={{ flex: 1, padding: "4px 8px", border: "1px solid #e4e4e7", fontSize: "13px" }}
                        />
                        <button
                          onClick={async () => {
                            try {
                              await editActivity({ logId: log.id, value: parseFloat(editValue), note: editNote || undefined });
                              setEditingLogId(null);
                            } catch {}
                          }}
                          style={{ padding: "4px 12px", backgroundColor: "#18181b", color: "#fff", border: "none", fontSize: "12px", cursor: "pointer" }}
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingLogId(null)} style={{ padding: "4px 12px", border: "1px solid #e4e4e7", background: "none", fontSize: "12px", cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", marginBottom: "24px", paddingBottom: "8px", borderBottom: "1px solid #e4e4e7" }}>
            Recent Logs
          </h2>

          {isLoading ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <LoadingSpinner size="medium" text="Loading activity history..." />
            </div>
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
                  {visibleLogs.map((log, i) => (
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

          {sortedLogs.length > PREVIEW_COUNT && (
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => setShowAllLogs((v) => !v)}
                style={{ padding: "8px 24px", border: "1px solid #e4e4e7", backgroundColor: "transparent", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", color: "#18181b" }}
              >
                {showAllLogs ? "Show Less" : `View All ${sortedLogs.length} Logs`}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
