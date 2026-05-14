"use client";

import { useMemo, useState } from "react";
import { useOrgUsers, useDeleteUser } from "@/lib/hooks";
import { useTimedMessage } from "@/lib/useTimedMessage";
import { useUserStore } from "@/lib/stores/user-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import Link from "next/link";

export default function AdminUsersPage() {
  const { orgSlug } = useUserStore();
  const { users, isLoading, error, refetch } = useOrgUsers(orgSlug);
  const { deleteUser, isLoading: isDeletingUser, error: deleteUserError } = useDeleteUser();
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userActionSuccess, setUserActionSuccess] = useTimedMessage<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const userRole = user.orgMemberships?.[0]?.role || "MEMBER";
      const teamName = user.teamMemberships?.[0]?.team?.name || "Unassigned";
      const query = searchTerm.trim().toLowerCase();

      if (roleFilter !== "ALL" && userRole !== roleFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [user.name, user.email, userRole, teamName]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [users, roleFilter, searchTerm]);

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    const confirmed = window.confirm(`Delete user ${userEmail}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setUserActionError(null);
      setUserActionSuccess(null);
      await deleteUser({ userId });
      setUserActionSuccess(`Deleted ${userEmail}`);
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to delete user.";
      setUserActionError(message);
    }
  };

  if (error) return <ErrorState error={error} />;

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "600", margin: "0 0 8px 0" }}>Organization Users</h1>
            <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>
              View all users in the organization and delete users as needed. Deletions are permanent.
            </p>
          </div>
          <Link
            href="/dashboard/admin/users/new"
            style={{
              padding: "10px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "500",
              fontSize: "14px",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            + Create User
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", width: "100%", maxWidth: "760px" }}>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search users, email, role, or team"
              style={{
                flex: 1,
                minWidth: "220px",
                padding: "12px 14px",
                border: "1px solid #e4e4e7",
                borderRadius: "10px",
                outline: "none",
                fontSize: "14px",
                color: "#111827",
              }}
            />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              style={{
                padding: "12px 14px",
                border: "1px solid #e4e4e7",
                borderRadius: "10px",
                backgroundColor: "#ffffff",
                color: "#111827",
                fontSize: "14px",
                minWidth: "180px",
              }}
            >
              <option value="ALL">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="TEAM_LEAD">Team Lead</option>
              <option value="MEMBER">Member</option>
            </select>
          </div>
        </div>

        {/* Messages */}
        {(userActionError || userActionSuccess || deleteUserError) && (
          <div style={{ marginBottom: "20px" }}>
            {userActionError || deleteUserError ? (
              <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "16px", padding: "12px 16px" }}>
                {String(userActionError || deleteUserError)}
              </div>
            ) : (
              <div style={{ backgroundColor: "#d1fae5", color: "#065f46", borderRadius: "16px", padding: "12px 16px" }}>
                {userActionSuccess}
              </div>
            )}
          </div>
        )}

        {/* Users Table */}
        {isLoading ? (
          <div style={{ textAlign: "center", color: "#71717a", padding: "32px" }}>Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState title="No users found" description="Try updating your search or filter criteria to see matching users." />
        ) : (
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "12px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f4f4f5", borderBottom: "1px solid #e4e4e7" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#71717a", textTransform: "uppercase" }}>Name</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#71717a", textTransform: "uppercase" }}>Email</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#71717a", textTransform: "uppercase" }}>Role</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#71717a", textTransform: "uppercase" }}>Team</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: "#71717a", textTransform: "uppercase" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const userRole = user.orgMemberships?.[0]?.role || "MEMBER";
                  const teamName = user.teamMemberships?.[0]?.team?.name || "Unassigned";
                  return (
                    <tr key={user.id} style={{ borderBottom: "1px solid #e4e4e7" }}>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#111827" }}>{user.name || "Unknown"}</td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#111827" }}>{user.email}</td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#111827" }}>{userRole}</td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#111827" }}>{teamName}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          disabled={isDeletingUser}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid #f87171",
                            backgroundColor: "#fee2e2",
                            color: "#b91c1c",
                            cursor: isDeletingUser ? "not-allowed" : "pointer",
                            fontWeight: "600",
                            fontSize: "12px",
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
