"use client";

import { useState } from "react";
import { useMyTeams } from "@/lib/hooks";
import { useUserStore } from "@/lib/stores/user-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { RoleBadge } from "@/lib/components/role-badge";
import { AssignLeadModal } from "@/lib/components/assign-lead-modal";
import Link from "next/link";

export default function AdminTeamsPage() {
  const { orgSlug } = useUserStore();
  const { teams, isLoading, error } = useMyTeams(orgSlug);
  const [selectedTeamSlug, setSelectedTeamSlug] = useState<string | null>(null);
  const [assignLeadTeam, setAssignLeadTeam] = useState<any | null>(null);

  if (error) return <ErrorState error={error} />;
  if (isLoading) {
    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <div style={{ textAlign: "center", color: "#71717a" }}>Loading teams...</div>
      </main>
    );
  }

  if (!teams || teams.length === 0) {
    return <EmptyState title="No teams" description="Create your first team to get started" />;
  }

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "600", margin: "0 0 8px 0" }}>Team Management</h1>
          <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>Assign team leads and manage team members</p>
        </div>

        {/* Teams Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {teams.map((team: any) => {
            const teamLeads = (team.members || []).filter((m: any) => m.role === "TEAM_LEAD");
            const memberCount = team.members?.length || 0;

            return (
              <div
                key={team.slug}
                onClick={() => setSelectedTeamSlug(team.slug)}
                style={{
                  border: "1px solid #e4e4e7",
                  borderRadius: "8px",
                  padding: "16px",
                  cursor: "pointer",
                  backgroundColor: selectedTeamSlug === team.slug ? "#f4f4f5" : "white",
                  transition: "all 200ms",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>{team.name}</h3>
                  <div style={{ fontSize: "12px", color: "#71717a", backgroundColor: "#f4f4f5", padding: "4px 8px", borderRadius: "4px" }}>
                    {memberCount} member{memberCount !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Team Leads */}
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>Team Leads</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {teamLeads.length > 0 ? (
                      teamLeads.map((lead: any) => (
                        <div
                          key={lead.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            backgroundColor: "#dbeafe",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                          }}
                        >
                          {lead.email?.split("@")[0] || "Lead"}
                          <RoleBadge role="TEAM_LEAD" size="sm" />
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: "12px", color: "#a1a1aa" }}>No team leads assigned</span>
                    )}
                  </div>
                </div>

                {/* Active WIGs */}
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>Active WIGs</p>
                  <p style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#18181b" }}>{team.wigs?.length || 0}</p>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setAssignLeadTeam(team)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      fontSize: "12px",
                      borderRadius: "6px",
                      border: "1px solid #3b82f6",
                      backgroundColor: "#eff6ff",
                      color: "#0c4a6e",
                      cursor: "pointer",
                      fontWeight: "500",
                    }}
                  >
                    Assign Lead
                  </button>
                  <button
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      fontSize: "12px",
                      borderRadius: "6px",
                      border: "1px solid #e4e4e7",
                      backgroundColor: "white",
                      cursor: "pointer",
                      fontWeight: "500",
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Team Details Panel */}
        {selectedTeamSlug && (
          <div style={{ marginTop: "32px", padding: "24px", border: "1px solid #e4e4e7", borderRadius: "8px", backgroundColor: "#fafafa" }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600" }}>Team Details</h2>
            <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>
              Select a team to manage team leads, view members, and track team performance
            </p>
          </div>
        )}

        {/* Assign Lead Modal */}
        {assignLeadTeam && (
          <AssignLeadModal
            team={assignLeadTeam}
            onClose={() => setAssignLeadTeam(null)}
            onAssign={(userId, teamSlug) => {
              console.log("Assigning user", userId, "as lead for team", teamSlug);
              // TODO: Call backend API to assign team lead
              setAssignLeadTeam(null);
            }}
            isLoading={false}
          />
        )}
      </div>
    </main>
  );
}
