"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/user-store";

export default function DashboardPage() {
  const router = useRouter();
  const { userRole } = useUserStore();

  useEffect(() => {
    if (userRole) {
      if (userRole === "ADMIN") {
        router.replace("/dashboard/admin");
      } else if (userRole === "TEAM_LEAD") {
        router.replace("/dashboard/team-lead");
      } else if (userRole === "MEMBER") {
        router.replace("/dashboard/scoreboard");
      }
    }
  }, [userRole, router]);

  // Show loading while redirecting
  return (
    <main style={{ flex: 1, padding: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#71717a" }}>
        Redirecting to your dashboard...
      </div>
    </main>
  );
}
