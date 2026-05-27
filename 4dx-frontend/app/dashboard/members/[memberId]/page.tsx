"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTeamStore } from "@/lib/stores/team-store";
import { useTeam, useActivityLogsByUser, useRoleCheck } from "@/lib/hooks";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { LoadingSpinner, PageLoader } from "@/lib/components/loading-spinner";

export default function MemberActivityLogsPage() {
  const params = useParams();
  const memberId = Array.isArray(params?.memberId) ? params.memberId[0] : params?.memberId;
  const { currentTeamSlug } = useTeamStore();
  const { team, isLoading: teamLoading, error: teamError } = useTeam(currentTeamSlug);
  const { activityLogs, isLoading: logsLoading, error: logsError } = useActivityLogsByUser(memberId || null);
  const { canAddMembers } = useRoleCheck();

  const member = useMemo(
    () => team?.members?.find((member: any) => member.userId === memberId) || null,
    [team?.members, memberId],
  );

  if (!currentTeamSlug) {
    return (
      <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
        <EmptyState
          title="Select a team first"
          description="Choose a team from the sidebar before viewing member activity history."
        />
      </main>
    );
  }

  if (teamLoading) {
    return <PageLoader text="Loading member activity..." />;
  }

  if (teamError) {
    return (
      <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
        <ErrorState error={teamError} title="Unable to load team data" />
      </main>
    );
  }

  if (!memberId || !member) {
    return (
      <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
        <EmptyState
          title="Member not found"
          description="Select a valid member from the team members page to see their activity logs."
        />
      </main>
    );
  }

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0", color: "#18181b" }}>Member Activity</h1>
          <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>
            Viewing activity history for {member.user?.name || "this team member"}.
          </p>
        </div>
        <Link
          href="/dashboard/members"
          style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#3b82f6", textDecoration: "none" }}
        >
          Back to members
        </Link>
      </div>

      {logsError && <ErrorState error={logsError} title="Unable to load activity logs" />}

      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: "16px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f4f4f5", borderBottom: "1px solid #e4e4e7" }}>
              <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "left" }}>Date</th>
              <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "left" }}>Lead Measure</th>
              <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "right" }}>Value</th>
              <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "left" }}>Status</th>
              <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "left" }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {logsLoading ? (
              <tr>
                <td colSpan={5} style={{ padding: 0 }}>
                  <div style={{ minHeight: "320px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <LoadingSpinner size="large" text="Loading activity history..." />
                  </div>
                </td>
              </tr>
            ) : activityLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "32px", textAlign: "center", color: "#71717a" }}>
                  No activity logs found for this member.
                </td>
              </tr>
            ) : (
              activityLogs.map((log: any, index: number) => (
                <tr key={log.id} style={{ borderBottom: index < activityLogs.length - 1 ? "1px solid #f4f4f5" : "none" }}>
                  <td style={{ padding: "16px", fontSize: "14px", color: "#18181b", whiteSpace: "nowrap" }}>
                    {new Date(log.loggedForDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "#18181b" }}>{log.leadMeasure?.name || "Unknown measure"}</td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "#18181b", textAlign: "right" }}>{log.value}</td>
                  <td style={{ padding: "16px", fontSize: "14px", color: log.status === "APPROVED" ? "#16a34a" : log.status === "PENDING" ? "#f59e0b" : "#dc2626" }}>
                    {log.status.toLowerCase().replace(/_/g, " ")}
                  </td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "#71717a", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.note || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!logsLoading && activityLogs.length === 0 && (
        <div style={{ marginTop: "16px", color: "#71717a", fontSize: "14px" }}>
          {canAddMembers ? "Members may submit activity logs for approval here." : "You can submit a log from the activity page."}
        </div>
      )}
    </main>
  );
}
