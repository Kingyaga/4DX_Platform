"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTimedMessage } from "@/lib/useTimedMessage";
import { useAddTeamMember, useRemoveTeamMember, useRoleCheck, useTeam } from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { ErrorState, EmptyState } from "@/lib/components/states";

export default function MembersPage() {
  const router = useRouter();
  const { currentTeamSlug } = useTeamStore();
  const { team, isLoading, error, refetch } = useTeam(currentTeamSlug);
  const { addMember, isLoading: isAdding, error: addError } = useAddTeamMember();
  const { removeMember, isLoading: isRemoving, error: removeError } = useRemoveTeamMember();
  const { canAddMembers } = useRoleCheck();

  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"LEAD" | "MEMBER">("MEMBER");
  const [successMessage, setSuccessMessage] = useTimedMessage<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentTeamSlug || !newMemberId.trim()) {
      setFormError("Enter an existing user ID to add them to the team.");
      return;
    }

    try {
      await addMember({
        teamSlug: currentTeamSlug,
        userId: newMemberId.trim(),
        role: newMemberRole,
      });

      setSuccessMessage("Member added successfully.");
      setFormError(null);
      setNewMemberId("");
      setShowAddForm(false);
      refetch();
    } catch (error) {
      setSuccessMessage(null);
      setFormError(error instanceof Error ? error.message : "Unable to add member. Confirm the user exists in your organization and try again.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentTeamSlug || !window.confirm("Remove this member from the team?")) {
      return;
    }

    try {
      setRemovingMemberId(memberId);
      await removeMember({
        teamSlug: currentTeamSlug,
        userId: memberId,
      });
      setSuccessMessage("Member removed successfully.");
      setFormError(null);
      refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to remove member. Please try again.");
      setSuccessMessage(null);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const members = team?.members || [];

  // Show loading state during SSR and initial hydration
  if (!isHydrated || isLoading) {
    return (
      <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: "center", color: "#71717a" }}>Loading team members...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
        <ErrorState error={error} title="Unable to load team members" />
      </main>
    );
  }

  if (!currentTeamSlug) {
    return (
      <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
        <EmptyState
          title="Select a team first"
          description="Choose a team from the sidebar before managing members."
        />
      </main>
    );
  }

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em", textTransform: "uppercase" }}>Team Members</h1>
          <p style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>
            Manage access for your current team. You can add an existing organization member by their user ID.
          </p>
          {canAddMembers && (
            <p style={{ fontSize: "13px", color: "#52525b", marginTop: "8px" }}>
              Click any member row to view that member's activity log history.
            </p>
          )}
          {!canAddMembers && (
            <p style={{ marginTop: "8px", color: "#d97706", fontSize: "13px" }}>
              Only the current team lead can add members to this team.
            </p>
          )}
        </div>
        {canAddMembers && (
          <button
            onClick={() => {
              setShowAddForm((current) => !current);
              setFormError(null);
              setSuccessMessage(null);
            }}
            style={{ backgroundColor: "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 16px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
            {showAddForm ? "Hide Add Member" : "Add Member"}
          </button>
        )}
      </div>

      {showAddForm && (
        <div style={{ marginBottom: "24px", backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0, marginBottom: "12px" }}>Add a team member</h2>
          <p style={{ margin: 0, fontSize: "14px", color: "#71717a", marginBottom: "16px" }}>
            Use an existing user ID to add a member to this team. We currently do not have an email lookup endpoint in the backend.
          </p>
          <form onSubmit={handleAddMember} style={{ display: "grid", gap: "16px" }}>
            <div style={{ display: "grid", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>User ID *</label>
              <input
                type="text"
                value={newMemberId}
                onChange={(event) => setNewMemberId(event.target.value)}
                placeholder="Enter existing user ID"
                style={{ width: "100%", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "10px", fontSize: "16px", color: "#18181b", outline: "none" }}
              />
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#18181b" }}>Role *</label>
              <select
                value={newMemberRole}
                onChange={(event) => setNewMemberRole(event.target.value as "LEAD" | "MEMBER")}
                style={{ width: "100%", border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "10px", fontSize: "16px", color: "#18181b", outline: "none" }}
              >
                <option value="MEMBER">Member</option>
                <option value="LEAD">Lead</option>
              </select>
            </div>

            {(formError || addError || successMessage) && (
              <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: formError || addError ? "#fee2e2" : "#ddf7e6", border: `1px solid ${formError || addError ? "#fecaca" : "#a7f3d0"}`, color: formError || addError ? "#991b1b" : "#0f5132" }}>
                {formError || addError?.message || successMessage}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{ padding: "10px 16px", backgroundColor: "#f4f4f5", color: "#18181b", border: "1px solid #e4e4e7", cursor: "pointer", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdding}
                style={{ padding: "10px 16px", backgroundColor: isAdding ? "#a1a1a1" : "#000000", color: "#ffffff", border: "none", cursor: isAdding ? "not-allowed" : "pointer", fontWeight: 600 }}
              >
                {isAdding ? "Adding…" : "Add Member"}
              </button>
            </div>
          </form>
        </div>
      )}

      {members.length === 0 ? (
        <EmptyState
          title="No team members"
          description="Add an existing user to your team to begin working together."
        />
      ) : (
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f4f4f5", borderBottom: "1px solid #e4e4e7" }}>
                  <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "left", width: "40%" }}>Name</th>
                  <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "left", width: "20%" }}>Role</th>
                  <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "left", width: "20%" }}>Email</th>
                  <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "right", width: "20%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member: any, i: number) => (
                  <tr
                    key={member.id}
                    style={{
                      borderBottom: "1px solid #f4f4f5",
                      backgroundColor: hoveredRow === i ? "#f7f9fd" : "transparent",
                      transition: "background 0.075s",
                      cursor: canAddMembers ? "pointer" : "default",
                    }}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => {
                      if (canAddMembers) {
                        router.push(`/dashboard/members/${member.userId}`);
                      }
                    }}
                  >
                    <td style={{ padding: "16px", display: "grid", gap: "6px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#18181b" }}>
                        {member.user?.name || member.user?.email || "Unknown user"}
                      </span>
                      <span style={{ fontSize: "12px", color: "#71717a" }}>
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td style={{ padding: "16px", fontSize: "14px", color: "#18181b" }}>{member.role}</td>
                    <td style={{ padding: "16px", fontSize: "14px", color: "#18181b" }}>{member.user?.email || "—"}</td>
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      {hoveredRow === i && canAddMembers && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveMember(member.userId);
                          }}
                          disabled={isRemoving || removingMemberId === member.userId}
                          style={{ fontSize: "12px", fontWeight: 500, color: isRemoving || removingMemberId === member.userId ? "#a1a1a1" : "#dc2626", background: "none", border: "none", cursor: isRemoving || removingMemberId === member.userId ? "not-allowed" : "pointer" }}
                        >
                          {removingMemberId === member.userId ? "Removing…" : "Remove"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
