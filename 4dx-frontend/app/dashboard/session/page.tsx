"use client";

import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useCurrentSessions, useCompleteAccount, useCompleteReview, useCompleteCommit } from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { ErrorState } from "@/lib/components/states";
import { LoadingSpinner } from "@/lib/components/loading-spinner";
import type { WeeklySession, LeadMeasure } from "@/lib/types";

export default function WeeklySessionPage() {
  const { currentTeamSlug } = useTeamStore();
  const { sessions, isLoading, error } = useCurrentSessions(currentTeamSlug);
  const { completeAccount } = useCompleteAccount();
  const { completeReview } = useCompleteReview();
  const { completeCommit } = useCompleteCommit();

  const [step, setStep] = useState(0);
  const [selectedSession, setSelectedSession] = useState<WeeklySession | null>(null);
  const [commitments, setCommitments] = useState<Array<{ text: string; linkedLeadMeasureId: string }>>([
    { text: "", linkedLeadMeasureId: "" },
  ]);
  const [accountUpdates, setAccountUpdates] = useState<Record<string, { status: "DONE" | "PARTIAL" | "NOT_DONE"; notDoneReason?: string; reflection?: string }>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !selectedSession && sessions.length > 0) {
      setSelectedSession(sessions[0] as any as WeeklySession);
    }
  }, [isLoading, selectedSession, sessions]);

  // Resume step from server state
  useEffect(() => {
    if (!selectedSession) return;
    if (selectedSession.commitDoneAt) {
      setStep(3); // fully complete
    } else if (selectedSession.reviewDoneAt) {
      setStep(2); // at commit
    } else if (selectedSession.accountDoneAt) {
      setStep(1); // at review
    }
    // else step stays 0
  }, [selectedSession?.id]); // only re-run when session changes, not on every render

  const handleStepComplete = async (stepNum: number) => {
    if (!selectedSession || !currentTeamSlug) return;

    try {
      setFormError(null);

      if (stepNum === 0) {
        const updates = (selectedSession.commitments || []).map((commitment) => ({
          commitmentId: commitment.id,
          status: accountUpdates[commitment.id]?.status || "DONE",
          notDoneReason: accountUpdates[commitment.id]?.notDoneReason as any,
          reflection: accountUpdates[commitment.id]?.reflection,
        }));

        const missingReason = updates.some((update) => update.status === "NOT_DONE" && !update.notDoneReason);
        if (missingReason) {
          setFormError("Choose a reason for every commitment marked Not Done.");
          return;
        }

        // Complete Account step
        await completeAccount({
          sessionId: selectedSession.id,
          commitmentUpdates: updates,
        });
      } else if (stepNum === 1) {
        // Complete Review step
        await completeReview({
          sessionId: selectedSession.id,
        });
      } else if (stepNum === 2) {
        const cleanedCommitments = commitments
          .map((commitment) => ({
            text: commitment.text.trim(),
            linkedLeadMeasureId: commitment.linkedLeadMeasureId || undefined,
          }))
          .filter((commitment) => commitment.text.length > 0);

        if (cleanedCommitments.length < 1 || cleanedCommitments.length > 3) {
          setFormError("Enter 1-3 specific commitments before finishing.");
          return;
        }

        if (cleanedCommitments.some((commitment) => commitment.text.split(/\s+/).filter(Boolean).length < 5)) {
          setFormError("Each commitment needs at least 5 words.");
          return;
        }

        // Complete Commit step
        await completeCommit({
          sessionId: selectedSession.id,
          commitments: cleanedCommitments,
        });
      }
      setStep((prev) => (stepNum === 2 ? 3 : Math.min(2, prev + 1)));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save this step.");
      // Error handled in hook
    }
  };

  const steps = ["ACCOUNT", "REVIEW", "COMMIT"];

  if (error) return <ErrorState error={error} />;
  if (isLoading) return <LoadingSpinner size="large" text="Loading session..." className="min-h-[400px] flex items-center justify-center" />;
  if (!selectedSession) return (
    <div style={{ padding: "48px", textAlign: "center" }}>
      <p style={{ fontSize: "16px", fontWeight: 600, color: "#18181b", marginBottom: "8px" }}>No session for this week yet</p>
      <p style={{ fontSize: "14px", color: "#71717a" }}>
        Sessions are generated every Monday. If your team lead hasn&apos;t started this week&apos;s session, ask them to generate it from their dashboard.
      </p>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif", minHeight: "100vh" }}>
      {sessions.length > 1 && (
        <div style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e4e4e7", padding: "12px 24px", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#71717a", textTransform: "uppercase" }}>Session for:</span>
          {(sessions as any[]).map((s: any) => (
            <button
              key={s.id}
              onClick={() => { setSelectedSession(s as any); setStep(0); }}
              style={{
                padding: "6px 16px",
                border: "1px solid #e4e4e7",
                backgroundColor: selectedSession?.id === s.id ? "#18181b" : "#ffffff",
                color: selectedSession?.id === s.id ? "#ffffff" : "#18181b",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {s.wig?.title ?? "WIG"}
            </button>
          ))}
        </div>
      )}
      <header style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #e4e4e7", padding: "0 24px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "24px", cursor: "pointer", color: "#18181b" }}>close</span>
          <span style={{ fontSize: "20px", fontWeight: 600, color: "#18181b" }}>Weekly Session</span>
          <div style={{ width: "1px", height: "24px", backgroundColor: "#e4e4e7" }}></div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Week of {new Date(selectedSession.weekStarting).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  onClick={() => i <= step && setStep(i)}
                  style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: i <= step ? "#18181b" : "transparent", border: i > step ? "1px solid #e4e4e7" : "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: i <= step ? "pointer" : "not-allowed", color: i <= step ? "#ffffff" : "#71717a", fontSize: "12px", fontWeight: 600 }}
                >
                  {i < step ? <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>check</span> : i + 1}
                </div>
                <span style={{ fontSize: "12px", fontWeight: i === step ? 700 : 500, color: i === step ? "#18181b" : "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s}</span>
              </div>
              {i < steps.length - 1 && <div style={{ width: "32px", height: "1px", backgroundColor: "#e4e4e7" }}></div>}
            </div>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "32px", backgroundColor: "#f7f9fd" }}>
        {formError && (
          <div style={{ maxWidth: "900px", margin: "0 auto 16px auto", padding: "12px 16px", backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}>
            {formError}
          </div>
        )}
        {step === 0 && <StepAccount session={selectedSession} accountUpdates={accountUpdates} onAccountUpdatesChange={setAccountUpdates} />}
        {step === 1 && <StepReview session={selectedSession} />}
        {step === 2 && <StepCommit session={selectedSession} commitments={commitments} onCommitmentsChange={setCommitments} />}
        {step >= 3 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 32px", textAlign: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "#16A34A", marginBottom: "24px" }}>check_circle</span>
            <h2 style={{ fontSize: "28px", fontWeight: 700, color: "#18181b", marginBottom: "12px", letterSpacing: "-0.02em" }}>
              Session Complete
            </h2>
            <p style={{ fontSize: "16px", color: "#71717a", maxWidth: "400px", lineHeight: "1.6" }}>
              You&apos;ve completed your weekly session. Your commitments are locked in — see you next week.
            </p>
          </div>
        )}
      </div>

      {step < 3 && (
        <footer style={{ backgroundColor: "#ffffff", borderTop: "1px solid #e4e4e7", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", bottom: 0 }}>
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ padding: "10px 24px", border: "1px solid #000000", backgroundColor: "transparent", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: step === 0 ? "not-allowed" : "pointer", color: "#18181b", opacity: step === 0 ? 0.4 : 1 }}>
            Back
          </button>
          <button onClick={() => handleStepComplete(step)} style={{ padding: "10px 24px", border: "none", backgroundColor: "#000000", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
            {step === steps.length - 1 ? "Finish Session" : "Next Step"}
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
          </button>
        </footer>
      )}
    </div>
  );
}

function StepAccount({
  session,
  accountUpdates,
  onAccountUpdatesChange,
}: {
  session: WeeklySession;
  accountUpdates: Record<string, { status: "DONE" | "PARTIAL" | "NOT_DONE"; notDoneReason?: string; reflection?: string }>;
  onAccountUpdatesChange: Dispatch<SetStateAction<Record<string, { status: "DONE" | "PARTIAL" | "NOT_DONE"; notDoneReason?: string; reflection?: string }>>>;
}) {
  if (!session.commitments || session.commitments.length === 0) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", marginBottom: "8px" }}>Report on Last Week</h1>
        <p style={{ fontSize: "16px", color: "#71717a", marginBottom: "32px" }}>Review what was committed last week and mark completion.</p>
        <div style={{ padding: "32px", textAlign: "center", border: "1px solid #e4e4e7", backgroundColor: "#f8fafc" }}>
          <p style={{ fontSize: "16px", fontWeight: 600, color: "#18181b", marginBottom: "8px" }}>
            First session — no prior commitments
          </p>
          <p style={{ fontSize: "14px", color: "#71717a" }}>
            This is your first session. Skip to Review and Commit to make your commitments for next week.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", marginBottom: "8px" }}>Report on Last Week</h1>
      <p style={{ fontSize: "16px", color: "#71717a", marginBottom: "32px" }}>Review what was committed last week and mark completion.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {session.commitments.map((commitment) => {
          const update = accountUpdates[commitment.id] || { status: "DONE" as const };
          const isNotDone = update.status === "NOT_DONE";
          return (
            <div key={commitment.id} style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px", display: "grid", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#18181b", marginBottom: "2px" }}>{commitment.text}</div>
                {commitment.linkedLeadMeasureId && (
                  <div style={{ fontSize: "12px", color: "#71717a" }}>Linked to lead measure</div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
                {(["DONE", "PARTIAL", "NOT_DONE"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      onAccountUpdatesChange((current) => ({
                        ...current,
                        [commitment.id]: {
                          ...current[commitment.id],
                          status,
                          notDoneReason: status === "NOT_DONE" ? current[commitment.id]?.notDoneReason : undefined,
                        },
                      }));
                    }}
                    style={{
                      padding: "10px 12px",
                      border: "1px solid #e4e4e7",
                      backgroundColor: update.status === status ? "#18181b" : "#ffffff",
                      color: update.status === status ? "#ffffff" : "#18181b",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {status.replace("_", " ")}
                  </button>
                ))}
              </div>
              {isNotDone && (
                <div style={{ display: "grid", gap: "10px" }}>
                  <select
                    value={update.notDoneReason || ""}
                    onChange={(event) => {
                      onAccountUpdatesChange((current) => ({
                        ...current,
                        [commitment.id]: {
                          ...current[commitment.id],
                          status: "NOT_DONE",
                          notDoneReason: event.target.value,
                        },
                      }));
                    }}
                    style={{ border: "1px solid #e4e4e7", padding: "10px", fontSize: "14px" }}
                  >
                    <option value="">Choose reason...</option>
                    <option value="WHIRLWIND">Whirlwind</option>
                    <option value="MISJUDGED">Misjudged effort</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <textarea
                    value={update.reflection || ""}
                    onChange={(event) => {
                      onAccountUpdatesChange((current) => ({
                        ...current,
                        [commitment.id]: {
                          ...current[commitment.id],
                          status: "NOT_DONE",
                          reflection: event.target.value,
                        },
                      }));
                    }}
                    placeholder="Brief reflection"
                    rows={2}
                    style={{ border: "1px solid #e4e4e7", padding: "10px", fontSize: "14px", fontFamily: "'Inter', sans-serif" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepReview({ session }: { session: WeeklySession }) {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", marginBottom: "8px" }}>Review the Scoreboard</h1>
      <p style={{ fontSize: "16px", color: "#71717a", marginBottom: "32px" }}>Is the team winning or losing? Review the WIG and lead measures.</p>
      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
        <div style={{ padding: "20px", backgroundColor: "#f4f4f5", borderBottom: "1px solid #e4e4e7" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", marginBottom: "4px" }}>WIG: {session.wig?.title || "No WIG"}</h2>
          {session.wig && (
            <p style={{ fontSize: "14px", color: "#71717a" }}>{session.wig?.description || "Track the most important goal"}</p>
          )}
        </div>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {session.wig ? (
            <>
              <div style={{ border: "1px solid #e4e4e7" }}>
                <div style={{ padding: "16px", backgroundColor: "#f4f4f5", borderBottom: "1px solid #e4e4e7" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a" }}>Lag Measure</span>
                </div>
                <div style={{ padding: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
                  <div>
                    <div style={{ fontSize: "32px", fontWeight: 700, color: "#18181b" }}>{session.wig.currentValue}</div>
                    <div style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>{session.wig.unit}</div>
                  </div>
                  <div style={{ flex: 1, maxWidth: "400px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#71717a" }}>From: {session.wig.fromValue}</span>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#71717a" }}>To: {session.wig.toValue}</span>
                    </div>
                    <div style={{ height: "8px", backgroundColor: "#e4e4e7" }}>
                      <div style={{ height: "100%", backgroundColor: "#18181b", width: `${((session.wig.currentValue - session.wig.fromValue) / (session.wig.toValue - session.wig.fromValue)) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {session.wig.leadMeasures.slice(0, 2).map((lm: LeadMeasure) => (
                  <div key={lm.id} style={{ border: "1px solid #e4e4e7", display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "16px", backgroundColor: "#f4f4f5", borderBottom: "1px solid #e4e4e7" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a" }}>Lead Measure</span>
                    </div>
                    <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                      <div style={{ fontSize: "14px", fontWeight: 500, color: "#18181b", marginBottom: "16px" }}>{lm.name}</div>
                      {(() => {
                        const cumulativeTotal = (lm.activityLogs || []).reduce((s, l) => s + l.value, 0);
                        const progressPct = Math.min(100, Math.round((cumulativeTotal / lm.targetValue) * 100));
                        const onTrack = cumulativeTotal >= lm.targetValue;
                        return (
                          <>
                            <div style={{ fontSize: "32px", fontWeight: 700, color: "#18181b", marginBottom: "8px" }}>
                              {cumulativeTotal} / {lm.targetValue}
                            </div>
                            <div style={{ width: "100%", height: "4px", backgroundColor: "#e4e4e7", marginBottom: "8px" }}>
                              <div style={{ height: "100%", backgroundColor: "#18181b", width: `${progressPct}%` }}></div>
                            </div>
                            <span style={{ fontSize: "12px", fontWeight: 500, color: onTrack ? "#16A34A" : "#ba1a1a" }}>
                              {onTrack ? "On Track" : "Behind"}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "12px", fontSize: "12px", color: "#71717a", textAlign: "center" }}>
                Progress shows your cumulative approved activity toward the target.
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", color: "#71717a" }}>No WIG data available</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepCommit({
  session,
  commitments,
  onCommitmentsChange,
}: {
  session: WeeklySession;
  commitments: Array<{ text: string; linkedLeadMeasureId: string }>;
  onCommitmentsChange: Dispatch<SetStateAction<Array<{ text: string; linkedLeadMeasureId: string }>>>;
}) {
  const allLeadMeasures = session.wig?.leadMeasures.map((lm: LeadMeasure) => ({ id: lm.id, name: lm.name, wigTitle: session.wig?.title })) || [];

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", marginBottom: "8px" }}>Make Commitments</h1>
      <p style={{ fontSize: "16px", color: "#71717a", marginBottom: "16px" }}>Make 1-3 specific commitments — each tied to a lead measure and completable this week.</p>
      <div style={{ padding: "12px 16px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: "24px", fontSize: "13px", color: "#166534" }}>
        <strong>Good commitment:</strong> "I will make 15 discovery calls by Friday to hit the weekly outreach target." &nbsp;
        <strong>Weak:</strong> "Work on lead generation."
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {commitments.map((commitment, index) => (
          <div key={index} style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a" }}>Commitment {index + 1}</span>
              {commitments.length > 1 && (
                <button
                  type="button"
                  onClick={() => onCommitmentsChange((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  style={{ border: "none", backgroundColor: "transparent", color: "#ba1a1a", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}
                >
                  Remove
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Action</label>
              <textarea
                value={commitment.text}
                onChange={(event) => {
                  onCommitmentsChange((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, text: event.target.value } : item,
                    ),
                  );
                }}
                placeholder="e.g., I will [specific action] by [day] to impact [lead measure name]"
                style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px 12px", fontSize: "14px", color: "#18181b", outline: "none", borderRadius: "0", width: "100%", minHeight: "60px", fontFamily: "'Inter', sans-serif" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Link to Lead Measure (Optional)</label>
              <div style={{ position: "relative" }}>
                <select
                  value={commitment.linkedLeadMeasureId}
                  onChange={(event) => {
                    onCommitmentsChange((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, linkedLeadMeasureId: event.target.value } : item,
                      ),
                    );
                  }}
                  style={{ width: "100%", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px 12px", fontSize: "16px", color: "#18181b", outline: "none", borderRadius: "0", appearance: "none" }}
                >
                  <option value="">Select a lead measure...</option>
                  {allLeadMeasures.map((lm: { id: string; name: string; wigTitle: string | undefined }) => (
                    <option key={lm.id} value={lm.id}>
                      {lm.name} ({lm.wigTitle})
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#71717a" }}>arrow_drop_down</span>
              </div>
            </div>
          </div>
        ))}
        {commitments.length < 3 && (
          <button
            type="button"
            onClick={() => onCommitmentsChange((current) => [...current, { text: "", linkedLeadMeasureId: "" }])}
            style={{ padding: "10px 16px", border: "1px solid #18181b", backgroundColor: "#ffffff", color: "#18181b", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}
          >
            Add Commitment
          </button>
        )}
        <div style={{ textAlign: "center", color: "#71717a", fontSize: "12px" }}>
          Commitments will be saved when you complete this step.
        </div>
      </div>
    </div>
  );
}
