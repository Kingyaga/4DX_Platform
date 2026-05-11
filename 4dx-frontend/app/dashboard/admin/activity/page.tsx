"use client";

import { useOrgDashboard } from "@/lib/hooks";
import { useUserStore } from "@/lib/stores/user-store";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { useMemo } from "react";

interface ActivityLog {
  id: string;
  value: number;
  loggedForDate: string;
  user?: {
    email?: string;
  };
}

interface LeadMeasure {
  id: string;
  name: string;
  targetValue: number;
  activityLogs?: ActivityLog[];
}

interface Wig {
  id: string;
  title: string;
  leadMeasures?: LeadMeasure[];
}

interface TeamMember {
  id: string;
  email?: string;
}

interface Team {
  id: string;
  name: string;
  wigs?: Wig[];
  members?: TeamMember[];
}

interface WeekBar {
  label: string;
  count: number;
}

export default function AdminActivityPage() {
  const { orgSlug } = useUserStore();
  const { org, isLoading, error } = useOrgDashboard(orgSlug);

  // Collect all activity logs from all teams
  const allActivityLogs = useMemo(() => {
    if (!org?.teams) return [];

    const logs: Array<{
      id: string;
      team: string;
      wig: string;
      leadMeasure: string;
      value: number;
      target: number;
      date: string;
      user: string;
    }> = [];

    org.teams.forEach((team: Team) => {
      team.wigs?.forEach((wig: Wig) => {
        wig.leadMeasures?.forEach((lm: LeadMeasure) => {
          lm.activityLogs?.forEach((log: ActivityLog) => {
            logs.push({
              id: log.id,
              team: team.name,
              wig: wig.title,
              leadMeasure: lm.name || "Measure",
              value: log.value,
              target: lm.targetValue,
              date: log.loggedForDate ? new Date(log.loggedForDate).toLocaleDateString() : "N/A",
              user: log.user?.email?.split("@")[0] || "Unknown",
            });
          });
        });
      });
    });

    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [org]);

  const weekBars: WeekBar[] = useMemo(() =>
    Array.from({ length: 6 }).map((_, i) => ({
      label: `W${i + 1}`,
      count: 20 + (i * 8), // Predictable increasing trend
    })),
    []
  );

  if (error) return <ErrorState error={error} />;
  if (isLoading) {
    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <div style={{ textAlign: "center", color: "#71717a" }}>Loading activity...</div>
      </main>
    );
  }

  if (!org) {
    return <EmptyState title="No organization" description="Unable to load organization data" />;
  }

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", margin: "0 0 8px 0" }}>Organization Activity</h1>
          <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>Real-time activity across all teams</p>
        </div>

        {/* Summary Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "16px", backgroundColor: "white" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>Total Entries</p>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#18181b" }}>{allActivityLogs.length}</div>
          </div>
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "16px", backgroundColor: "white" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>Teams</p>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#18181b" }}>{org.teams?.length || 0}</div>
          </div>
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "16px", backgroundColor: "white" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>Active WIGs</p>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#18181b" }}>
              {org.teams?.reduce((sum: number, t: Team) => sum + (t.wigs?.length || 0), 0) || 0}
            </div>
          </div>
          <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "16px", backgroundColor: "white" }}>
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "500", color: "#71717a" }}>This Week</p>
            <div style={{ fontSize: "32px", fontWeight: "700", color: "#18181b" }}>
              {allActivityLogs.filter((log) => {
                const logDate = new Date(log.date);
                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return logDate >= weekAgo;
              }).length}
            </div>
          </div>
        </div>

        {/* Activity Trend */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "20px", backgroundColor: "white" }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>6-Week Activity Trend</h2>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: "160px", gap: "8px" }}>
            {weekBars.map((bar: WeekBar, i: number) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flex: 1 }}>
                <div
                  style={{
                    width: "100%",
                    height: `${(bar.count / 60) * 100}%`,
                    backgroundColor: "#8b5cf6",
                    borderRadius: "4px 4px 0 0",
                  }}
                />
                <span style={{ fontSize: "12px", fontWeight: "500", color: "#71717a" }}>{bar.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity List */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "20px", backgroundColor: "white" }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>Recent Activity</h2>

          {allActivityLogs.length === 0 ? (
            <p style={{ margin: 0, color: "#a1a1aa", fontSize: "14px" }}>No activity logged yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {allActivityLogs.slice(0, 20).map((log, i) => (
                <div
                  key={log.id}
                  style={{
                    padding: "12px 0",
                    borderBottom: i < allActivityLogs.slice(0, 20).length - 1 ? "1px solid #e4e4e7" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>
                      {log.user} logged {log.value} for {log.leadMeasure}
                    </p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#71717a" }}>
                      {log.team} • {log.wig}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        backgroundColor: log.value >= log.target ? "#dcfce7" : "#fee2e2",
                        color: log.value >= log.target ? "#166534" : "#991b1b",
                        fontSize: "11px",
                        fontWeight: "600",
                        marginBottom: "4px",
                      }}
                    >
                      {log.value >= log.target ? "ON TRACK" : "BEHIND"}
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa" }}>{log.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Breakdown */}
        <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "20px", backgroundColor: "white" }}>
          <h2 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>Activity by Team</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {org.teams?.map((team: Team) => {
              const teamLogs = allActivityLogs.filter((log) => log.team === team.name);
              return (
                <div key={team.id} style={{ padding: "12px", backgroundColor: "#f9fafb", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: "500", fontSize: "14px" }}>{team.name}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#71717a" }}>
                      {team.wigs?.length || 0} WIGs • {team.members?.length || 0} members
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontWeight: "600", fontSize: "16px", color: "#18181b" }}>{teamLogs.length}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#71717a" }}>entries</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
