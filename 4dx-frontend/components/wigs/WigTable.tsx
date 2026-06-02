"use client";

import { useEffect, useState } from "react";
import { useWIGs, useCreateWIG, useUpdateWIG, useCreateLeadMeasure, useRoleCheck, useMyTeams, useActivateWIG, useTeam, useCloseWIG, useUpdateLeadMeasureOwners, useArchiveLeadMeasure } from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { useUserStore } from "@/lib/stores/user-store";
import { WIGListSkeleton } from "@/lib/components/skeletons";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { PageLoader } from "@/lib/components/loading-spinner";
import type { WIG, LeadMeasure, TeamMember, TrackingType } from "@/lib/types";

type CreateWigTrackingType = "NUMERIC" | "MILESTONE" | "COMPLETION" | "HYBRID" | "CUSTOM";

function isNonNumericWig(trackingType: TrackingType) {
  return trackingType !== "NUMERIC";
}

function isNonNumericLeadMeasure(trackingType: TrackingType) {
  return trackingType !== "NUMERIC" && trackingType !== "PERCENTAGE" && trackingType !== "DURATION";
}

function getWigProgress(wig: WIG) {
  if (isNonNumericWig(wig.trackingType)) {
    if (!wig.leadMeasures.length) return 0;
    const total = wig.leadMeasures.reduce((sum, leadMeasure) => sum + getLeadMeasureProgress(leadMeasure), 0);
    return Math.round(total / wig.leadMeasures.length);
  }

  const from = wig.fromValue ?? 0;
  const to = wig.toValue ?? 0;
  const current = wig.currentValue ?? from;
  if (to <= from) return 0;
  return Math.min(100, Math.max(0, ((current - from) / (to - from)) * 100));
}

function getLeadMeasureProgress(leadMeasure: LeadMeasure) {
  if (isNonNumericLeadMeasure(leadMeasure.trackingType)) {
    const latest = [...(leadMeasure.activityLogs || [])].sort((a, b) => new Date(b.loggedForDate).getTime() - new Date(a.loggedForDate).getTime())[0];
    if (latest?.progressStatus === "DONE") return 100;
    if (latest?.progressStatus === "IN_PROGRESS") return 50;
    if (latest?.progressStatus === "BLOCKED") return 25;
    return 0;
  }

  const target = leadMeasure.targetValue ?? 0;
  if (target <= 0) return 0;
  const total = (leadMeasure.activityLogs || []).reduce((sum, log) => sum + (log.value ?? 0), 0);
  return Math.min(100, Math.round((total / target) * 100));
}

export function WigTable() {
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
      return <PageLoader text="Loading teams..." />;
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
    return <WigCreationModal onCancel={() => setShowNew(false)} onSuccess={() => { setShowNew(false); refetch(); }} />;
  }

  if (selectedWIG) {
    const isClosed = ["ACHIEVED", "MISSED", "ABANDONED"].includes(selectedWIG.status);
    if (isClosed) {
      return <WigHistoryPanel wig={selectedWIG} onBack={() => setSelectedWIG(null)} />;
    }
    return <WigEditPanel wig={selectedWIG} onBack={() => setSelectedWIG(null)} />;
  }

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div data-tour="wigs-header" style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", flexWrap: "wrap", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em", textTransform: "uppercase" }}>WIGs</h1>
          <p style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>Wildly Important Goals &mdash; your team&apos;s highest priorities.</p>
        </div>
        {canCreateWIG && (
          <button
            data-tour="create-wig-button"
            onClick={() => setShowNew(true)}
            style={{ backgroundColor: "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 16px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
            Create WIG
          </button>
        )}
      </div>

      <div data-tour="wigs-tabs" style={{ display: "flex", gap: "12px", marginBottom: "32px", flexWrap: "wrap" }}>
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

      <div data-tour="wigs-list">
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
            icon={<span className="material-symbols-outlined">flag</span>}
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
              icon={<span className="material-symbols-outlined">{selectedTab === "current" ? "flag" : "inventory_2"}</span>}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {displayedWigs.map((wig: WIG, i: number) => {
                const statusColor = wig.status === "ACTIVE" ? "#16A34A" : wig.status === "DRAFT" ? "#71717a" : "#EAB308";
                const progress = getWigProgress(wig);
                const targetReached = wig.status === "ACTIVE" && progress >= 100;
                const isLockedDraft = wig.status === "DRAFT" && !canCreateWIG;

                return (
                  <div
                    key={wig.id}
                    onClick={() => {
                      if (!isLockedDraft) setSelectedWIG(wig);
                    }}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      backgroundColor: isLockedDraft ? "#f4f4f5" : targetReached ? "#fffbeb" : hoveredRow === i ? "#f7f9fd" : "#ffffff",
                      border: targetReached ? "1px solid #f59e0b" : "1px solid #e4e4e7",
                      padding: "20px",
                      cursor: isLockedDraft ? "not-allowed" : "pointer",
                      transition: "background 0.075s",
                      opacity: isLockedDraft ? 0.68 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "2px 8px", border: "1px solid #e4e4e7", backgroundColor: "#f4f4f5", fontSize: "12px", fontWeight: 600 }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: statusColor, display: "inline-block" }}></span>
                            {wig.status}
                          </span>
                          {targetReached && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", backgroundColor: "#f59e0b", color: "#ffffff", fontSize: "12px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>emoji_events</span>
                              Target Reached
                            </span>
                          )}
                          <span style={{ fontSize: "12px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Wildly Important Goal</span>
                          {wig.trackingType !== "NUMERIC" && (
                            <span style={{ fontSize: "12px", color: "#52525b", backgroundColor: "#e4e4e7", padding: "2px 8px", fontWeight: 700 }}>Milestone</span>
                          )}
                        </div>
                        <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.01em" }}>{wig.title}</h2>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#71717a", marginLeft: "16px" }}>chevron_right</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "12px", color: "#71717a" }}>Deadline: {new Date(wig.deadline).toLocaleDateString()}</span>
                      {wig.status !== "DRAFT" && (
                        <div style={{ flex: 1, height: "4px", backgroundColor: "#e4e4e7" }}>
                          <div style={{ height: "100%", backgroundColor: targetReached ? "#f59e0b" : "#18181b", width: `${Math.min(progress, 100)}%` }}></div>
                        </div>
                      )}
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#18181b" }}>{wig.leadMeasures.length} Lead Measures</span>
                      {isLockedDraft && <span style={{ fontSize: "12px", color: "#71717a" }}>Visible after team lead activation</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
        )}
      </div>
    </main>
  );
}

