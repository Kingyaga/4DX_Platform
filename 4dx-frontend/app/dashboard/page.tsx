"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/user-store";
import { getDefaultRouteForRole } from "@/lib/team-routing";

export default function DashboardPage() {
  const router = useRouter();
  const { userRole } = useUserStore();

  useEffect(() => {
    if (userRole) {
      router.replace(getDefaultRouteForRole(userRole));
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
