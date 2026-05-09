"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useUserStore } from "@/lib/stores/user-store";
import { useRoleCheck } from "@/lib/hooks";
import { RoleBadge } from "@/lib/components/role-badge";
import Link from "next/link";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { user, clearUser } = useUserStore();
  const { isAdmin, isTeamLead } = useRoleCheck();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // Clear user store first
    clearUser();
    // Then sign out with explicit frontend URL
    await signOut({ 
      callbackUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/login`, 
      redirect: true 
    });
  };

  if (!session?.user) {
    return (
      <main style={{ flex: 1, padding: "32px" }}>
        <div style={{ textAlign: "center", color: "#71717a" }}>Loading...</div>
      </main>
    );
  }

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

        {/* Permissions Section */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "24px", backgroundColor: "white" }}>
          <h2 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: "600" }}>Your Permissions</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "4px",
                  backgroundColor: "#dcfce7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#166534",
                  fontSize: "12px",
                }}
              >
                ✓
              </div>
              <span style={{ fontSize: "14px", color: "#18181b" }}>Create WIGs</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "4px",
                  backgroundColor: "#dcfce7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#166534",
                  fontSize: "12px",
                }}
              >
                ✓
              </div>
              <span style={{ fontSize: "14px", color: "#18181b" }}>Generate Reports</span>
            </div>

            {isAdmin && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "4px",
                    backgroundColor: "#fef08a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#854d0e",
                    fontSize: "12px",
                  }}
                >
                  ⚙
                </div>
                <span style={{ fontSize: "14px", color: "#18181b", fontWeight: "500" }}>Manage Organization</span>
              </div>
            )}

            {isTeamLead && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "4px",
                    backgroundColor: "#dbeafe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0c4a6e",
                    fontSize: "12px",
                  }}
                >
                  👥
                </div>
                <span style={{ fontSize: "14px", color: "#18181b", fontWeight: "500" }}>Manage Team</span>
              </div>
            )}
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
