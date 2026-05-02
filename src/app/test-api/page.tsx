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
            })
          }
        >
          Create Lead Measure
        </button>
      </div>
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
    </div>
  );
}
