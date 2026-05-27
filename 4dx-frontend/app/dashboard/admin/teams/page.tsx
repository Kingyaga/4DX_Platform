"use client";

import { useState } from "react";
import { useTimedMessage } from "@/lib/useTimedMessage";
import { useAssignTeamLead, useAddTeamMember, useAllTeams, useCreateTeam, useDeleteTeam, useOrgUsers, useRemoveTeamMember } from "@/lib/hooks";
import { useUserStore } from "@/lib/stores/user-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { LoadingSpinner, PageLoader } from "@/lib/components/loading-spinner";
import { RoleBadge } from "@/lib/components/role-badge";
import { AssignLeadModal } from "@/lib/components/assign-lead-modal";
import { CreateTeamModal } from "@/lib/components/create-team-modal";
import type { OrgUser, WIG } from "@/lib/types";

interface TeamMember {
  userId: string;
  teamId: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface Team {
  id: string;
  name: string;
  slug: string;
  members: TeamMember[];
  wigs?: WIG[]; // Optional wigs array
}

export default function AdminTeamsPage() {
  const { orgSlug } = useUserStore();
  const { teams, isLoading, error, refetch } = useAllTeams(orgSlug);
  const { users: orgUsers, isLoading: isOrgUsersLoading } = useOrgUsers(orgSlug);
  const { addMember, isLoading: isAddingMember, error: addMemberError } = useAddTeamMember();
  const { removeMember, isLoading: isRemovingMember, error: removeMemberError } = useRemoveTeamMember();
  const { assignTeamLead, isLoading: isAssigning, error: assignError } = useAssignTeamLead();
  const { createTeam, isLoading: isCreating, error: createError } = useCreateTeam();
  const { deleteTeam, isLoading: isDeletingTeam, error: deleteTeamError } = useDeleteTeam();
  const [selectedTeamSlug, setSelectedTeamSlug] = useState<string | null>(null);
  const [assignLeadTeam, setAssignLeadTeam] = useState<Team | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamActionMessage, setTeamActionMessage] = useTimedMessage<string | null>(null);
  const [teamActionError, setTeamActionError] = useState<string | null>(null);
  const [memberActionMessage, setMemberActionMessage] = useTimedMessage<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [newMemberId, setNewMemberId] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<"LEAD" | "MEMBER">("MEMBER");
  const [successBannerMessage, setSuccessBannerMessage] = useTimedMessage<string | null>(null);

  const handleDeleteTeam = async (team: Team) => {
    const confirmed = window.confirm(`Archive the team "${team.name}"? Teams with active WIGs must close those WIGs first.`);
    if (!confirmed) return;

    try {
      setTeamActionError(null);
      setTeamActionMessage(null);
      await deleteTeam({ teamSlug: team.slug });
      setTeamActionMessage(`Team "${team.name}" has been archived.`);
      refetch();
    } catch (error) {
      setTeamActionError(error instanceof Error ? error.message : `Failed to archive team "${team.name}". Please try again.`);
      console.error("Failed to archive team", error);
    }
  };

  if (error) return <ErrorState error={error} />;
  if (isLoading) {
    return <PageLoader text="Loading teams..." />;
  }

