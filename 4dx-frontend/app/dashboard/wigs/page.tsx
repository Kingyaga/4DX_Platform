"use client";

import { useState } from "react";
import { useWIGs, useCreateWIG, useRoleCheck } from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { WIGListSkeleton } from "@/lib/components/skeletons";
import { ErrorState, EmptyState } from "@/lib/components/states";
import type { WIG } from "@/lib/types";

export default function WIGsPage() {
  const [selectedWIG, setSelectedWIG] = useState<WIG | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const currentTeamSlug = useTeamStore((state) => state.currentTeamSlug);
  const { wigs, isLoading, error, refetch } = useWIGs(currentTeamSlug);
  const { canCreateWIG } = useRoleCheck();

  if (!currentTeamSlug) {
    return (
      <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
        <ErrorState
          error={{ code: "NOT_FOUND", httpStatus: 404, message: "No team selected. Please select a team first." }}
          title="No Team Selected"
        />
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
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7" }}>
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

      {/* Loading */}
      {isLoading && <WIGListSkeleton count={3} />}

      {/* Error */}
      {error && <ErrorState error={error} title="Failed to load WIGs" onRetry={() => refetch()} />}

      {/* Empty State */}
      {!isLoading && !error && wigs.length === 0 && (
        <EmptyState
          title="No WIGs yet"
          description="Create your first Wildly Important Goal to get started."
          icon="🎯"
          action={{
            label: "Create WIG",
            onClick: () => setShowNew(true),
          }}
        />
      )}

      {/* WIG List */}
      {!isLoading && wigs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {wigs.map((wig: WIG, i: number) => {
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
    </main>
  );
}

function WIGDetail({ wig, onBack }: { wig: WIG; onBack: () => void }) {
  const progress = ((wig.currentValue - wig.fromValue) / (wig.toValue - wig.fromValue)) * 100;
  const statusColor = wig.status === "ACTIVE" ? "#16A34A" : wig.status === "DRAFT" ? "#71717a" : "#EAB308";

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
      <div style={{ marginBottom: "32px", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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
        <button style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", border: "1px solid #000000", backgroundColor: "transparent", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", color: "#18181b" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
          Edit WIG
        </button>
      </div>

      {/* Progress */}
      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px", marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "16px" }}>
          <div>
            <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "4px" }}>Lag Measure Progress</span>
            <span style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.03em", color: "#18181b" }}>{wig.currentValue.toFixed(1)}</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "4px" }}>Target</span>
            <span style={{ fontSize: "20px", fontWeight: 600, color: "#18181b" }}>{wig.toValue.toFixed(1)}</span>
          </div>
        </div>
        <div style={{ width: "100%", height: "4px", backgroundColor: "#e4e4e7", marginBottom: "8px", position: "relative" }}>
          <div style={{ height: "100%", backgroundColor: "#18181b", width: `${Math.min(progress, 100)}%` }}></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#71717a" }}>
          <span>Baseline: {wig.fromValue}</span>
          <span>Deadline: {new Date(wig.deadline).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Lead Measures */}
      <div>
        <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#18181b", marginBottom: "16px", paddingBottom: "8px", borderBottom: "1px solid #e4e4e7" }}>Lead Measures ({wig.leadMeasures.length})</h2>
        {wig.leadMeasures.length === 0 ? (
          <EmptyState
            title="No lead measures yet"
            description="Add lead measures to track progress toward this WIG."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {wig.leadMeasures.map((lm) => {
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
        deadline: new Date(deadline).toISOString() as any,
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