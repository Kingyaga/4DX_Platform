"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
import { useWIGs, useLogActivity, useActivityLogsByUser, useEditActivity } from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { useUserStore } from "@/lib/stores/user-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { LoadingSpinner } from "@/lib/components/loading-spinner";
import type { LeadMeasure, ActivityLogEntry, ActivityProgressStatus, TrackingType } from "@/lib/types";

type AggregatedActivityLog = ActivityLogEntry & {
  leadMeasureId: string;
  leadMeasureName: string;
  wigTitle: string;
  unit?: string | null;
  trackingType?: TrackingType;
};

type MinimalWig = { id: string; title?: string; status?: string; leadMeasures?: LeadMeasure[] };

function isNumericLike(trackingType?: TrackingType) {
  return trackingType === "NUMERIC" || trackingType === "PERCENTAGE" || trackingType === "DURATION";
}

function isStatusDriven(trackingType?: TrackingType) {
  return !isNumericLike(trackingType);
}

function formatActivityValue(log: {
  value?: number | null;
  valueJson?: unknown;
  progressStatus?: ActivityProgressStatus | null;
  trackingType?: TrackingType;
  unit?: string | null;
  note?: string | null;
}): string {
  const trackingType = log.trackingType || "NUMERIC";
  const payload = (typeof log.valueJson === "object" && log.valueJson !== null ? (log.valueJson as Record<string, unknown>) : {}) as Record<string, unknown>;
  if (trackingType === "NUMERIC") return `${log.value ?? 0} ${log.unit ?? ""}`.trim();
  if (trackingType === "PERCENTAGE") return `${log.value ?? payload.value ?? 0}% logged`;
  if (trackingType === "DURATION") return `${log.value ?? payload.minutes ?? 0} min logged`;
  if (trackingType === "BOOLEAN" || trackingType === "COMPLETION" || trackingType === "MILESTONE") {
    return payload.completed || log.progressStatus === "DONE" ? "Completed" : "Not completed";
  }
  if (trackingType === "TIME") return `Completed at ${typeof payload.time === "string" ? payload.time : "selected time"}`;
  if (trackingType === "TEXT" || trackingType === "CUSTOM" || trackingType === "HYBRID") {
    return typeof payload.text === "string" && payload.text.trim().length > 0 ? payload.text : log.note || "Text update";
  }
  if (trackingType === "CHECKLIST") return Array.isArray(payload.items) ? `${payload.items.length} checklist item${payload.items.length === 1 ? "" : "s"} logged` : "Checklist logged";
  return log.progressStatus?.replace(/_/g, " ").toLowerCase() || "Logged";
}