  if (!teams || teams.length === 0) {
    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: "600", margin: "0 0 8px 0" }}>Team Management</h1>
              <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>Assign team leads and manage team members</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: "10px 16px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "500",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              + Create Team
            </button>
          </div>
          <EmptyState title="No teams" description="Create your first team to get started" />
        </div>
        {showCreateModal && (
          <CreateTeamModal
            orgSlug={orgSlug!}
            onClose={() => setShowCreateModal(false)}
            onCreate={async (name, slug) => {
              try {
                await createTeam({ orgSlug: orgSlug!, name, slug });
                setShowCreateModal(false);
                refetch();
              } catch {
                console.error("Failed to create team", createError);
              }
            }}
            isLoading={isCreating}
          />
        )}
      </main>
    );
  }

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "600", margin: "0 0 8px 0" }}>Team Management</h1>
            <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>Assign team leads and manage team members</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: "10px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "500",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            + Create Team
          </button>
        </div>

        {/* Success Banner */}
        {successBannerMessage && (
          <div style={{ marginBottom: "20px", backgroundColor: "#d1fae5", color: "#065f46", borderRadius: "16px", padding: "12px 16px" }}>
            ✓ {successBannerMessage}
          </div>
        )}

        {/* Team action messages */}
        {(teamActionError || teamActionMessage || deleteTeamError) && (
          <div style={{ marginBottom: "20px" }}>
            {teamActionError || deleteTeamError ? (
              <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "16px", padding: "12px 16px" }}>
                {String(teamActionError || deleteTeamError)}
              </div>
            ) : (
              <div style={{ backgroundColor: "#d1fae5", color: "#065f46", borderRadius: "16px", padding: "12px 16px" }}>
                {teamActionMessage}
              </div>
            )}
          </div>
        )}

        {/* Teams Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {teams.map((team: Team) => {
            const teamLeads = (team.members || []).filter((m: TeamMember) => m.role === "LEAD");
            const memberCount = team.members?.length || 0;
            const isExpanded = selectedTeamSlug === team.slug;
            const assignedToThisTeam = new Set(team.members.map((member) => member.userId));
            const availableUsers: OrgUser[] = orgUsers.filter((user: OrgUser) => !assignedToThisTeam.has(user.id));

            return (
              <div
                key={team.slug}
                onClick={() => {
                  setSelectedTeamSlug(isExpanded ? null : team.slug);
                  setMemberActionError(null);
                  setMemberActionMessage(null);
                  setSuccessBannerMessage(null);
                  setNewMemberId("");
                  setNewMemberRole("MEMBER");
                }}
                style={{
                  border: "1px solid #e4e4e7",
                  borderRadius: "8px",
                  padding: "16px",
                  cursor: "pointer",
                  backgroundColor: isExpanded ? "#f4f4f5" : "white",
                  transition: "all 200ms",
                  gridColumn: isExpanded ? "1 / -1" : undefined,
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
                      teamLeads.map((lead: TeamMember) => (
                        <div
                          key={`${lead.userId}-${lead.teamId}`}
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
                          {lead.user?.name || lead.user?.email?.split("@")[0] || "Lead"}
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
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setAssignLeadTeam(team);
                    }}
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
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteTeam(team);
                    }}
                    disabled={isDeletingTeam}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      fontSize: "12px",
                      borderRadius: "6px",
                      border: "1px solid #f87171",
                      backgroundColor: "#fee2e2",
                      color: "#b91c1c",
                      cursor: isDeletingTeam ? "not-allowed" : "pointer",
                      fontWeight: "500",
                    }}
                  >
                    Archive
                  </button>
                </div>

                {isExpanded && (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    style={{ marginTop: "18px", padding: "16px", borderTop: "1px solid #e4e4e7", backgroundColor: "#ffffff", borderRadius: "0 0 8px 8px" }}
                  >
                    <div style={{ marginBottom: "16px" }}>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#18181b" }}>Team Members</h4>
                      <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#71717a" }}>
                        Review current members and add an existing organization user.
                      </p>
                    </div>

                    {team.members.length > 0 ? (
                      <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
                        {team.members.map((member) => (
                          <div
                            key={`${member.userId}-${member.teamId}`}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "12px",
                              border: "1px solid #e4e4e7",
                              borderRadius: "8px",
                              backgroundColor: "#f8fafc",
                            }}
                          >
                            <div>
                              <p style={{ margin: 0, fontWeight: "600", fontSize: "14px", color: "#111827" }}>
                                {member.user?.name || member.user?.email?.split("@")[0]}
                              </p>
                              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>{member.user?.email}</p>
                            </div>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <RoleBadge role={member.role === "LEAD" ? "TEAM_LEAD" : "MEMBER"} size="sm" />
                              <button
                                type="button"
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  const confirmed = window.confirm(`Remove ${member.user?.name || member.user?.email} from ${team.name}?`);
                                  if (!confirmed) return;

                                  try {
                                    setMemberActionError(null);
                                    setMemberActionMessage(null);
                                    await removeMember({ teamSlug: team.slug, userId: member.userId });
                                    setMemberActionMessage("Member removed successfully.");
                                    setSuccessBannerMessage(`Removed from ${team.name}`);
                                    refetch();
                                  } catch (error) {
                                    const message = error instanceof Error ? error.message : "Unable to remove member. Please try again.";
                                    setMemberActionError(message);
                                    console.error("Failed to remove member", error);
                                  }
                                }}
                                disabled={isRemovingMember}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: "6px",
                                  border: "1px solid #ef4444",
                                  backgroundColor: "#fef2f2",
                                  color: "#b91c1c",
                                  cursor: isRemovingMember ? "not-allowed" : "pointer",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginBottom: "20px", padding: "12px", border: "1px dashed #e5e7eb", borderRadius: "8px", color: "#6b7280" }}>
                        No team members yet.
                      </div>
                    )}

                    <div style={{ padding: "16px", border: "1px solid #e4e4e7", borderRadius: "12px", backgroundColor: "#f8fafc" }}>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#111827" }}>Add Member</h4>
                      <p style={{ margin: "6px 0 14px 0", fontSize: "12px", color: "#71717a" }}>
                        Choose a user from your organization and add them to this team.
                      </p>

                      {isOrgUsersLoading ? (
                        <div style={{ minHeight: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <LoadingSpinner size="medium" text="Loading organization users..." />
                        </div>
                      ) : availableUsers.length === 0 ? (
                        <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
                          All organization users are already members of this team.
                        </p>
                      ) : (
                        <form
                          onSubmit={async (event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            if (!newMemberId) {
                              setMemberActionError("Choose a user to add to this team.");
                              setMemberActionMessage(null);
                              return;
                            }

                            try {
                              setMemberActionError(null);
                              setMemberActionMessage(null);
                              await addMember({ teamSlug: team.slug, userId: newMemberId, role: newMemberRole });
                              setMemberActionMessage("Member added successfully.");
                              setSuccessBannerMessage(`Added to ${team.name}`);
                              setNewMemberId("");
                              setNewMemberRole("MEMBER");
                              refetch();
                            } catch (error) {
                              const message = error instanceof Error ? error.message : "Unable to add member. Please try again.";
                              setMemberActionError(message);
                              console.error("Failed to add member", error);
                            }
                          }}
                        >
                          <div style={{ display: "grid", gap: "12px" }}>
                            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#374151" }}>
                              User
                              <select
                                value={newMemberId}
                                onChange={(event) => setNewMemberId(event.target.value)}
                                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", backgroundColor: "white" }}
                              >
                                <option value="">Select a user</option>
                                {availableUsers.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.name || user.email} ({user.email})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#374151" }}>
                              Role
                              <select
                                value={newMemberRole}
                                onChange={(event) => setNewMemberRole(event.target.value as "LEAD" | "MEMBER")}
                                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", backgroundColor: "white" }}
                              >
                                <option value="MEMBER">Member</option>
                                <option value="LEAD">Lead</option>
                              </select>
                            </label>
                            <button
                              type="submit"
                              disabled={isAddingMember}
                              style={{
                                width: "100%",
                                padding: "12px 16px",
                                backgroundColor: isAddingMember ? "#9ca3af" : "#111827",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                cursor: isAddingMember ? "not-allowed" : "pointer",
                                fontWeight: "600",
                              }}
                            >
                              {isAddingMember ? "Adding…" : "Add Member"}
                            </button>
                          </div>
                        </form>
                      )}

                      {(memberActionError || addMemberError || removeMemberError) && (
                        <div style={{ marginTop: "12px", padding: "10px 12px", backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "8px", fontSize: "13px" }}>
                          {memberActionError || addMemberError?.message || removeMemberError?.message}
                        </div>
                      )}
                      {memberActionMessage && (
                        <div style={{ marginTop: "12px", padding: "10px 12px", backgroundColor: "#d1fae5", color: "#065f46", borderRadius: "8px", fontSize: "13px" }}>
                          {memberActionMessage}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Assign Lead Modal */}
        {assignLeadTeam && (
          <AssignLeadModal
            team={assignLeadTeam}
            onClose={() => setAssignLeadTeam(null)}
            onAssign={async (userId, teamSlug) => {
              try {
                await assignTeamLead({ userId, teamSlug });
                setAssignLeadTeam(null);
                refetch();
              } catch {
                console.error("Failed to assign team lead", assignError);
              }
            }}
            isLoading={isAssigning}
          />
        )}

        {/* Create Team Modal */}
        {showCreateModal && (
          <CreateTeamModal
            orgSlug={orgSlug!}
            onClose={() => setShowCreateModal(false)}
            onCreate={async (name, slug) => {
              try {
                await createTeam({ orgSlug: orgSlug!, name, slug });
                setShowCreateModal(false);
                setSuccessBannerMessage(`Team "${name}" has been successfully created.`);
                refetch();
              } catch {
                console.error("Failed to create team", createError);
              }
            }}
            isLoading={isCreating}
          />
        )}
      </div>
    </main>
  );
}
