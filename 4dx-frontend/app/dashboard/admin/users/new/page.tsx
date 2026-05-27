"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useOrgUsers } from "@/lib/hooks";
import { useTimedMessage } from "@/lib/useTimedMessage";
import { useUserStore } from "@/lib/stores/user-store";
import { ErrorState } from "@/lib/components/states";
import { LoadingSpinner } from "@/lib/components/loading-spinner";
import { parseTRPCError } from "@/lib/api-client";
import { trpc } from "@/lib/trpc";
import type { Team } from "@/lib/types";

export default function CreateUserPage() {
  const { orgSlug } = useUserStore();
  const { users, refetch: refetchUsers } = useOrgUsers(orgSlug);

  // Fetch org teams for team assignment
  const { data: orgData, isLoading: isOrgLoading, error: orgError } = trpc.org.getDashboard.useQuery(
    { orgSlug: orgSlug || "" },
    { enabled: !!orgSlug }
  );

  const orgTeams = (orgData?.teams || []) as Team[];

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserTeam, setNewUserTeam] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useTimedMessage("");

  const createUserMutation = trpc.auth.adminCreateUser.useMutation({
    onSuccess: () => {
      setAdminSuccess("User created successfully.");
      setAdminError("");
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserTeam("");
      refetchUsers();
    },
    onError: (err: { message?: string }) => {
      setAdminError(err.message || "Unable to create user.");
      setAdminSuccess("");
    },
  });

  const isCreatingUser = createUserMutation.status === "pending";

  const handleCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    if (!newUserName || !newUserEmail || !newUserPassword) {
      setAdminError("Name, email, and password are required.");
      return;
    }

    if (newUserPassword.length < 8) {
      setAdminError("Password must be at least 8 characters.");
      return;
    }

    if (!orgSlug) {
      setAdminError("Unable to determine organization.");
      return;
    }

    createUserMutation.mutate({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      orgSlug,
      teamSlug: newUserTeam || undefined,
    });
  };

  if (orgError) return <ErrorState error={parseTRPCError(orgError)} />;

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <Link
            href="/dashboard/admin/users"
            style={{ color: "#3b82f6", fontSize: "14px", textDecoration: "none", marginBottom: "16px", display: "inline-block" }}
          >
            ← Back to Users
          </Link>
          <h1 style={{ fontSize: "24px", fontWeight: "600", margin: "0 0 8px 0" }}>Create New User</h1>
          <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>
            Register a user directly in the system. New users are added immediately and assigned to the organization as MEMBERS.
          </p>
        </div>

        {/* Form */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "12px", padding: "24px", backgroundColor: "#ffffff" }}>
          {(adminError || adminSuccess) && (
            <div style={{ marginBottom: "24px" }}>
              {adminError ? (
                <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "12px", padding: "12px 16px" }}>
                  {adminError}
                </div>
              ) : (
                <div style={{ backgroundColor: "#d1fae5", color: "#065f46", borderRadius: "12px", padding: "12px 16px" }}>
                  {adminSuccess}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleCreateUser} style={{ display: "grid", gap: "20px" }}>
            <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: "8px", fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                Full Name
                <input
                  type="text"
                  value={newUserName}
                  onChange={(event) => setNewUserName(event.target.value)}
                  placeholder="Enter full name"
                  required
                  style={{ width: "100%", borderRadius: "8px", border: "1px solid #d4d4d8", padding: "10px 12px", fontSize: "14px" }}
                />
              </label>
              <label style={{ display: "grid", gap: "8px", fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                Email Address
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(event) => setNewUserEmail(event.target.value)}
                  placeholder="Enter email"
                  required
                  style={{ width: "100%", borderRadius: "8px", border: "1px solid #d4d4d8", padding: "10px 12px", fontSize: "14px" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: "8px", fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                Password
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(event) => setNewUserPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  style={{ width: "100%", borderRadius: "8px", border: "1px solid #d4d4d8", padding: "10px 12px", fontSize: "14px" }}
                />
              </label>
              <label style={{ display: "grid", gap: "8px", fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                Assign Team (Optional)
                <select
                  value={newUserTeam}
                  onChange={(event) => setNewUserTeam(event.target.value)}
                  style={{ width: "100%", borderRadius: "8px", border: "1px solid #d4d4d8", padding: "10px 12px", fontSize: "14px", backgroundColor: "#ffffff" }}
                >
                  <option value="">No team</option>
                  {isOrgLoading ? (
                    <option disabled>Teams are loading</option>
                  ) : (
                    orgTeams.map((team) => (
                      <option key={team.id} value={team.slug}>
                        {team.name}
                      </option>
                    ))
                  )}
                </select>
                {isOrgLoading && (
                  <div style={{ marginTop: "10px", display: "flex", justifyContent: "center" }}>
                    <LoadingSpinner size="small" text="" />
                  </div>
                )}
              </label>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                type="submit"
                disabled={isCreatingUser}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: isCreatingUser ? "#9ca3af" : "#111827",
                  color: "#ffffff",
                  fontWeight: "600",
                  cursor: isCreatingUser ? "not-allowed" : "pointer",
                }}
              >
                {isCreatingUser ? "Creating..." : "Create User"}
              </button>
              <Link
                href="/dashboard/admin/users"
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid #d4d4d8",
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  fontWeight: "600",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
