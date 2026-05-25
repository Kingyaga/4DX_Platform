"use client";
import { useState } from "react";

export default function TestApi() {
  const [result, setResult] = useState("");

  async function post(endpoint: string, body: object) {
    const res = await fetch(`/api/trpc/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: body }),
    });
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  }

  async function get(endpoint: string, input: object) {
    const res = await fetch(
      `/api/trpc/${endpoint}?input=${encodeURIComponent(
        JSON.stringify({ json: input }),
      )}`,
    );
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  }

  return (
    <div style={{ padding: 40, fontFamily: "monospace" }}>
      <h2>API Tester</h2>
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}
      >
        <button
          onClick={() =>
            post("teams.create", {
              orgSlug: "test-org",
              name: "Test Team",
              slug: "test-team",
            })
          }
        >
          Create Team
        </button>
        <button onClick={() => get("teams.getBySlug", { slug: "test-team" })}>
          Get Team
        </button>
        <button
          onClick={() =>
            post("wigs.create", {
              teamSlug: "test-team",
              title: "Increase revenue from 50k to 100k",
              fromValue: 50000,
              toValue: 100000,
              unit: "USD",
              deadline: new Date("2026-12-31T00:00:00.000Z"),
            })
          }
        >
          Create WIG
        </button>
        <button
          onClick={() => get("wigs.getByTeam", { teamSlug: "test-team" })}
        >
          Get WIGs
        </button>
        <button
          onClick={() =>
            post("leadMeasures.create", {
              wigId: "cmoong8is0003ew2gdcvpxdgl",
              name: "Weekly sales calls",
              cadence: "WEEKLY",
              targetValue: 10,
              unit: "calls",
              ownerUserIds: ["replace-with-team-member-user-id"],
            })
          }
        >
          Create Lead Measure
        </button>
      </div>
      <button
        onClick={() =>
          post("activityLogs.log", {
            leadMeasureId: "cmoonih2n0005ew2gcy87znfk",
            value: 8,
            loggedForDate: "2026-05-02T00:00:00.000Z",
            note: "Had a great week",
          })
        }
      >
        Log Activity
      </button>
      <button
        onClick={() =>
          post("sessions.generateForTeam", {
            teamSlug: "test-team",
          })
        }
      >
        Generate Sessions
      </button>
      <pre
        style={{
          background: "#111",
          color: "#0f0",
          padding: 20,
          borderRadius: 8,
          whiteSpace: "pre-wrap",
          maxHeight: 500,
          overflow: "auto",
        }}
      >
        {result || "Click a button to test an endpoint"}
      </pre>
      <button
        onClick={() =>
          post("sessions.completeAccount", {
            sessionId: "cmooo0hfh0002ewnwalz9juj6",
            commitmentUpdates: [],
          })
        }
      >
        Step 1: Account
      </button>
      <button
        onClick={() =>
          post("sessions.completeReview", {
            sessionId: "cmooo0hfh0002ewnwalz9juj6",
          })
        }
      >
        Step 2: Review
      </button>
      <button
        onClick={() =>
          post("sessions.completeCommit", {
            sessionId: "cmooo0hfh0002ewnwalz9juj6",
            commitments: [
              { text: "Make 10 sales calls this week" },
              { text: "Follow up with 5 leads" },
            ],
          })
        }
      >
        Step 3: Commit
      </button>
      <button
        onClick={() =>
          get("sessions.getMySession", {
            sessionId: "cmooo0hfh0002ewnwalz9juj6",
          })
        }
      >
        Get Session
      </button>
      <button
        onClick={() =>
          post("teams.assignTeamLead", {
            teamSlug: "test-team",
            newLeadUserId: "cmohulr4l0001ewwc1d6tobpl",
          })
        }
      >
        Assign New Lead
      </button>
      <button
        onClick={() =>
          get("sessions.getTeamSessions", {
            teamSlug: "test-team",
          })
        }
      >
        Get Team Sessions (Lead Only)
      </button>
      <button
        onClick={() =>
          post("activityLogs.log", {
            leadMeasureId: "cmoonih2n0005ew2gcy87znfk",
            value: 5,
            loggedForDate: "2026-05-05T00:00:00.000Z",
            note: "Test log after refactor",
          })
        }
      >
        Log Activity (Member Check)
      </button>
      <button
        onClick={() =>
          get("activityLogs.getByLeadMeasure", {
            leadMeasureId: "cmoonih2n0005ew2gcy87znfk",
          })
        }
      >
        Get Activity Logs
      </button>
      <button onClick={() => get("activityLogs.getByUser", {})}>
        Get My Logs
      </button>
      <button onClick={() => get("notifications.getUnreadCount", {})}>
        Get Notification Count
      </button>
      <button onClick={() => get("notifications.getUnread", {})}>
        Get Notifications
      </button>
      <button
        onClick={() =>
          get("org.getAuditLogs", {
            orgSlug: "test-org",
            limit: 10,
          })
        }
      >
        Get Audit Logs
      </button>
    </div>
  );
}
