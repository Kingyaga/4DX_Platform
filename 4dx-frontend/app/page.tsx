"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUserStore } from "@/lib/stores/user-store";
import { LoadingSpinner } from "@/lib/components/loading-spinner";

export default function RootPage() {
  const router = useRouter();
  const { status } = useSession();
  const { userRole } = useUserStore();

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    // User is authenticated
    if (userRole === "ADMIN") {
      router.replace("/dashboard/admin");
    } else if (userRole === "TEAM_LEAD") {
      router.replace("/dashboard/team-lead");
    } else {
      router.replace("/dashboard/scoreboard");
    }
  }, [status, userRole, router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <LoadingSpinner size="large" text="Loading..." />
    </div>
  );
}
