"use client";

import { useState } from "react";
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

  // Auto-select first session when loaded
  if (isLoading === false && !selectedSession && sessions.length > 0) {
    setSelectedSession(sessions[0] as any as WeeklySession);
  }

  const handleStepComplete = async (stepNum: number) => {
    if (!selectedSession || !currentTeamSlug) return;

    try {
      if (stepNum === 0) {
        // Complete Account step
        await completeAccount({
          sessionId: selectedSession.id,
          commitmentUpdates: [],
        });
      } else if (stepNum === 1) {
        // Complete Review step
        await completeReview({
          sessionId: selectedSession.id,
        });
      } else if (stepNum === 2) {
        // Complete Commit step
        await completeCommit({
          sessionId: selectedSession.id,
          commitments: [],
        });
      }
      setStep(Math.min(2, step + 1));
    } catch {
      // Error handled in hook
    }
  };

  const steps = ["ACCOUNT", "REVIEW", "COMMIT"];

  if (error) return <ErrorState error={error} />;
  if (isLoading) return <LoadingSpinner size="large" text="Loading session..." className="min-h-[400px] flex items-center justify-center" />;
  if (!selectedSession) return <div style={{ padding: "48px", textAlign: "center", color: "#71717a" }}>No active session for this week.</div>;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif", minHeight: "100vh" }}>
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
        {step === 0 && <StepAccount session={selectedSession} />}
        {step === 1 && <StepReview session={selectedSession} />}
        {step === 2 && <StepCommit session={selectedSession} />}
      </div>

      <footer style={{ backgroundColor: "#ffffff", borderTop: "1px solid #e4e4e7", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", bottom: 0 }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ padding: "10px 24px", border: "1px solid #000000", backgroundColor: "transparent", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: step === 0 ? "not-allowed" : "pointer", color: "#18181b", opacity: step === 0 ? 0.4 : 1 }}>
          Back
        </button>
        <button onClick={() => handleStepComplete(step)} style={{ padding: "10px 24px", border: "none", backgroundColor: "#000000", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
          {step === steps.length - 1 ? "Finish Session" : "Next Step"}
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
        </button>
      </footer>
    </div>
  );
}

function StepAccount({ session }: { session: WeeklySession }) {
  if (!session.commitments || session.commitments.length === 0) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", color: "#71717a" }}>
        <p>No prior commitments to report on.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", marginBottom: "8px" }}>Report on Last Week</h1>
      <p style={{ fontSize: "16px", color: "#71717a", marginBottom: "32px" }}>Review what was committed last week and mark completion.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {session.commitments.map((commitment) => {
          const isDone = commitment.status === "DONE";
          return (
            <div key={commitment.id} style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: isDone ? "#18181b" : "#e4e4e7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "not-allowed" }}>
                {isDone && <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#ffffff" }}>check</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#18181b", marginBottom: "2px" }}>{commitment.text}</div>
                {commitment.linkedLeadMeasureId && (
                  <div style={{ fontSize: "12px", color: "#71717a" }}>Linked to lead measure</div>
                )}
              </div>
              <span style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: isDone ? "#16A34A" : "#ba1a1a" }}>
                {isDone ? "Done" : "Not Done"}
              </span>
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
                      <div style={{ fontSize: "32px", fontWeight: 700, color: "#18181b", marginBottom: "8px" }}>
                        {(lm.activityLogs || []).length > 0 ? (lm.activityLogs || [])[0].value : 0} / {lm.targetValue}
                      </div>
                      <div style={{ width: "100%", height: "4px", backgroundColor: "#e4e4e7", marginBottom: "8px" }}>
                        <div
                          style={{
                            height: "100%",
                            backgroundColor: "#18181b",
                            width: `${Math.min(100, Math.round((((lm.activityLogs || []).length > 0 ? (lm.activityLogs || [])[0].value : 0) / lm.targetValue) * 100))}%`,
                          }}
                        ></div>
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: (lm.activityLogs || []).length > 0 && (lm.activityLogs || [])[0].value >= lm.targetValue ? "#16A34A" : "#ba1a1a" }}>
                        {(lm.activityLogs || []).length > 0 && (lm.activityLogs || [])[0].value >= lm.targetValue ? "On Track" : "Behind"}
                      </span>
                    </div>
                  </div>
                ))}
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

function StepCommit({ session }: { session: WeeklySession }) {
  const [commitmentText, setCommitmentText] = useState("");
  const [selectedLM, setSelectedLM] = useState("");

  const allLeadMeasures = session.wig?.leadMeasures.map((lm: LeadMeasure) => ({ id: lm.id, name: lm.name, wigTitle: session.wig?.title })) || [];

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", marginBottom: "8px" }}>Make Commitments</h1>
      <p style={{ fontSize: "16px", color: "#71717a", marginBottom: "32px" }}>What are the 1-2 most important things you can do this week to impact the lead measures?</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a" }}>New Commitment</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Action</label>
            <textarea
              value={commitmentText}
              onChange={(e) => setCommitmentText(e.target.value)}
              placeholder="e.g., Complete 10 customer calls and document feedback"
              style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px 12px", fontSize: "14px", color: "#18181b", outline: "none", borderRadius: "0", width: "100%", minHeight: "60px", fontFamily: "'Inter', sans-serif" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Link to Lead Measure (Optional)</label>
            <div style={{ position: "relative" }}>
              <select
                value={selectedLM}
                onChange={(e) => setSelectedLM(e.target.value)}
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
        <div style={{ textAlign: "center", color: "#71717a", fontSize: "12px" }}>
          Commitments will be saved when you complete this step.
        </div>
      </div>
    </div>
  );
}