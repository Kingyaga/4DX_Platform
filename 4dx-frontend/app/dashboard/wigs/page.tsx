"use client";

import { useEffect, useState } from "react";
import { useWIGs, useCreateWIG, useUpdateWIG, useCreateLeadMeasure, useRoleCheck, useMyTeams } from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { useUserStore } from "@/lib/stores/user-store";
import { WIGListSkeleton } from "@/lib/components/skeletons";
import { ErrorState, EmptyState } from "@/lib/components/states";
import type { WIG, LeadMeasure } from "@/lib/types";

export default function WIGsPage() {
  const [selectedWIG, setSelectedWIG] = useState<WIG | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const { orgSlug } = useUserStore();
  const currentTeamSlug = useTeamStore((state) => state.currentTeamSlug);
  const setCurrentTeamSlug = useTeamStore((state) => state.setCurrentTeamSlug);
  const { teams, isLoading: teamsLoading, error: teamsError } = useMyTeams(orgSlug);
  const [selectedTab, setSelectedTab] = useState<"current" | "history">("current");

  useEffect(() => {
    if (!teamsLoading && teams.length > 0 && (!currentTeamSlug || !teams.some((team: any) => team.slug === currentTeamSlug))) {
      setCurrentTeamSlug(teams[0].slug);
    }
  }, [currentTeamSlug, teamsLoading, teams, setCurrentTeamSlug]);

  const { wigs, isLoading, error, refetch } = useWIGs(currentTeamSlug);
  const { canCreateWIG } = useRoleCheck();

  const currentWigs = (wigs as any[]).filter((wig) => !["ACHIEVED", "MISSED", "ABANDONED"].includes(wig.status));
  const historyWigs = (wigs as any[]).filter((wig) => ["ACHIEVED", "MISSED", "ABANDONED"].includes(wig.status));
  const displayedWigs = selectedTab === "current" ? currentWigs : historyWigs;

  if (!currentTeamSlug) {
    if (teamsLoading) {
      return (
        <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
          <div style={{ textAlign: "center", color: "#71717a" }}>Loading teams...</div>
        </main>
      );
    }

    if (teamsError) {
      return (
        <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
          <ErrorState error={teamsError} title="Unable to load teams" />
        </main>
      );
    }

    if (!teams || teams.length === 0) {
      return (
        <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
          <EmptyState
            title="No teams available"
            description="You need at least one team assigned before you can view WIGs. Contact your admin to join a team."
          />
        </main>
      );
    }

    return (
      <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#18181b", marginBottom: "8px" }}>Select a team</h1>
            <p style={{ fontSize: "14px", color: "#71717a" }}>
              Pick the team you want to manage before viewing WIGs and creating new goals.
            </p>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {teams.map((team: { slug: string; name: string; wigs?: Array<unknown> }) => (
              <button
                key={team.slug}
                onClick={() => setCurrentTeamSlug(team.slug)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "18px 20px",
                  borderRadius: "16px",
                  border: "1px solid #e4e4e7",
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#18181b",
                }}
              >
                <span>{team.name}</span>
                <span style={{ fontSize: "12px", color: "#71717a" }}>{team.wigs?.length || 0} WIGs</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (showNew) {
    return <WIGCreateForm onCancel={() => setShowNew(false)} onSuccess={() => { setShowNew(false); refetch(); }} />;
  }

  if (selectedWIG) {
    return <WIGDetail wig={selectedWIG} onBack={() => setSelectedWIG(null)} />;
  }

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", flexWrap: "wrap", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em", textTransform: "uppercase" }}>WIGs</h1>
          <p style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>Wildly Important Goals &mdash; your team&apos;s highest priorities.</p>
        </div>
        {canCreateWIG && (
          <button
            onClick={() => setShowNew(true)}
            style={{ backgroundColor: "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 16px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
            Create WIG
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "32px", flexWrap: "wrap" }}>
        <button
          onClick={() => setSelectedTab("current")}
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            border: selectedTab === "current" ? "1px solid #18181b" : "1px solid #e4e4e7",
            backgroundColor: selectedTab === "current" ? "#18181b" : "#ffffff",
            color: selectedTab === "current" ? "#ffffff" : "#18181b",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Current WIGs ({currentWigs.length})
        </button>
        <button
          onClick={() => setSelectedTab("history")}
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            border: selectedTab === "history" ? "1px solid #18181b" : "1px solid #e4e4e7",
            backgroundColor: selectedTab === "history" ? "#18181b" : "#ffffff",
            color: selectedTab === "history" ? "#ffffff" : "#18181b",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Closed History ({historyWigs.length})
        </button>
      </div>

      {/* Loading */}
      {isLoading && <WIGListSkeleton count={3} />}

      {/* Error */}
      {error && <ErrorState error={error} title="Failed to load WIGs" onRetry={() => refetch()} />}

      {/* Empty State */}
      {!isLoading && !error && wigs.length === 0 && (
        <EmptyState
          title="No WIGs yet"
          description={
            canCreateWIG
              ? "Create your first Wildly Important Goal to get started."
              : "Only the current team lead can create WIGs for this team."
          }
          icon="🎯"
        />
      )}

      {/* WIG List */}
      {!isLoading && wigs.length > 0 && (
        <>
          {displayedWigs.length === 0 ? (
            <EmptyState
              title={selectedTab === "current" ? "No current WIGs" : "No closed WIGs yet"}
              description={
                selectedTab === "current"
                  ? "This team has no active or draft WIGs right now. Create one to start tracking progress."
                  : "Closed WIGs are archived here once they are achieved, missed, or abandoned."
              }
              icon={selectedTab === "current" ? "🎯" : "📚"}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {displayedWigs.map((wig: WIG, i: number) => {
                const statusColor = wig.status === "ACTIVE" ? "#16A34A" : wig.status === "DRAFT" ? "#71717a" : "#EAB308";
                const progress = ((wig.currentValue - wig.fromValue) / (wig.toValue - wig.fromValue)) * 100;

                return (
                  <div
                    key={wig.id}
                    onClick={() => setSelectedWIG(wig)}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      backgroundColor: hoveredRow === i ? "#f7f9fd" : "#ffffff",
                      border: "1px solid #e4e4e7",
                      padding: "20px",
                      cursor: "pointer",
                      transition: "background 0.075s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "2px 8px", border: "1px solid #e4e4e7", backgroundColor: "#f4f4f5", fontSize: "12px", fontWeight: 600 }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: statusColor, display: "inline-block" }}></span>
                            {wig.status}
                          </span>
                          <span style={{ fontSize: "12px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Wildly Important Goal</span>
                        </div>
                        <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.01em" }}>{wig.title}</h2>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#71717a", marginLeft: "16px" }}>chevron_right</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "12px", color: "#71717a" }}>Deadline: {new Date(wig.deadline).toLocaleDateString()}</span>
                      <div style={{ flex: 1, height: "4px", backgroundColor: "#e4e4e7" }}>
                        <div style={{ height: "100%", backgroundColor: "#18181b", width: `${Math.min(progress, 100)}%` }}></div>
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#18181b" }}>{wig.leadMeasures.length} Lead Measures</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function WIGDetail({ wig, onBack }: { wig: WIG; onBack: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showAddLeadMeasure, setShowAddLeadMeasure] = useState(false);
  const [leadMeasureName, setLeadMeasureName] = useState("");
  const [leadMeasureDescription, setLeadMeasureDescription] = useState("");
  const [cadence, setCadence] = useState<"WEEKLY" | "BIWEEKLY">("WEEKLY");
  const [targetValue, setTargetValue] = useState("");
  const [leadMeasureUnit, setLeadMeasureUnit] = useState(wig.unit || "");
  const [activeWig, setActiveWig] = useState<WIG>(wig);

  const { createLeadMeasure, isLoading: isCreatingLeadMeasure, error: createLeadMeasureError } = useCreateLeadMeasure();
  const { canArchiveWIG, canCreateWIG } = useRoleCheck();
  const progress = ((wig.currentValue - wig.fromValue) / (wig.toValue - wig.fromValue)) * 100;
  const statusColor = wig.status === "ACTIVE" ? "#16A34A" : wig.status === "DRAFT" ? "#71717a" : "#EAB308";

  useEffect(() => {
    setActiveWig(wig);
    setLeadMeasureUnit(wig.unit || "");
  }, [wig]);

  const canAddLeadMeasure = canCreateWIG && activeWig.leadMeasures.length < 3;

  const handleCreateLeadMeasure = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!leadMeasureName || !cadence || !targetValue || !leadMeasureUnit) {
      return;
    }

    try {
      const created = await createLeadMeasure({
        wigId: activeWig.id,
        name: leadMeasureName,
        description: leadMeasureDescription || undefined,
        cadence,
        targetValue: parseFloat(targetValue),
        unit: leadMeasureUnit,
      });

      setActiveWig((prev) => ({
        ...prev,
        leadMeasures: [...prev.leadMeasures, created],
      }));
      setShowAddLeadMeasure(false);
      setLeadMeasureName("");
      setLeadMeasureDescription("");
      setCadence("WEEKLY");
      setTargetValue("");
      setLeadMeasureUnit(wig.unit || "");
    } catch {
      // Error is surfaced by hook state
    }
  };

  if (isEditing) {
    return <WIGEditForm wig={wig} onCancel={() => setIsEditing(false)} onSuccess={() => setIsEditing(false)} />;
  }

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "#71717a", background: "none", border: "none", cursor: "pointer", marginBottom: "24px", textTransform: "uppercase", letterSpacing: "0.05em" }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_back</span>
        Back to WIGs
      </button>

      {/* Header */}
      <div style={{ marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "2px 8px", border: "1px solid #e4e4e7", backgroundColor: "#f4f4f5", fontSize: "12px", fontWeight: 600 }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: statusColor, display: "inline-block" }}></span>
              {wig.status}
            </span>
            <span style={{ fontSize: "12px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Wildly Important Goal</span>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em" }}>{wig.title}</h1>
        </div>
        {canArchiveWIG && (
          <button
            onClick={() => setIsEditing(true)}
            style={{ backgroundColor: "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 16px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
            Edit WIG
          </button>
        )}
      </div>

      <div style={{ marginBottom: "24px", padding: "16px", borderRadius: "16px", backgroundColor: canArchiveWIG ? "#ecfdf5" : "#f8fafc", border: `1px solid ${canArchiveWIG ? "#10b981" : "#e4e4e7"}`, color: canArchiveWIG ? "#166534" : "#52525b" }}>
        {canArchiveWIG
          ? "You are the current team lead for this team, so WIG actions are available to you."
          : "This WIG is read-only unless you are the current team lead for the selected team."}
      </div>

      <div style={{ width: "100%", height: "4px", backgroundColor: "#e4e4e7", marginBottom: "8px", position: "relative" }}>
        <div style={{ height: "100%", backgroundColor: "#18181b", width: `${Math.min(progress, 100)}%` }}></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#71717a" }}>
        <span>Baseline: {wig.fromValue}</span>
        <span>Deadline: {new Date(wig.deadline).toLocaleDateString()}</span>
      </div>

      {/* Lead Measures */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "16px", paddingBottom: "8px", borderBottom: "1px solid #e4e4e7" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b" }}>Lead Measures ({activeWig.leadMeasures.length})</h2>
          {canCreateWIG && (
            <button
              onClick={() => setShowAddLeadMeasure((current) => !current)}
              disabled={!canAddLeadMeasure}
              style={{
                backgroundColor: canAddLeadMeasure ? "#000000" : "#d4d4d8",
                color: canAddLeadMeasure ? "#ffffff" : "#71717a",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                padding: "10px 16px",
                border: "none",
                cursor: canAddLeadMeasure ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
              Add Lead Measure
            </button>
          )}
        </div>

        {showAddLeadMeasure && (
          <form onSubmit={handleCreateLeadMeasure} style={{ display: "grid", gap: "16px", marginBottom: "24px", padding: "20px", backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: "16px" }}>
            {createLeadMeasureError && <ErrorState error={createLeadMeasureError} title="Unable to add lead measure" />}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#18181b" }}>Name *</label>
                <input
                  value={leadMeasureName}
                  onChange={(e) => setLeadMeasureName(e.target.value)}
                  placeholder="e.g., Weekly outbound calls"
                  required
                  style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "10px", fontSize: "14px", outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#18181b" }}>Target Value *</label>
                <input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="0"
                  required
                  style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "10px", fontSize: "14px", outline: "none" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#18181b" }}>Unit *</label>
                <input
                  value={leadMeasureUnit}
                  onChange={(e) => setLeadMeasureUnit(e.target.value)}
                  placeholder="e.g., calls, demos"
                  required
                  style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "10px", fontSize: "14px", outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#18181b" }}>Cadence *</label>
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value as "WEEKLY" | "BIWEEKLY")}
                  required
                  style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "10px", fontSize: "14px", outline: "none" }}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#18181b" }}>Description</label>
              <textarea
                value={leadMeasureDescription}
                onChange={(e) => setLeadMeasureDescription(e.target.value)}
                placeholder="Optional details to explain how this lead measure moves the needle."
                rows={4}
                style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "10px", fontSize: "14px", outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setShowAddLeadMeasure(false)}
                style={{ backgroundColor: "#f4f4f5", color: "#18181b", fontSize: "12px", fontWeight: 600, padding: "10px 16px", border: "1px solid #e4e4e7", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingLeadMeasure}
                style={{ backgroundColor: "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", padding: "10px 16px", border: "none", cursor: "pointer" }}
              >
                {isCreatingLeadMeasure ? "Saving..." : "Save lead measure"}
              </button>
            </div>
          </form>
        )}

        {activeWig.leadMeasures.length === 0 ? (
          <EmptyState
            title="No lead measures yet"
            description="Add lead measures to track progress toward this WIG."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {activeWig.leadMeasures.map((lm) => {
              const totalLogged = (lm.activityLogs || []).reduce((sum, log) => sum + log.value, 0);

              return (
                <div key={lm.id} style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#18181b", marginBottom: "8px" }}>{lm.name}</h3>
                  {lm.description && (
                    <p style={{ fontSize: "14px", color: "#71717a", marginBottom: "12px" }}>{lm.description}</p>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "4px" }}>Progress</span>
                      <span style={{ fontSize: "20px", fontWeight: 600, color: "#18181b" }}>{totalLogged.toFixed(1)} / {lm.targetValue.toFixed(1)} {lm.unit}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "4px" }}>Cadence</span>
                      <span style={{ fontSize: "14px", color: "#18181b" }}>{lm.cadence}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function WIGCreateForm({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [unit, setUnit] = useState("USD");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");

  const currentTeamSlug = useTeamStore((state) => state.currentTeamSlug);
  const { createWIG, isLoading, error } = useCreateWIG();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentTeamSlug || !title || !from || !to || !deadline) {
      return;
    }

    try {
      await createWIG({
        teamSlug: currentTeamSlug,
        title,
        fromValue: parseFloat(from),
        toValue: parseFloat(to),
        unit,
        deadline: new Date(deadline),
        description: description || undefined,
      });
      onSuccess();
    } catch {
      // Error is handled in the hook
    }
  };

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "672px", backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px", display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Header */}
        <div style={{ borderBottom: "1px solid #e4e4e7", paddingBottom: "16px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em" }}>Create WIG</h1>
          <p style={{ fontSize: "14px", color: "#71717a", marginTop: "8px" }}>Define your Wildly Important Goal. Clarity is execution.</p>
        </div>

        {/* Error */}
        {error && <ErrorState error={error} title="Failed to create WIG" />}

        {/* Live Preview */}
        <div style={{ backgroundColor: "#f4f4f5", border: "1px solid #e4e4e7", padding: "20px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "8px" }}>Live WIG Statement</span>
          <p style={{ fontSize: "20px", fontWeight: 600, color: "#18181b" }}>
            Increase <span style={{ color: title ? "#18181b" : "#71717a" }}>{title || "[Title]"}</span>
            {" "}from <span style={{ color: from ? "#18181b" : "#71717a" }}>{from || "[A]"}</span>
            {" "}to <span style={{ color: to ? "#18181b" : "#71717a" }}>{to || "[B]"}</span>
            {" "}by <span style={{ color: deadline ? "#18181b" : "#71717a" }}>{deadline ? new Date(deadline).toLocaleDateString() : "[Date]"}</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Title */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Title *</label>
            <input
              type="text"
              placeholder="e.g., Annual Recurring Revenue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%" }}
            />
          </div>

          {/* From / To */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>From (Current Value) *</label>
              <input
                type="number"
                placeholder="0"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
                style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>To (Target Value) *</label>
              <input
                type="number"
                placeholder="1000000"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
                style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%" }}
              />
            </div>
          </div>

          {/* Unit / Deadline */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Unit *</label>
              <input
                type="text"
                placeholder="e.g., USD, calls, NPS score"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Deadline *</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
                style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%" }}
              />
            </div>
          </div>

          {/* Description */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Description (optional)</label>
            <textarea
              placeholder="Provide context and why this WIG matters..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%", fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", paddingTop: "16px", borderTop: "1px solid #e4e4e7" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ padding: "8px 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em", color: "#18181b" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{ padding: "8px 16px", border: "none", backgroundColor: isLoading ? "#cccccc" : "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: isLoading ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              {isLoading ? "Creating..." : "Create WIG"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function WIGEditForm({ wig, onCancel, onSuccess }: { wig: WIG; onCancel: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState(wig.title);
  const [deadline, setDeadline] = useState(wig.deadline.toISOString().split('T')[0]);
  const [description, setDescription] = useState(wig.description || "");

  const { updateWIG, isLoading, error } = useUpdateWIG();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !deadline) {
      return;
    }

    try {
      await updateWIG({
        wigId: wig.id,
        data: {
          title,
          deadline: new Date(deadline),
          description: description || undefined,
        },
      });
      onSuccess();
    } catch {
      // Error is handled in the hook
    }
  };

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "672px", backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px", display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Header */}
        <div style={{ borderBottom: "1px solid #e4e4e7", paddingBottom: "16px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em" }}>Edit WIG</h1>
          <p style={{ fontSize: "14px", color: "#71717a", marginTop: "8px" }}>Update your Wildly Important Goal details.</p>
        </div>

        {/* Error */}
        {error && <ErrorState error={error} title="Failed to update WIG" />}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Title */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Title *</label>
            <input
              type="text"
              placeholder="e.g., Annual Recurring Revenue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%" }}
            />
          </div>

          {/* Deadline */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Deadline *</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%" }}
            />
          </div>

          {/* Description */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Description (optional)</label>
            <textarea
              placeholder="Provide context and why this WIG matters..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%", fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", paddingTop: "16px", borderTop: "1px solid #e4e4e7" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ padding: "8px 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em", color: "#18181b" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{ padding: "8px 16px", border: "none", backgroundColor: isLoading ? "#cccccc" : "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: isLoading ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              {isLoading ? "Updating..." : "Update WIG"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}