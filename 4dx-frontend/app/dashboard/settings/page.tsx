"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useUserStore } from "@/lib/stores/user-store";
import { useChangePassword, useRoleCheck } from "@/lib/hooks";
import { RoleBadge } from "@/lib/components/role-badge";
import { LoadingSpinner } from "@/lib/components/loading-spinner";
import Link from "next/link";

function PermissionRow({ granted, label, highlight }: { granted: boolean; label: string; highlight?: "blue" | "yellow" }) {
  const bg = !granted ? "#f4f4f5" : highlight === "yellow" ? "#fef08a" : highlight === "blue" ? "#dbeafe" : "#dcfce7";
  const color = !granted ? "#a1a1aa" : highlight === "yellow" ? "#854d0e" : highlight === "blue" ? "#0c4a6e" : "#166534";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
      <div style={{ width: "20px", height: "20px", borderRadius: "4px", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>
        {granted ? "✓" : "–"}
      </div>
      <span style={{ fontSize: "14px", color: granted ? "#18181b" : "#a1a1aa" }}>{label}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { user, clearUser } = useUserStore();
  const { isAdmin, isTeamLead } = useRoleCheck();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const { changePassword, isLoading: isChangingPassword } = useChangePassword();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // Clear user store first
    clearUser();
    // Sign out without callback, then manually redirect
    await signOut({ redirect: false });
    // Manually redirect to frontend login
    window.location.href = "/login";
  };

  if (!session?.user) {
    return (
      <main style={{ flex: 1, padding: "32px" }}>
        <LoadingSpinner size="large" text="" className="min-h-screen flex items-center justify-center" />
      </main>
    );
  }

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated successfully.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Unable to update password.");
    }
  };

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", margin: "0 0 8px 0" }}>Settings</h1>
          <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>Manage your account and preferences</p>
        </div>

        {/* Profile Section */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "24px", backgroundColor: "white" }}>
          <h2 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: "600" }}>Your Profile</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
            {/* Profile Avatar */}
            <div
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                backgroundColor: "#e4e4e7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "40px",
                fontWeight: "700",
                color: "#71717a",
                gridColumn: "1 / -1",
              }}
            >
              {session.user.name?.charAt(0).toUpperCase() || "U"}
            </div>

            {/* Profile Info */}
            <div>
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>Full Name</p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#18181b" }}>{session.user.name || "Not set"}</p>
            </div>

            <div>
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>Email</p>
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#18181b" }}>{session.user.email}</p>
            </div>

            {/* Role */}
            <div>
              <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>Role</p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <RoleBadge role={user?.role || "MEMBER"} size="md" />
                <span style={{ fontSize: "14px", color: "#18181b", fontWeight: "500" }}>{user?.role || "MEMBER"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Password Section */}
        <form
          onSubmit={handleChangePassword}
          style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "24px", backgroundColor: "white", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}
        >
          <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "600" }}>Security</h2>
          <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#71717a" }}>
            Change your password here when you know your current password. Forgotten passwords should use the email reset flow.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#3f3f46" }}>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                style={{ padding: "12px", border: "1px solid #d4d4d8", borderRadius: "6px", fontSize: "14px" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#3f3f46" }}>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                style={{ padding: "12px", border: "1px solid #d4d4d8", borderRadius: "6px", fontSize: "14px" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#3f3f46" }}>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                style={{ padding: "12px", border: "1px solid #d4d4d8", borderRadius: "6px", fontSize: "14px" }}
              />
            </label>
          </div>

          {passwordError && <p style={{ margin: "14px 0 0 0", color: "#b91c1c", fontSize: "13px" }}>{passwordError}</p>}
          {passwordMessage && <p style={{ margin: "14px 0 0 0", color: "#047857", fontSize: "13px" }}>{passwordMessage}</p>}

          <button
            type="submit"
            disabled={isChangingPassword}
            style={{
              marginTop: "20px",
              padding: "11px 16px",
              border: "none",
              borderRadius: "6px",
              backgroundColor: isChangingPassword ? "#71717a" : "#18181b",
              color: "#ffffff",
              fontWeight: 700,
              cursor: isChangingPassword ? "not-allowed" : "pointer",
            }}
          >
            {isChangingPassword ? "Updating..." : "Change password"}
          </button>
        </form>

        {/* Permissions Section */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "24px", backgroundColor: "white", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
          <h2 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: "600" }}>Your Permissions</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* All users: log activity */}
            <PermissionRow granted label="Log Activity" />

            {/* Team lead + admin: create WIGs, generate reports, manage team */}
            <PermissionRow granted={isTeamLead || isAdmin} label="Create WIGs" />
            <PermissionRow granted={isTeamLead || isAdmin} label="Generate Reports" />
            <PermissionRow granted={isTeamLead || isAdmin} label="Approve Activity Logs" />

            {/* Team lead only */}
            {isTeamLead && <PermissionRow granted label="Manage Team Members" highlight="blue" />}

            {/* Admin only */}
            {isAdmin && <PermissionRow granted label="Manage Organization" highlight="yellow" />}
          </div>

          <p style={{ margin: "16px 0 0 0", fontSize: "12px", color: "#71717a" }}>
            Your role determines what actions you can perform across the platform. Contact an administrator to change your role.
          </p>
        </div>

        {/* Logout Section */}
        <div style={{ border: "2px solid #fee2e2", borderRadius: "8px", padding: "24px", backgroundColor: "#fef2f2" }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600", color: "#991b1b" }}>Logout</h2>
          <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#7f1d1d" }}>You will be logged out from all devices.</p>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              padding: "10px 16px",
              backgroundColor: isLoggingOut ? "#fca5a5" : "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: isLoggingOut ? "not-allowed" : "pointer",
              transition: "background-color 200ms",
              opacity: isLoggingOut ? 0.7 : 1,
            }}
            onMouseEnter={(e) => !isLoggingOut && (e.currentTarget.style.backgroundColor = "#b91c1c")}
            onMouseLeave={(e) => !isLoggingOut && (e.currentTarget.style.backgroundColor = "#dc2626")}
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>

        {/* Back Link */}
        <Link href="/dashboard" style={{ fontSize: "14px", color: "#3b82f6", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