export function WigEditPanel({ wig, onBack }: { wig: WIG; onBack: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showAddLeadMeasure, setShowAddLeadMeasure] = useState(false);
  const [leadMeasureName, setLeadMeasureName] = useState("");
  const [leadMeasureDescription, setLeadMeasureDescription] = useState("");
  const [cadence, setCadence] = useState<"WEEKLY" | "BIWEEKLY">("WEEKLY");
  const [leadMeasureTrackingType, setLeadMeasureTrackingType] = useState<TrackingType>("NUMERIC");
  const [targetValue, setTargetValue] = useState("");
  const [leadMeasureUnit, setLeadMeasureUnit] = useState(wig.unit || "");
  const [ownerUserIds, setOwnerUserIds] = useState<string[]>([]);
  const [activeWig, setActiveWig] = useState<WIG>(wig);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeStatus, setCloseStatus] = useState<"ACHIEVED" | "MISSED" | "ABANDONED">("ACHIEVED");
  const [editingOwnersForLm, setEditingOwnersForLm] = useState<string | null>(null);
  const [newOwnerIds, setNewOwnerIds] = useState<string[]>([]);

  const { createLeadMeasure, isLoading: isCreatingLeadMeasure, error: createLeadMeasureError } = useCreateLeadMeasure();
  const { updateOwners, isLoading: isUpdatingOwners } = useUpdateLeadMeasureOwners();
  const { archiveLeadMeasure, isLoading: isArchivingLeadMeasure } = useArchiveLeadMeasure();
  const { activateWIG, isLoading: isActivatingWIG, error: activateWIGError } = useActivateWIG();
  const { closeWIG, isLoading: isClosingWIG, error: closeWIGError } = useCloseWIG();
  const { canArchiveWIG, canCreateWIG } = useRoleCheck();
  const currentTeamSlug = useTeamStore((state) => state.currentTeamSlug);
  const { team } = useTeam(currentTeamSlug);
  const progress = getWigProgress(activeWig);
  const numericTargetReached =
    activeWig.trackingType === "NUMERIC" &&
    activeWig.currentValue !== null &&
    activeWig.toValue !== null &&
    activeWig.currentValue >= activeWig.toValue;
  const statusColor = activeWig.status === "ACTIVE" ? "#16A34A" : activeWig.status === "DRAFT" ? "#71717a" : "#EAB308";

  useEffect(() => {
    setActiveWig(wig);
    setLeadMeasureUnit(wig.unit || "");
    setLeadMeasureTrackingType(wig.trackingType !== "NUMERIC" ? "MILESTONE" : "NUMERIC");
  }, [wig]);

  const canAddLeadMeasure = canCreateWIG && activeWig.leadMeasures.length < 3;
  const canActivateWIG =
    canCreateWIG &&
    activeWig.status === "DRAFT" &&
    activeWig.leadMeasures.length >= 1 &&
    activeWig.leadMeasures.length <= 3 &&
    activeWig.leadMeasures.every((leadMeasure) => (leadMeasure.owners?.length || 0) > 0);

  const handleCreateLeadMeasure = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!leadMeasureName || !cadence || ownerUserIds.length === 0) {
      return;
    }

    if ((leadMeasureTrackingType === "NUMERIC" || leadMeasureTrackingType === "PERCENTAGE" || leadMeasureTrackingType === "DURATION") && (!targetValue || !leadMeasureUnit)) {
      return;
    }

    try {
      const created = await createLeadMeasure({
        wigId: activeWig.id,
        name: leadMeasureName,
        description: leadMeasureDescription || undefined,
        trackingType: leadMeasureTrackingType,
        cadence,
        targetValue: leadMeasureTrackingType === "NUMERIC" || leadMeasureTrackingType === "PERCENTAGE" || leadMeasureTrackingType === "DURATION" ? parseFloat(targetValue) : undefined,
        unit: leadMeasureTrackingType === "NUMERIC" || leadMeasureTrackingType === "PERCENTAGE" || leadMeasureTrackingType === "DURATION" ? leadMeasureUnit : undefined,
        ownerUserIds,
      });

      setActiveWig((prev) => ({
        ...prev,
        leadMeasures: [...prev.leadMeasures, created],
      }));
      setShowAddLeadMeasure(false);
      setLeadMeasureName("");
      setLeadMeasureDescription("");
      setCadence("WEEKLY");
      setLeadMeasureTrackingType(wig.trackingType !== "NUMERIC" ? "MILESTONE" : "NUMERIC");
      setTargetValue("");
      setLeadMeasureUnit(wig.unit || "");
      setOwnerUserIds([]);
    } catch {
      // Error is surfaced by hook state
    }
  };

  const handleActivateWIG = async () => {
    try {
      const activated = await activateWIG({ wigId: activeWig.id });
      setActiveWig((current) => ({ ...current, status: activated.status }));
    } catch {
      // Error is surfaced by hook state
    }
  };

  const handleCloseWIG = async () => {
    try {
      await closeWIG({ wigId: activeWig.id, status: closeStatus });
      setShowCloseModal(false);
      onBack();
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
      <div data-tour="wig-detail-header" style={{ marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "2px 8px", border: "1px solid #e4e4e7", backgroundColor: "#f4f4f5", fontSize: "12px", fontWeight: 600 }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: statusColor, display: "inline-block" }}></span>
              {activeWig.status}
            </span>
            <span style={{ fontSize: "12px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Wildly Important Goal</span>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em" }}>{wig.title}</h1>
        </div>
        {canArchiveWIG && (
          <div style={{ display: "flex", gap: "8px" }}>
            {activeWig.status === "ACTIVE" && (
              <button
                data-tour="close-wig-button"
                onClick={() => setShowCloseModal(true)}
                style={{ backgroundColor: "#ef4444", color: "#ffffff", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 16px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>lock</span>
                Close WIG
              </button>
            )}
            <button
              data-tour="edit-wig-button"
              onClick={() => setIsEditing(true)}
              style={{ backgroundColor: "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 16px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
              Edit WIG
            </button>
          </div>
        )}
      </div>

      {activateWIGError && <ErrorState error={activateWIGError} title="Unable to activate WIG" />}

      <div style={{ marginBottom: "24px", padding: "16px", borderRadius: "16px", backgroundColor: canArchiveWIG ? "#ecfdf5" : "#f8fafc", border: `1px solid ${canArchiveWIG ? "#10b981" : "#e4e4e7"}`, color: canArchiveWIG ? "#166534" : "#52525b" }}>
        {canArchiveWIG
          ? activeWig.status === "DRAFT"
            ? "This WIG is a draft. Add 1-3 owned lead measures, then activate it to put it on the scoreboard."
            : "You are the current team lead for this team, so WIG actions are available to you."
          : "This WIG is read-only unless you are the current team lead for the selected team."}
      </div>

      {canCreateWIG && activeWig.status === "DRAFT" && (
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "flex-end" }}>
          <button
            data-tour="activate-wig-button"
            type="button"
            onClick={handleActivateWIG}
            disabled={!canActivateWIG || isActivatingWIG}
            title={!canActivateWIG ? "Add 1-3 lead measures and assign at least one owner to each." : undefined}
            style={{
              backgroundColor: canActivateWIG && !isActivatingWIG ? "#16A34A" : "#d4d4d8",
              color: canActivateWIG && !isActivatingWIG ? "#ffffff" : "#71717a",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              padding: "10px 16px",
              border: "none",
              cursor: canActivateWIG && !isActivatingWIG ? "pointer" : "not-allowed",
            }}
          >
            {isActivatingWIG ? "Activating..." : "Activate WIG"}
          </button>
        </div>
      )}

      {activeWig.status === "ACTIVE" && numericTargetReached && (
        <div style={{ marginBottom: "20px", padding: "16px 20px", backgroundColor: "#fffbeb", border: "1px solid #f59e0b", display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "#f59e0b" }}>emoji_events</span>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#92400e" }}>Target Reached!</div>
            <div style={{ fontSize: "13px", color: "#92400e", marginTop: "2px" }}>
              This WIG has hit its goal. Close it as <strong>ACHIEVED</strong> to record the win and notify the team.
            </div>
          </div>
          {canArchiveWIG && (
            <button
              onClick={() => setShowCloseModal(true)}
              style={{ marginLeft: "auto", flexShrink: 0, backgroundColor: "#f59e0b", color: "#ffffff", fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "8px 16px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>lock</span>
              Close as Achieved
            </button>
          )}
        </div>
      )}

      <div style={{ width: "100%", height: "4px", backgroundColor: "#e4e4e7", marginBottom: "8px", position: "relative" }}>
        <div style={{ height: "100%", backgroundColor: numericTargetReached ? "#f59e0b" : "#18181b", width: `${Math.min(progress, 100)}%` }}></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#71717a" }}>
        <span>{activeWig.trackingType !== "NUMERIC" ? "Outcome-based WIG" : `Baseline: ${activeWig.fromValue ?? 0}`}</span>
        <span>Deadline: {new Date(activeWig.deadline).toLocaleDateString()}</span>
      </div>

      {/* Lead Measures */}
      <div>
        <div data-tour="lead-measures-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "16px", paddingBottom: "8px", borderBottom: "1px solid #e4e4e7" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b" }}>Lead Measures ({activeWig.leadMeasures.length})</h2>
          {canCreateWIG && (
            <button
              data-tour="add-lead-measure-button"
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
          <form data-tour="lead-measure-form" onSubmit={handleCreateLeadMeasure} style={{ display: "grid", gap: "16px", marginBottom: "24px", padding: "20px", backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: "16px" }}>
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
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#18181b" }}>Tracking Type *</label>
                <select
                  value={leadMeasureTrackingType}
                  onChange={(e) => setLeadMeasureTrackingType(e.target.value as TrackingType)}
                  style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "10px", fontSize: "14px", outline: "none" }}
                >
                  <option value="NUMERIC">Numeric target</option>
                  <option value="MILESTONE">Milestone / qualitative</option>
                  <option value="BOOLEAN">Boolean / completion</option>
                  <option value="TIME">Time of day</option>
                  <option value="TEXT">Text update</option>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="DURATION">Duration</option>
                  <option value="CHECKLIST">Checklist</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: leadMeasureTrackingType === "NUMERIC" || leadMeasureTrackingType === "PERCENTAGE" || leadMeasureTrackingType === "DURATION" ? "1fr 1fr 1fr" : "1fr", gap: "16px" }}>
              {(leadMeasureTrackingType === "NUMERIC" || leadMeasureTrackingType === "PERCENTAGE" || leadMeasureTrackingType === "DURATION") && (
                <>
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
                </>
              )}
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

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#18181b" }}>Owner(s) *</label>
              <div style={{ display: "grid", gap: "8px" }}>
                {(team?.members || []).map((member: TeamMember) => (
                  <label key={member.userId} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#18181b" }}>
                    <input
                      type="checkbox"
                      checked={ownerUserIds.includes(member.userId)}
                      onChange={(event) => {
                        setOwnerUserIds((current) =>
                          event.target.checked
                            ? [...current, member.userId]
                            : current.filter((userId) => userId !== member.userId),
                        );
                      }}
                    />
                    {member.user.name} <span style={{ color: "#71717a" }}>({member.role})</span>
                  </label>
                ))}
              </div>
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

        {closeWIGError && <ErrorState error={closeWIGError} title="Unable to close WIG" />}

        {/* Close WIG Modal */}
        {showCloseModal && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "32px", maxWidth: "480px", width: "100%", margin: "16px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", marginBottom: "8px" }}>Close WIG</h2>
              <p style={{ fontSize: "14px", color: "#71717a", marginBottom: "24px" }}>
                This is irreversible. Once closed, this WIG becomes read-only and will appear in Closed History.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#18181b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Outcome *</label>
                {(["ACHIEVED", "MISSED", "ABANDONED"] as const).map((s) => (
                  <label key={s} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", border: `1px solid ${closeStatus === s ? "#18181b" : "#e4e4e7"}`, backgroundColor: closeStatus === s ? "#f4f4f5" : "#ffffff", cursor: "pointer", fontSize: "14px", fontWeight: 500 }}>
                    <input type="radio" name="closeStatus" value={s} checked={closeStatus === s} onChange={() => setCloseStatus(s)} />
                    <span style={{ color: s === "ACHIEVED" ? "#16A34A" : s === "MISSED" ? "#ef4444" : "#71717a" }}>{s}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowCloseModal(false)}
                  disabled={isClosingWIG}
                  style={{ padding: "10px 16px", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em", color: "#18181b" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseWIG}
                  disabled={isClosingWIG}
                  style={{ padding: "10px 16px", border: "none", backgroundColor: "#ef4444", color: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: isClosingWIG ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  {isClosingWIG ? "Closing..." : `Close as ${closeStatus}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeWig.leadMeasures.length === 0 ? (
          <EmptyState
            title="No lead measures yet"
            description="Add lead measures to track progress toward this WIG."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {activeWig.leadMeasures.map((lm) => {
              const totalLogged = (lm.activityLogs || []).reduce((sum, log) => sum + (log.value ?? 0), 0);
              const lmProgress = getLeadMeasureProgress(lm);
              const leadMeasureCompleted = lmProgress >= 100;
              const latestStatus = [...(lm.activityLogs || [])].sort((a, b) => new Date(b.loggedForDate).getTime() - new Date(a.loggedForDate).getTime())[0]?.progressStatus;

              return (
                <div key={lm.id} style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#18181b", margin: 0 }}>{lm.name}</h3>
                    {leadMeasureCompleted && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", border: "1px solid #16A34A", backgroundColor: "#f0fdf4", color: "#16A34A", fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>check_circle</span>
                        Completed
                      </span>
                    )}
                  </div>
                  {(lm.owners?.length || 0) > 0 && (
                    <p style={{ fontSize: "12px", color: "#52525b", marginBottom: "8px" }}>
                      Owners: {lm.owners?.map((owner) => owner.user.name).join(", ")}
                    </p>
                  )}
                  {canCreateWIG && (
                    <div style={{ display: "flex", gap: "12px", marginBottom: "8px" }}>
                      <button
                        onClick={() => {
                          setEditingOwnersForLm(lm.id);
                          setNewOwnerIds(lm.owners?.map((o: any) => o.userId) ?? []);
                        }}
                        style={{ fontSize: "12px", color: "#71717a", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                      >
                        Edit owners
                      </button>
                      <button
                        onClick={async () => {
                          const confirmed = window.confirm(`Delete "${lm.name}"? It will be archived with its history.`);
                          if (!confirmed) return;
                          await archiveLeadMeasure({ leadMeasureId: lm.id });
                          setActiveWig((prev) => ({
                            ...prev,
                            leadMeasures: prev.leadMeasures.filter((m) => m.id !== lm.id),
                          }));
                        }}
                        disabled={isArchivingLeadMeasure}
                        style={{ fontSize: "12px", color: "#b91c1c", background: "none", border: "none", cursor: isArchivingLeadMeasure ? "not-allowed" : "pointer", textDecoration: "underline", padding: 0 }}
                      >
                        Delete lead measure
                      </button>
                    </div>
                  )}
                  {editingOwnersForLm === lm.id && (
                    <div style={{ marginTop: "8px", marginBottom: "12px", padding: "12px", border: "1px solid #e4e4e7", backgroundColor: "#f8fafc" }}>
                      <p style={{ fontSize: "12px", fontWeight: 600, color: "#71717a", marginBottom: "8px", textTransform: "uppercase" }}>Select owners</p>
                      {(team?.members || []).map((member: any) => {
                        const userId = member.userId || member.id;
                        const name = member.user?.name || member.user?.email || userId;
                        const isChecked = newOwnerIds.includes(userId);
                        return (
                          <label key={userId} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => setNewOwnerIds((prev) => isChecked ? prev.filter((id) => id !== userId) : [...prev, userId])}
                            />
                            <span style={{ fontSize: "13px", color: "#18181b" }}>{name}</span>
                          </label>
                        );
                      })}
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <button
                          onClick={async () => {
                            if (newOwnerIds.length === 0) return;
                            try {
                              const updated = await updateOwners({ leadMeasureId: lm.id, ownerUserIds: newOwnerIds });
                              setActiveWig((prev) => ({
                                ...prev,
                                leadMeasures: prev.leadMeasures.map((m) => m.id === lm.id ? { ...m, owners: (updated as any).owners } : m),
                              }));
                              setEditingOwnersForLm(null);
                            } catch {}
                          }}
                          disabled={isUpdatingOwners || newOwnerIds.length === 0}
                          style={{ padding: "6px 16px", backgroundColor: "#18181b", color: "#ffffff", border: "none", fontSize: "12px", fontWeight: 600, cursor: isUpdatingOwners || newOwnerIds.length === 0 ? "not-allowed" : "pointer" }}
                        >
                          {isUpdatingOwners ? "Saving…" : "Save owners"}
                        </button>
                        <button
                          onClick={() => setEditingOwnersForLm(null)}
                          style={{ padding: "6px 16px", backgroundColor: "transparent", border: "1px solid #e4e4e7", fontSize: "12px", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {lm.description && (
                    <p style={{ fontSize: "14px", color: "#71717a", marginBottom: "12px" }}>{lm.description}</p>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "4px" }}>Progress</span>
                      <span style={{ fontSize: "20px", fontWeight: 600, color: "#18181b" }}>
                        {isNonNumericLeadMeasure(lm.trackingType)
                          ? `${latestStatus ? latestStatus.replace(/_/g, " ") : "No update"} (${lmProgress}%)`
                          : `${totalLogged.toFixed(1)} / ${(lm.targetValue ?? 0).toFixed(1)} ${lm.unit ?? ""}`}
                      </span>
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

export function WigHistoryPanel({ wig, onBack }: { wig: WIG; onBack: () => void }) {
  const outcomeColor = wig.status === "ACHIEVED" ? "#16A34A" : wig.status === "MISSED" ? "#ef4444" : "#71717a";
  const outcomeIcon = wig.status === "ACHIEVED" ? "emoji_events" : wig.status === "MISSED" ? "cancel" : "archive";
  const finalProgress = getWigProgress(wig);
  const leadMeasureCompletionEvents = wig.leadMeasures
    .map((lm) => {
      if (isNonNumericLeadMeasure(lm.trackingType)) {
        const completionLog = [...(lm.activityLogs || [])]
          .sort((a, b) => new Date(a.loggedForDate).getTime() - new Date(b.loggedForDate).getTime())
          .find((log) => log.progressStatus === "DONE");

        return completionLog
          ? {
              leadMeasureName: lm.name,
              completedAt: new Date(completionLog.loggedForDate),
              value: 100,
              targetValue: 100,
              unit: "% complete",
            }
          : null;
      }

      let runningTotal = 0;
      const completionLog = [...(lm.activityLogs || [])]
        .sort((a, b) => new Date(a.loggedForDate).getTime() - new Date(b.loggedForDate).getTime())
        .find((log) => {
          runningTotal += log.value ?? 0;
          return (lm.targetValue ?? 0) > 0 && runningTotal >= (lm.targetValue ?? 0);
        });

      return completionLog
        ? {
            leadMeasureName: lm.name,
            completedAt: new Date(completionLog.loggedForDate),
            value: runningTotal,
            targetValue: lm.targetValue ?? 0,
            unit: lm.unit ?? "",
          }
        : null;
    })
    .filter((event): event is { leadMeasureName: string; completedAt: Date; value: number; targetValue: number; unit: string } => Boolean(event))
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  const finalCompletionEvent = leadMeasureCompletionEvents[0] || null;

  // Duration: from createdAt to closedAt
  const startDate = new Date(wig.createdAt);
  const endDate = wig.closedAt ? new Date(wig.closedAt) : new Date(wig.deadline);
  const durationDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
      {/* Back */}
      <button
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "#71717a", background: "none", border: "none", cursor: "pointer", marginBottom: "24px", textTransform: "uppercase", letterSpacing: "0.05em" }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_back</span>
        Back to History
      </button>

      {/* Outcome banner */}
      <div style={{ backgroundColor: outcomeColor, color: "#ffffff", padding: "20px 24px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "36px" }}>{outcomeIcon}</span>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8, marginBottom: "4px" }}>
            {wig.status === "ACHIEVED" ? "Goal Achieved" : wig.status === "MISSED" ? "Goal Missed" : "Goal Abandoned"}
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em" }}>{wig.title}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: "11px", opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Closed</div>
          <div style={{ fontSize: "14px", fontWeight: 600 }}>
            {wig.closedAt ? new Date(wig.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
          </div>
        </div>
      </div>

      {/* Lag measure summary */}
      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "24px", marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#71717a", marginBottom: "16px" }}>Lag Measure — Final Result</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "40px", fontWeight: 700, letterSpacing: "-0.03em", color: "#18181b" }}>
              {wig.trackingType !== "NUMERIC" ? `${finalProgress}%` : (wig.currentValue ?? wig.fromValue ?? 0)} <span style={{ fontSize: "18px", fontWeight: 500, color: "#71717a" }}>{wig.trackingType !== "NUMERIC" ? "complete" : wig.unit}</span>
            </div>
            <div style={{ fontSize: "13px", color: "#71717a", marginTop: "4px" }}>
              {wig.trackingType !== "NUMERIC"
                ? "Outcome-based goal measured through milestone lead measures."
                : `Baseline: ${wig.fromValue ?? 0} ${wig.unit ?? ""} -> Target: ${wig.toValue ?? 0} ${wig.unit ?? ""}`}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "32px", fontWeight: 700, color: outcomeColor }}>{finalProgress}%</div>
            <div style={{ fontSize: "12px", color: "#71717a" }}>lead measure completion</div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ width: "100%", height: "8px", backgroundColor: "#e4e4e7", marginBottom: "8px" }}>
          <div style={{ height: "100%", backgroundColor: outcomeColor, width: `${finalProgress}%`, transition: "width 0.3s" }}></div>
        </div>
        {/* Timeline */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#71717a", marginTop: "8px", flexWrap: "wrap", gap: "8px" }}>
          <span>Started: {startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          <span>Deadline: {new Date(wig.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          <span>Duration: {durationDays} day{durationDays !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px", marginBottom: "24px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#71717a", marginBottom: "12px" }}>Auto-Close Audit</div>
        {finalCompletionEvent ? (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#18181b" }}>{finalCompletionEvent.leadMeasureName}</div>
              <div style={{ fontSize: "13px", color: "#71717a", marginTop: "4px" }}>
                Final lead measure to cross target.
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#18181b" }}>
                {finalCompletionEvent.completedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <div style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>
                {finalCompletionEvent.value.toFixed(1)} / {finalCompletionEvent.targetValue.toFixed(1)} {finalCompletionEvent.unit}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "13px", color: "#71717a" }}>
            This WIG was closed manually before every lead measure crossed its target.
          </div>
        )}
      </div>

      {/* Lead measures breakdown */}
      <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#71717a", marginBottom: "16px" }}>
        Lead Measure Breakdown
      </div>
      {wig.leadMeasures.length === 0 ? (
        <div style={{ color: "#71717a", fontSize: "14px", padding: "16px", border: "1px solid #e4e4e7", textAlign: "center" }}>No lead measures were tracked for this WIG.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {wig.leadMeasures.map((lm, i) => {
            // Cumulative approved total
            const totalApproved = (lm.activityLogs || []).reduce((sum, log) => sum + (log.value ?? 0), 0);
            const lmPct = getLeadMeasureProgress(lm);
            const lmOnTrack = lmPct >= 100;
            const latestStatus = isNonNumericLeadMeasure(lm.trackingType)
              ? [...(lm.activityLogs || [])].sort((a, b) => new Date(b.loggedForDate).getTime() - new Date(a.loggedForDate).getTime())[0]?.progressStatus
              : null;

            // Per-owner contribution
            const ownerMap: Record<string, { name: string; total: number }> = {};
            for (const log of (lm.activityLogs || []) as any[]) {
              if (!log.userId) continue;
              const name = log.user?.name || log.user?.email || log.userId;
              if (!ownerMap[log.userId]) ownerMap[log.userId] = { name, total: 0 };
              ownerMap[log.userId].total += isNonNumericLeadMeasure(lm.trackingType) ? 1 : (log.value ?? 0);
            }
            const owners = Object.values(ownerMap).sort((a, b) => b.total - a.total);
            const ownerTotal = owners.reduce((sum, owner) => sum + owner.total, 0);

            return (
              <div key={lm.id} style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Lead Measure {i + 1}</div>
                    <div style={{ fontSize: "16px", fontWeight: 600, color: "#18181b" }}>{lm.name}</div>
                    {lm.cadence && <div style={{ fontSize: "12px", color: "#71717a", marginTop: "2px" }}>{lm.cadence}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", border: `1px solid ${lmOnTrack ? "#16A34A" : "#e4e4e7"}`, backgroundColor: lmOnTrack ? "#f0fdf4" : "#f4f4f5" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: lmOnTrack ? "#16A34A" : "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {lmOnTrack ? "Target Met" : `${lmPct}% of target`}
                    </span>
                  </div>
                </div>

                {/* Total vs target */}
                <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 700, color: "#18181b", letterSpacing: "-0.02em" }}>
                    {isNonNumericLeadMeasure(lm.trackingType) ? `${lmPct}%` : totalApproved.toFixed(1)}
                  </span>
                  <span style={{ fontSize: "14px", color: "#71717a", marginBottom: "4px" }}>
                    {isNonNumericLeadMeasure(lm.trackingType) ? (latestStatus ? latestStatus.replace(/_/g, " ") : "No update") : `/ ${(lm.targetValue ?? 0).toFixed(1)} ${lm.unit ?? ""}`}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ width: "100%", height: "4px", backgroundColor: "#e4e4e7", marginBottom: "16px" }}>
                  <div style={{ height: "100%", backgroundColor: lmOnTrack ? "#16A34A" : "#18181b", width: `${lmPct}%` }}></div>
                </div>

                {/* Per-owner breakdown */}
                {owners.length > 0 && (
                  <div style={{ borderTop: "1px solid #f4f4f5", paddingTop: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>Member Contribution</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {owners.map((owner) => {
                        const share = ownerTotal > 0 ? Math.round((owner.total / ownerTotal) * 100) : 0;
                        return (
                          <div key={owner.name}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                              <span style={{ fontSize: "13px", color: "#18181b" }}>{owner.name}</span>
                              <span style={{ fontSize: "13px", fontWeight: 600, color: "#18181b" }}>
                                {isNonNumericLeadMeasure(lm.trackingType) ? `${owner.total} update${owner.total !== 1 ? "s" : ""}` : `${owner.total.toFixed(1)} ${lm.unit ?? ""}`}
                                <span style={{ fontWeight: 400, color: "#71717a", marginLeft: "6px" }}>({share}%)</span>
                              </span>
                            </div>
                            <div style={{ width: "100%", height: "3px", backgroundColor: "#f4f4f5" }}>
                              <div style={{ height: "100%", backgroundColor: "#18181b", width: `${share}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No logs */}
                {owners.length === 0 && (
                  <div style={{ fontSize: "12px", color: "#71717a", fontStyle: "italic" }}>No approved activity logs for this lead measure.</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export function WigCreationModal({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [trackingType, setTrackingType] = useState<CreateWigTrackingType>("NUMERIC");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [unit, setUnit] = useState("USD");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentTeamSlug = useTeamStore((state) => state.currentTeamSlug);
  const { createWIG, isLoading, error } = useCreateWIG();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setValidationError(null);

    if (!currentTeamSlug || !title || !deadline) {
      return;
    }

    let fromValue: number | undefined;
    let toValue: number | undefined;

    if (trackingType === "NUMERIC") {
      if (!from || !to || !unit) {
        setValidationError("Numeric WIGs need current value, target value, and unit.");
        return;
      }

      fromValue = parseFloat(from);
      toValue = parseFloat(to);

      if (Number.isNaN(fromValue) || Number.isNaN(toValue)) {
        setValidationError("Enter valid numeric values for current and target.");
        return;
      }

      if (fromValue < 0 || toValue < 0) {
        setValidationError("Current and target values cannot be negative.");
        return;
      }

      if (toValue <= fromValue) {
        setValidationError("Target value must be greater than current value.");
        return;
      }
    }

    const confirmed = window.confirm(`Create this WIG?\n\n${trackingType === "NUMERIC" ? `Increase ${title} from ${fromValue} to ${toValue}` : title} by ${new Date(deadline).toLocaleDateString()}.`);
    if (!confirmed) return;

    try {
      await createWIG({
        teamSlug: currentTeamSlug,
        title,
        trackingType,
        fromValue,
        toValue,
        unit: trackingType === "NUMERIC" ? unit : undefined,
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
        {validationError && (
          <div style={{ padding: "12px", backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "14px", borderRadius: "4px" }}>
            {validationError}
          </div>
        )}

        {/* Live Preview */}
        <div style={{ backgroundColor: "#f4f4f5", border: "1px solid #e4e4e7", padding: "20px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "8px" }}>Live WIG Statement</span>
          {trackingType === "NUMERIC" ? (
            <p style={{ fontSize: "20px", fontWeight: 600, color: "#18181b" }}>
              Increase <span style={{ color: title ? "#18181b" : "#71717a" }}>{title || "[Title]"}</span>
              {" "}from <span style={{ color: from ? "#18181b" : "#71717a" }}>{from || "[A]"}</span>
              {" "}to <span style={{ color: to ? "#18181b" : "#71717a" }}>{to || "[B]"}</span>
              {" "}by <span style={{ color: deadline ? "#18181b" : "#71717a" }}>{deadline ? new Date(deadline).toLocaleDateString() : "[Date]"}</span>
            </p>
          ) : (
            <p style={{ fontSize: "20px", fontWeight: 600, color: "#18181b" }}>
              Complete <span style={{ color: title ? "#18181b" : "#71717a" }}>{title || "[Outcome]"}</span>
              {" "}by <span style={{ color: deadline ? "#18181b" : "#71717a" }}>{deadline ? new Date(deadline).toLocaleDateString() : "[Date]"}</span>
            </p>
          )}
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

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Tracking Style *</label>
            <select
              value={trackingType}
              onChange={(e) => setTrackingType(e.target.value as CreateWigTrackingType)}
              style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "10px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%" }}
            >
              <option value="NUMERIC">Numeric: from X to Y</option>
              <option value="MILESTONE">Milestone/project: deliver an outcome by a date</option>
              <option value="COMPLETION">Completion: not started/in progress/completed</option>
              <option value="HYBRID">Hybrid/custom: mix milestone and measurable work</option>
            </select>
          </div>

          {/* From / To */}
          {trackingType === "NUMERIC" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>From (Current Value) *</label>
              <input
                type="number"
                min="0"
                step="any"
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
                min="0"
                step="any"
                placeholder="1000000"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
                style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%" }}
              />
            </div>
          </div>}

          {/* Unit / Deadline */}
          <div style={{ display: "grid", gridTemplateColumns: trackingType === "NUMERIC" ? "1fr 1fr" : "1fr", gap: "16px" }}>
            {trackingType === "NUMERIC" && <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Unit *</label>
              <input
                type="text"
                placeholder="e.g., USD, calls, NPS score"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "8px", fontSize: "16px", color: "#18181b", outline: "none", width: "100%" }}
              />
            </div>}
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
