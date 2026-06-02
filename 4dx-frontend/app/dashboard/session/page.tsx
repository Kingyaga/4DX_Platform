"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  useAddSessionBlocker,
  useAddTeamCommitment,
  useCreateManualSession,
  useRoleCheck,
  useTeamWeeklySession,
  useUpdateTeamSession,
} from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { LoadingSpinner } from "@/lib/components/loading-spinner";

function getThisMondayInput() {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getResumeStep(session: { accountDoneAt?: unknown; reviewDoneAt?: unknown; commitDoneAt?: unknown } | null | undefined) {
  if (!session) return 0;
  if (session.commitDoneAt) return 3;
  if (session.reviewDoneAt) return 2;
  if (session.accountDoneAt) return 1;
  return 0;
}

export default function WeeklySessionPage() {
  const { currentTeamSlug } = useTeamStore();
  const { canCreateWIG, canArchiveWIG } = useRoleCheck();
  const [weekStarting, setWeekStarting] = useState(getThisMondayInput());
  const { session, isLoading, error, refetch } = useTeamWeeklySession(currentTeamSlug, weekStarting);
  const { createSession, isLoading: isCreating, error: createError } = useCreateManualSession();
  const { updateSession, isLoading: isUpdating, error: updateError } = useUpdateTeamSession();
  const { addCommitment, isLoading: isAddingCommitment, error: commitmentError } = useAddTeamCommitment();
  const { addBlocker, isLoading: isAddingBlocker, error: blockerError } = useAddSessionBlocker();

  const [title, setTitle] = useState("Weekly Execution Session");
  const [notes, setNotes] = useState("");
  const [confidenceScore, setConfidenceScore] = useState(7);
  const [commitmentText, setCommitmentText] = useState("");
  const [blockerTitle, setBlockerTitle] = useState("");
  const [blockerDetails, setBlockerDetails] = useState("");
  const [currentStep, setCurrentStep] = useState(0);

  const snapshot = session?.snapshotJson as any;
  const totals = snapshot?.totals || {};
  const canManageSession = canCreateWIG || canArchiveWIG;
  const resumeStep = getResumeStep(session);
  const hasPartialProgress = !!session && session.status !== "COMPLETE" && resumeStep > 0 && resumeStep < 3;

  const statusLabel = session?.status === "COMPLETE" ? "Completed" : session?.status === "IN_PROGRESS" ? "In Progress" : "Not Started";
  const timeline = useMemo(() => session?.timeline || [], [session]);

  useEffect(() => {
    setCurrentStep(getResumeStep(session));
  }, [session?.id, session?.accountDoneAt, session?.reviewDoneAt, session?.commitDoneAt]);

  const handleCreateSession = async () => {
    if (!currentTeamSlug) return;
    await createSession({ teamSlug: currentTeamSlug, title, weekStarting });
    await refetch();
  };

  const handleSaveNotes = async () => {
    if (!session) return;
    await updateSession({ sessionId: session.id, notes, confidenceScore });
    await refetch();
  };

  const handleComplete = async () => {
    if (!session) return;
    await updateSession({ sessionId: session.id, status: "COMPLETE", notes: notes || session.notes || undefined, confidenceScore });
    await refetch();
  };

  const handleAddCommitment = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || !commitmentText.trim()) return;
    await addCommitment({ sessionId: session.id, text: commitmentText.trim() });
    setCommitmentText("");
    await refetch();
  };

  const handleAddBlocker = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || !blockerTitle.trim()) return;
    await addBlocker({ sessionId: session.id, title: blockerTitle.trim(), details: blockerDetails.trim() || undefined });
    setBlockerTitle("");
    setBlockerDetails("");
    await refetch();
  };

  if (!currentTeamSlug) {
    return (
      <main style={{ flex: 1, padding: "32px" }}>
        <EmptyState title="No team selected" description="Choose a team before opening weekly sessions." />
      </main>
    );
  }

  return (
    <main data-tour="session-overview" style={{ flex: 1, padding: "32px", backgroundColor: "#f7f9fd", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: "1180px", margin: "0 auto", display: "grid", gap: "24px" }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", borderBottom: "1px solid #dbe3ef", paddingBottom: "18px" }}>
          <div>
            <p style={{ margin: "0 0 6px 0", fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Weekly Sessions</p>
            <h1 style={{ margin: 0, fontSize: "30px", lineHeight: 1.1, color: "#111827" }}>Team execution meeting</h1>
            <p style={{ margin: "8px 0 0 0", color: "#64748b", fontSize: "14px" }}>
              Review WIG movement, account for commitments, surface blockers, and lock next week's actions.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="date"
              value={weekStarting}
              onChange={(event) => setWeekStarting(event.target.value)}
              style={{ height: "42px", border: "1px solid #cbd5e1", padding: "0 12px", background: "#ffffff", fontSize: "14px" }}
            />
            <span style={{ padding: "10px 14px", backgroundColor: session?.status === "COMPLETE" ? "#dcfce7" : session ? "#fef3c7" : "#e2e8f0", color: session?.status === "COMPLETE" ? "#166534" : session ? "#92400e" : "#475569", fontSize: "12px", fontWeight: 800, textTransform: "uppercase" }}>
              {statusLabel}
            </span>
          </div>
        </header>

        {(error || createError || updateError || commitmentError || blockerError) && (
          <ErrorState error={error || createError || updateError || commitmentError || blockerError} />
        )}

        {isLoading ? (
          <LoadingSpinner size="xlarge" text="Loading weekly session..." className="min-h-[520px] flex items-center justify-center" />
        ) : !session ? (
          <section style={{ background: "#ffffff", border: "1px solid #dbe3ef", padding: "28px", display: "grid", gap: "18px" }}>
            <div>
              <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", color: "#111827" }}>No session has been started for this week</h2>
              <p style={{ margin: 0, color: "#64748b", maxWidth: "620px", lineHeight: 1.6 }}>
                Sessions are manual for now. A team lead or admin starts the weekly session, and the system captures a snapshot of active WIGs, lead measures, activity logs, completion rates, and missed work at that moment.
              </p>
            </div>
            {canManageSession ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", maxWidth: "720px" }}>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Session title"
                  style={{ height: "44px", border: "1px solid #cbd5e1", padding: "0 12px", fontSize: "14px" }}
                />
                <button
                  data-tour="session-start"
                  onClick={handleCreateSession}
                  disabled={isCreating}
                  style={{ height: "44px", border: "none", background: "#111827", color: "#ffffff", padding: "0 18px", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", cursor: isCreating ? "not-allowed" : "pointer" }}
                >
                  {isCreating ? "Starting..." : "Start New Weekly Session"}
                </button>
              </div>
            ) : (
              <div style={{ color: "#64748b", fontSize: "14px" }}>Ask your team lead or admin to start this week's session.</div>
            )}
          </section>
        ) : session.status === "COMPLETE" ? (
          <section style={{ background: "#ffffff", border: "1px solid #dbe3ef", padding: "28px", display: "grid", gap: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Session completed
                </p>
                <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", color: "#111827" }}>{session.title}</h2>
                <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                  Week of {formatDate(session.weekStarting)} to {formatDate(session.weekEnding)}.
                  {session.completedAt ? ` Completed on ${formatDate(session.completedAt)}.` : ""}
                </p>
              </div>
              {canManageSession && (
                <button
                  data-tour="session-start"
                  onClick={handleCreateSession}
                  disabled={isCreating}
                  style={{ height: "44px", border: "none", background: "#111827", color: "#ffffff", padding: "0 18px", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", cursor: isCreating ? "not-allowed" : "pointer" }}
                >
                  {isCreating ? "Starting..." : "Start New Weekly Session"}
                </button>
              )}
            </div>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" }}>
              {[
                ["Active WIGs", totals.activeWigs ?? 0],
                ["Lead Measures", totals.leadMeasures ?? 0],
                ["Activity Logs", totals.activityLogs ?? 0],
                ["Avg Progress", `${totals.averageProgress ?? 0}%`],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "#f8fafc", border: "1px solid #dbe3ef", padding: "18px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>{label}</div>
                  <div style={{ marginTop: "8px", fontSize: "30px", fontWeight: 800, color: "#111827" }}>{value}</div>
                </div>
              ))}
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
              <div style={{ border: "1px solid #e2e8f0", padding: "18px", background: "#ffffff" }}>
                <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: "#111827" }}>Final Notes</h3>
                <p style={{ margin: 0, color: "#475569", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {session.notes || "No final notes were recorded."}
                </p>
              </div>
              <div style={{ border: "1px solid #e2e8f0", padding: "18px", background: "#ffffff" }}>
                <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", color: "#111827" }}>Commitments Logged</h3>
                {(session.commitments || []).length === 0 ? (
                  <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>No commitments were logged.</p>
                ) : (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {(session.commitments || []).map((commitment: any) => (
                      <div key={commitment.id} style={{ padding: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "13px", color: "#111827" }}>{commitment.text}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p style={{ margin: 0, color: "#64748b", fontSize: "13px", lineHeight: 1.6 }}>
              This session is locked. Blockers, commitments, notes, and confidence fields are hidden after completion so the team can treat this record as history. Start a new weekly session when the team is ready to meet again.
            </p>
          </section>
        ) : (
          <>
            {hasPartialProgress && (
              <section style={{ background: "#ecfdf5", border: "1px solid #86efac", padding: "16px 18px", color: "#14532d", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center" }}>
                <div>
                  <strong style={{ display: "block", fontSize: "14px" }}>Resume from where you left off</strong>
                  <span style={{ fontSize: "13px" }}>
                    {currentStep === 1 ? "Account step completed. Continue with scoreboard review." : "Account and review steps completed. Continue with commitments."}
                  </span>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase" }}>Step {currentStep + 1} of 4</span>
              </section>
            )}

            <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" }}>
              {[
                ["Active WIGs", totals.activeWigs ?? 0],
                ["Lead Measures", totals.leadMeasures ?? 0],
                ["Activity Logs", totals.activityLogs ?? 0],
                ["Avg Progress", `${totals.averageProgress ?? 0}%`],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "#ffffff", border: "1px solid #dbe3ef", padding: "18px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>{label}</div>
                  <div style={{ marginTop: "8px", fontSize: "30px", fontWeight: 800, color: "#111827" }}>{value}</div>
                </div>
              ))}
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "20px" }}>
              <div style={{ display: "grid", gap: "20px" }}>
                <div style={{ background: "#ffffff", border: "1px solid #dbe3ef", padding: "22px" }}>
                  <h2 style={{ margin: "0 0 14px 0", fontSize: "18px", color: "#111827" }}>{session.title}</h2>
                  <p style={{ margin: "0 0 18px 0", color: "#64748b", fontSize: "13px" }}>
                    Week of {formatDate(session.weekStarting)} to {formatDate(session.weekEnding)}
                  </p>
                  <div style={{ display: "grid", gap: "12px" }}>
                    {(snapshot?.wigs || []).map((wig: any) => (
                      <div key={wig.id} style={{ border: "1px solid #e2e8f0", padding: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "8px" }}>
                          <strong style={{ color: "#111827" }}>{wig.title}</strong>
                          <span style={{ fontWeight: 800, color: wig.progress >= 75 ? "#166534" : wig.progress >= 40 ? "#92400e" : "#991b1b" }}>{wig.progress}%</span>
                        </div>
                        <div style={{ height: "6px", background: "#e2e8f0" }}>
                          <div style={{ height: "100%", width: `${wig.progress}%`, background: "#111827" }} />
                        </div>
                        <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                          {wig.leadMeasures.length} lead measures, {wig.activityLogCount} approved logs this week, {wig.missedLeadMeasures} behind.
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div data-tour="session-notes" style={{ background: "#ffffff", border: "1px solid #dbe3ef", padding: "22px" }}>
                  <h2 style={{ margin: "0 0 14px 0", fontSize: "18px", color: "#111827" }}>Session Notes</h2>
                  <textarea
                    value={notes || session.notes || ""}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={7}
                    placeholder="Discussion, decisions, observations, and action items..."
                    style={{ width: "100%", border: "1px solid #cbd5e1", padding: "12px", fontSize: "14px", resize: "vertical", fontFamily: "'Inter', sans-serif" }}
                  />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px", gap: "16px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", color: "#475569", fontSize: "14px" }}>
                      Confidence
                      <input type="range" min="1" max="10" value={confidenceScore} onChange={(event) => setConfidenceScore(Number(event.target.value))} />
                      <strong>{confidenceScore}/10</strong>
                    </label>
                    <button onClick={handleSaveNotes} disabled={isUpdating} style={{ border: "none", background: "#111827", color: "#ffffff", padding: "10px 16px", fontSize: "12px", fontWeight: 800, textTransform: "uppercase" }}>
                      Save Notes
                    </button>
                  </div>
                </div>
              </div>

              <aside style={{ display: "grid", gap: "20px" }}>
                <div data-tour="session-commitments" style={{ background: "#ffffff", border: "1px solid #dbe3ef", padding: "20px" }}>
                  <h2 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#111827" }}>New Commitments</h2>
                  <form onSubmit={handleAddCommitment} style={{ display: "grid", gap: "10px", marginBottom: "14px" }}>
                    <textarea value={commitmentText} onChange={(event) => setCommitmentText(event.target.value)} rows={3} placeholder="Specific commitment for next week..." style={{ border: "1px solid #cbd5e1", padding: "10px", fontSize: "14px", fontFamily: "'Inter', sans-serif" }} />
                    <button disabled={isAddingCommitment} style={{ border: "none", background: "#111827", color: "#ffffff", height: "38px", fontSize: "12px", fontWeight: 800, textTransform: "uppercase" }}>Add Commitment</button>
                  </form>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {(session.commitments || []).map((commitment: any) => (
                      <div key={commitment.id} style={{ padding: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "13px", color: "#111827" }}>{commitment.text}</div>
                    ))}
                  </div>
                </div>

                <div data-tour="session-blockers" style={{ background: "#ffffff", border: "1px solid #dbe3ef", padding: "20px" }}>
                  <h2 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#111827" }}>Blockers & Risks</h2>
                  <form onSubmit={handleAddBlocker} style={{ display: "grid", gap: "10px", marginBottom: "14px" }}>
                    <input value={blockerTitle} onChange={(event) => setBlockerTitle(event.target.value)} placeholder="Blocker title" style={{ border: "1px solid #cbd5e1", padding: "10px", fontSize: "14px" }} />
                    <textarea value={blockerDetails} onChange={(event) => setBlockerDetails(event.target.value)} rows={2} placeholder="Dependency, delay, or challenge details..." style={{ border: "1px solid #cbd5e1", padding: "10px", fontSize: "14px", fontFamily: "'Inter', sans-serif" }} />
                    <button disabled={isAddingBlocker} style={{ border: "none", background: "#334155", color: "#ffffff", height: "38px", fontSize: "12px", fontWeight: 800, textTransform: "uppercase" }}>Add Blocker</button>
                  </form>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {(session.blockers || []).map((blocker: any) => (
                      <div key={blocker.id} style={{ padding: "10px", background: "#fff7ed", border: "1px solid #fed7aa", fontSize: "13px" }}>
                        <strong style={{ color: "#9a3412" }}>{blocker.title}</strong>
                        {blocker.details && <p style={{ margin: "4px 0 0 0", color: "#7c2d12" }}>{blocker.details}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #dbe3ef", padding: "20px" }}>
                  <h2 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#111827" }}>Activity Timeline</h2>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {timeline.slice(0, 8).map((event: any) => (
                      <div key={event.id} style={{ fontSize: "12px", color: "#475569", borderLeft: "3px solid #cbd5e1", paddingLeft: "10px" }}>
                        <strong style={{ color: "#111827" }}>{event.type.replace(/_/g, " ")}</strong>
                        <div>{event.actor?.name || event.actor?.email || "Someone"} · {formatDate(event.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {session.status !== "COMPLETE" && canManageSession && (
                  <button onClick={handleComplete} disabled={isUpdating} style={{ height: "48px", border: "none", background: "#166534", color: "#ffffff", fontSize: "12px", fontWeight: 900, textTransform: "uppercase" }}>
                    Complete Session
                  </button>
                )}
              </aside>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
