"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTimedMessage } from "@/lib/useTimedMessage";
import { useAddTeamMember, useRemoveTeamMember, useRoleCheck, useTeam, useFindUserByEmail } from "@/lib/hooks";
import { useTeamStore } from "@/lib/stores/team-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { PageLoader } from "@/lib/components/loading-spinner";

export default function MembersPage() {
  const router = useRouter();
  const { currentTeamSlug } = useTeamStore();
  const { team, isLoading, error, refetch } = useTeam(currentTeamSlug);
  const { addMember, isLoading: isAdding, error: addError } = useAddTeamMember();
  const { removeMember, isLoading: isRemoving, error: removeError } = useRemoveTeamMember();
  const { findUserByEmail, user: foundUser, isLoading: isLookingUp, error: lookupError, reset: resetLookup } = useFindUserByEmail();
  const { canAddMembers } = useRoleCheck();

  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"LEAD" | "MEMBER">("MEMBER");
  const [successMessage, setSuccessMessage] = useTimedMessage<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setFormError(null);
    try {
      await findUserByEmail({ email: emailInput.trim() });
    } catch {
      // error surfaced via lookupError
    }
  };

  const handleAddMember = async () => {
    if (!currentTeamSlug || !foundUser) return;

    try {
      await addMember({
        teamSlug: currentTeamSlug,
        userId: foundUser.id,
        role: newMemberRole,
      });

      setSuccessMessage("Member added successfully.");
      setFormError(null);
      setEmailInput("");
      setShowAddForm(false);
      resetLookup();
      refetch();
    } catch (err) {
      setSuccessMessage(null);
      setFormError(err instanceof Error ? err.message : "Unable to add member. Confirm the user exists in your organization and try again.");
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
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to remove member. Please try again.");
      setSuccessMessage(null);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const members = team?.members || [];

  if (!isHydrated || isLoading) {
    return <PageLoader text="Loading team members..." />;
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
            Manage access for your current team. Look up an existing organization member by email to add them.
          </p>
          {canAddMembers && (
            <p style={{ fontSize: "13px", color: "#52525b", marginTop: "8px" }}>
              Click any member row to view that member&apos;s activity log history.
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
              resetLookup();
              setEmailInput("");
            }}
            style={{ backgroundColor: "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 16px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
            {showAddForm ? "Hide Add Member" : "Add Member"}
          </button>
        )}
      </div>

      {/* Success / error messages outside the form */}
      {successMessage && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", backgroundColor: "#ddf7e6", border: "1px solid #a7f3d0", color: "#0f5132", fontSize: "14px" }}>
          {successMessage}
        </div>
      )}
      {(removeError) && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "14px" }}>
          {removeError?.message}
        </div>
      )}

      {showAddForm && (
        <div style={{ marginBottom: "24px", backgroundColor: "#ffffff", border: "1px solid #e4e4e7", padding: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0, marginBottom: "4px" }}>Add a team member</h2>
          <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#71717a" }}>
            Search by email address to find a user in your organization, then confirm to add them.
          </p>

          {/* Step 1: Email lookup */}
          <form onSubmit={handleLookup} style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "flex-end" }}>
            <div style={{ flex: 1, display: "grid", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#18181b" }}>Email address *</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); resetLookup(); }}
                placeholder="user@yourorg.com"
                required
                style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "10px", fontSize: "14px", color: "#18181b", outline: "none" }}
              />
            </div>
            <button
              type="submit"
              disabled={isLookingUp || !emailInput.trim()}
              style={{ padding: "10px 16px", backgroundColor: isLookingUp ? "#a1a1a1" : "#000000", color: "#ffffff", border: "none", cursor: isLookingUp ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}
            >
              {isLookingUp ? "Searching..." : "Look up"}
            </button>
          </form>

          {lookupError && (
            <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "14px" }}>
              {lookupError.message}
            </div>
          )}

          {/* Step 2: Confirm found user */}
          {foundUser && (
            <div style={{ border: "1px solid #e4e4e7", padding: "16px", backgroundColor: "#f9fafb" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "#18181b" }}>
                {foundUser.name || foundUser.email}
              </p>
              <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#71717a" }}>{foundUser.email}</p>

              <div style={{ display: "grid", gap: "8px", marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#18181b" }}>Role *</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as "LEAD" | "MEMBER")}
                  style={{ border: "1px solid #e4e4e7", backgroundColor: "#ffffff", padding: "10px", fontSize: "14px", color: "#18181b", outline: "none" }}
                >
                  <option value="MEMBER">Member</option>
                  <option value="LEAD">Lead</option>
                </select>
              </div>

              {(formError || addError) && (
                <div style={{ marginBottom: "12px", padding: "12px", backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "14px" }}>
                  {formError || addError?.message}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => { resetLookup(); setEmailInput(""); }}
                  style={{ padding: "10px 16px", backgroundColor: "#f4f4f5", color: "#18181b", border: "1px solid #e4e4e7", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={isAdding}
                  style={{ padding: "10px 16px", backgroundColor: isAdding ? "#a1a1a1" : "#000000", color: "#ffffff", border: "none", cursor: isAdding ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  {isAdding ? "Adding…" : `Add ${foundUser.name || foundUser.email}`}
                </button>
              </div>
            </div>
          )}
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