export default function ActivityLogPage() {
  const { currentTeamSlug } = useTeamStore();
  const { user } = useUserStore();
  const { wigs, isLoading, error } = useWIGs(currentTeamSlug);
  const { logActivity, isLoading: isSubmitting, error: submitError } = useLogActivity();
  const { activityLogs: myAllLogs } = useActivityLogsByUser(user?.id ?? null);
  const { editActivity } = useEditActivity();

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [selectedWigId, setSelectedWigId] = useState<string>("");
  const [selectedLeadMeasureId, setSelectedLeadMeasureId] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [booleanValue, setBooleanValue] = useState(true);
  const [timeValue, setTimeValue] = useState("07:00");
  const [textValue, setTextValue] = useState("");
  const [percentageValue, setPercentageValue] = useState("0");
  const [durationValue, setDurationValue] = useState("");
  const [checklistValue, setChecklistValue] = useState("");
  const [progressStatus, setProgressStatus] = useState<ActivityProgressStatus>("IN_PROGRESS");
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState<string>("");
  const [activityLogs, setActivityLogs] = useState<AggregatedActivityLog[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsRefreshIndex, setLogsRefreshIndex] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const PREVIEW_COUNT = 10;
  const userId = user?.id;

  const activeWigs = useMemo(() => ((wigs ?? []) as MinimalWig[]).filter((wig) => wig.status === "ACTIVE"), [wigs]);

  const allLeadMeasures = useMemo(() =>
    activeWigs.flatMap((wig) =>
      (wig.leadMeasures || [])
        .filter((lm) => {
          const approvedTotal = (lm.activityLogs || [])
            .filter((log) => log.status === "APPROVED")
            .reduce((sum, log) => sum + (log.value ?? 0), 0);
          const isComplete = isStatusDriven(lm.trackingType)
            ? (lm.activityLogs || []).some((log) => log.status === "APPROVED" && log.progressStatus === "DONE")
            : approvedTotal >= (lm.targetValue ?? 0);

          return (
            (!selectedWigId || wig.id === selectedWigId) &&
            !isComplete &&
            (!userId || (lm.owners || []).some((owner) => owner.userId === userId))
          );
        })
        .map((lm) => ({ id: lm.id, name: lm.name, wigTitle: wig.title, unit: lm.unit || "", trackingType: lm.trackingType })),
    ), [activeWigs, selectedWigId, userId]
  );

  const selectedLM = allLeadMeasures.find((lm) => lm.id === selectedLeadMeasureId);
  const selectedUnit = selectedLM?.unit && selectedLM.unit.toLowerCase() !== "none" ? selectedLM.unit : "";
  const selectedTrackingType = selectedLM?.trackingType || "NUMERIC";
  const isSelectedNumeric = isNumericLike(selectedTrackingType);

  const hasLeadMeasures = allLeadMeasures.length > 0;

  // Set default selected lead measure when data loads
  useEffect(() => {
    if (activeWigs.length > 0 && (!selectedWigId || !activeWigs.some((wig) => wig.id === selectedWigId))) {
      // Defer state update to avoid synchronous setState within effect
      setTimeout(() => setSelectedWigId(activeWigs[0].id), 0);
      return;
    }

    const selectionStillAvailable = allLeadMeasures.some((lm) => lm.id === selectedLeadMeasureId);

    if (hasLeadMeasures && (!selectedLeadMeasureId || !selectionStillAvailable)) {
      setTimeout(() => setSelectedLeadMeasureId(allLeadMeasures[0].id), 0);
    }
    if (!hasLeadMeasures && selectedLeadMeasureId) {
      setTimeout(() => setSelectedLeadMeasureId(""), 0);
    }
  }, [activeWigs, allLeadMeasures, hasLeadMeasures, selectedLeadMeasureId, selectedWigId]);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 7000);

    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTimeMs(Date.now());

    updateCurrentTime();
    // Local date helper only; this interval does not refetch server data.
    const intervalId = window.setInterval(updateCurrentTime, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  // Extract activity logs from WIGs data
  useEffect(() => {
    if (!Array.isArray(wigs) || wigs.length === 0) {
      // Defer to avoid synchronous setState in effect
      setTimeout(() => {
        setActivityLogs([]);
        setLogsError(null);
      }, 0);
      return;
    }

    try {
      const loadedLogs: AggregatedActivityLog[] = [];

      for (const wig of (wigs as MinimalWig[])) {
        for (const lm of wig.leadMeasures || []) {
          // Activity logs might not be included in the response depending on backend query
          const logs = lm.activityLogs;
          if (logs && Array.isArray(logs)) {
            const aggregatedLogs = logs
              .filter((log: ActivityLogEntry) => log.userId === userId)
              .map((log: ActivityLogEntry) => ({
                ...log,
                leadMeasureId: lm.id,
                leadMeasureName: lm.name,
                wigTitle: wig.title ?? "",
                unit: lm.unit,
                trackingType: lm.trackingType,
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

  const pendingLogs = (Array.isArray(myAllLogs) ? (myAllLogs as ActivityLogEntry[]) : []).filter((log) => log.status === "PENDING");

  const sortedLogs = [...activityLogs].sort((a: AggregatedActivityLog, b: AggregatedActivityLog) =>
    new Date(b.loggedForDate).getTime() - new Date(a.loggedForDate).getTime(),
  );
  const visibleLogs = showAllLogs ? sortedLogs : sortedLogs.slice(0, PREVIEW_COUNT);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentTeamSlug || !selectedLeadMeasureId || !logDate) return;
    if (isSelectedNumeric && !value) return;
    if (selectedTrackingType === "NUMERIC" && Number(value) < 0) return;
    if (selectedTrackingType === "TEXT" && !textValue.trim()) return;
    if (selectedTrackingType === "TIME" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) return;
    if (selectedTrackingType === "PERCENTAGE" && (Number(percentageValue) < 0 || Number(percentageValue) > 100)) return;
    if (selectedTrackingType === "DURATION" && (!durationValue || Number(durationValue) < 0)) return;
    if (selectedTrackingType === "CHECKLIST" && checklistValue.split("\n").map((item) => item.trim()).filter(Boolean).length === 0) return;

    const flexibleValue =
      selectedTrackingType === "BOOLEAN" || selectedTrackingType === "COMPLETION" || selectedTrackingType === "MILESTONE"
        ? booleanValue
        : selectedTrackingType === "TIME"
        ? timeValue
        : selectedTrackingType === "TEXT" || selectedTrackingType === "CUSTOM" || selectedTrackingType === "HYBRID"
        ? textValue
        : selectedTrackingType === "CHECKLIST"
        ? checklistValue.split("\n").map((item) => item.trim()).filter(Boolean)
        : undefined;

    try {
      await logActivity({
        leadMeasureId: selectedLeadMeasureId,
        value: selectedTrackingType === "PERCENTAGE"
          ? parseFloat(percentageValue)
          : selectedTrackingType === "DURATION"
          ? parseFloat(durationValue)
          : selectedTrackingType === "NUMERIC"
          ? parseFloat(value)
          : undefined,
        valueJson: flexibleValue,
        progressStatus: isSelectedNumeric ? undefined : progressStatus,
        loggedForDate: new Date(logDate),
        note: note || undefined,
      });

      setSuccessMessage("Your request has been sent, awaiting confirmation.");
      setSelectedLeadMeasureId("");
      setValue("");
      setBooleanValue(true);
      setTimeValue("07:00");
      setTextValue("");
      setPercentageValue("0");
      setDurationValue("");
      setChecklistValue("");
      setProgressStatus("IN_PROGRESS");
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
              WIG
            </label>
            <div style={{ position: "relative" }}>
              <select
                value={selectedWigId}
                onChange={(e) => {
                  setSelectedWigId(e.target.value);
                  setSelectedLeadMeasureId("");
                }}
                disabled={isLoading || activeWigs.length === 0}
                style={{ width: "100%", height: "48px", padding: "0 16px", border: "1px solid #e4e4e7", backgroundColor: isLoading || activeWigs.length === 0 ? "#f4f4f5" : "#ffffff", fontSize: "16px", color: "#18181b", outline: "none", borderRadius: "0", appearance: "none", cursor: isLoading || activeWigs.length === 0 ? "not-allowed" : "pointer" }}
              >
                <option value="" disabled>
                  {isLoading ? "Loading WIGs..." : activeWigs.length ? "Select a WIG" : "No active WIGs available"}
                </option>
                {activeWigs.map((wig) => (
                  <option key={wig.id} value={wig.id}>
                    {wig.title}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#71717a" }}>
                arrow_drop_down
              </span>
            </div>
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
            {selectedTrackingType === "NUMERIC" ? <div>
              <label style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b", display: "block", marginBottom: "8px" }}>
                Value{selectedUnit ? ` (${selectedUnit})` : ""}
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={value}
                onChange={(e) => setValue(Number(e.target.value) < 0 ? "0" : e.target.value)}
                disabled={isSubmitting}
                style={{ width: "100%", height: "48px", padding: "0 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", fontSize: "32px", fontWeight: 700, color: "#18181b", outline: "none", borderRadius: "0", cursor: isSubmitting ? "not-allowed" : "text" }}
              />
            </div> : selectedTrackingType === "PERCENTAGE" ? <div>
              <label style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b", display: "block", marginBottom: "8px" }}>
                Percentage
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={percentageValue}
                onChange={(e) => setPercentageValue(e.target.value)}
                disabled={isSubmitting}
                style={{ width: "100%", height: "48px", padding: "0 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", fontSize: "24px", fontWeight: 700, color: "#18181b", outline: "none" }}
              />
            </div> : selectedTrackingType === "DURATION" ? <div>
              <label style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b", display: "block", marginBottom: "8px" }}>
                Duration (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                disabled={isSubmitting}
                style={{ width: "100%", height: "48px", padding: "0 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", fontSize: "24px", fontWeight: 700, color: "#18181b", outline: "none" }}
              />
            </div> : selectedTrackingType === "TIME" ? <div>
              <label style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b", display: "block", marginBottom: "8px" }}>
                Completion Time
              </label>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                disabled={isSubmitting}
                style={{ width: "100%", height: "48px", padding: "0 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", fontSize: "18px", color: "#18181b", outline: "none" }}
              />
            </div> : selectedTrackingType === "TEXT" || selectedTrackingType === "CUSTOM" || selectedTrackingType === "HYBRID" ? <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b", display: "block", marginBottom: "8px" }}>
                Update
              </label>
              <textarea
                rows={4}
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                disabled={isSubmitting}
                placeholder="Describe what was completed or learned..."
                style={{ width: "100%", padding: "12px 16px", border: "1px solid #e4e4e7", fontSize: "14px", color: "#18181b", outline: "none", resize: "vertical", fontFamily: "'Inter', sans-serif" }}
              />
            </div> : selectedTrackingType === "CHECKLIST" ? <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b", display: "block", marginBottom: "8px" }}>
                Checklist items
              </label>
              <textarea
                rows={4}
                value={checklistValue}
                onChange={(e) => setChecklistValue(e.target.value)}
                disabled={isSubmitting}
                placeholder={"One completed item per line"}
                style={{ width: "100%", padding: "12px 16px", border: "1px solid #e4e4e7", fontSize: "14px", color: "#18181b", outline: "none", resize: "vertical", fontFamily: "'Inter', sans-serif" }}
              />
            </div> : <div>
              <label style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b", display: "block", marginBottom: "8px" }}>
                Completed
              </label>
              <button
                type="button"
                onClick={() => setBooleanValue((current) => !current)}
                disabled={isSubmitting}
                style={{ width: "100%", height: "48px", border: "1px solid #e4e4e7", backgroundColor: booleanValue ? "#ecfdf5" : "#f8fafc", color: booleanValue ? "#166534" : "#475569", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
              >
                {booleanValue ? "Completed" : "Not completed"}
              </button>
            </div>}
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
              You do not own any active lead measures for the selected WIG. Draft WIGs and inactive lead measures are intentionally hidden here.
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading || !hasLeadMeasures || !selectedLeadMeasureId || (selectedTrackingType === "NUMERIC" && !value)}
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
                const isEditable = currentTimeMs > 0 && currentTimeMs - new Date(log.createdAt).getTime() < 24 * 60 * 60 * 1000;
                return (
                  <div key={log.id} style={{ marginBottom: "8px" }}>
                    <div style={{ padding: "12px 16px", border: "1px solid #e4e4e7", backgroundColor: "#fffbeb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#18181b" }}>{log.leadMeasure?.name ?? "Lead Measure"}</span>
                        <span style={{ fontSize: "12px", color: "#71717a", marginLeft: "8px" }}>{new Date(log.loggedForDate).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#18181b" }}>{formatActivityValue({ ...log, trackingType: log.trackingType || log.leadMeasure?.trackingType, unit: log.leadMeasure?.unit })}</span>
                        <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#B45309", backgroundColor: "#FEF3C7", padding: "2px 8px", borderRadius: "4px" }}>Pending</span>
                        {isEditable && (
                          <button
                            onClick={() => { setEditingLogId(log.id); setEditValue(String(log.value ?? "")); setEditNote(log.note ?? ""); }}
                            style={{ fontSize: "12px", color: "#71717a", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {editingLogId === log.id && (
                      <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center", padding: "8px 16px", border: "1px solid #e4e4e7", backgroundColor: "#f8fafc" }}>
                        {(log.trackingType === "NUMERIC" || log.leadMeasure?.trackingType === "NUMERIC") && (
                          <input
	                            type="number"
	                            min="0"
	                            value={editValue}
	                            onChange={(e) => setEditValue(Number(e.target.value) < 0 ? "0" : e.target.value)}
                            style={{ width: "80px", padding: "4px 8px", border: "1px solid #e4e4e7", fontSize: "13px" }}
                          />
                        )}
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
                              await editActivity({ logId: log.id, value: editValue ? parseFloat(editValue) : undefined, valueJson: log.valueJson, note: editNote || undefined });
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
            <div style={{ minHeight: "420px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LoadingSpinner size="large" text="Loading activity history..." />
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
                      Result
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
                        {formatActivityValue(log)}
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
