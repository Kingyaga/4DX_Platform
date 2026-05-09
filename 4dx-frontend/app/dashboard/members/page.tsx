"use client";

import { useState } from "react";

const members = [
  { name: "Arthur Pendelton", role: "Lead", status: "Active", initials: "AP", color: "#16A34A" },
  { name: "Sarah Jenkins", role: "Admin", status: "Active", initials: "SJ", color: "#16A34A" },
  { name: "Marcus Vance", role: "Member", status: "Away", initials: "MV", color: "#e4e4e7" },
  { name: "David Chen", role: "Member", status: "Active", initials: "DC", color: "#16A34A" },
];

export default function MembersPage() {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em", textTransform: "uppercase" }}>Team Members</h1>
          <p style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>Manage operational team access and roles.</p>
        </div>
        <button style={{ backgroundColor: "#000000", color: "#ffffff", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 16px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
          Add Member
        </button>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f4f4f5", borderBottom: "1px solid #e4e4e7" }}>
                <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "left", width: "40%" }}>Name</th>
                <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "left", width: "20%" }}>Role</th>
                <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "left", width: "20%" }}>Status</th>
                <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", textAlign: "right", width: "20%" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid #f4f4f5", backgroundColor: hoveredRow === i ? "#f7f9fd" : "transparent", transition: "background 0.075s" }}
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#e4e4e7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600, color: "#18181b", flexShrink: 0, border: "1px solid #e4e4e7" }}>
                      {member.initials}
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "#18181b" }}>{member.name}</span>
                  </td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "#18181b" }}>{member.role}</td>
                  <td style={{ padding: "16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 500, color: member.status === "Active" ? "#18181b" : "#71717a" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: member.color, display: "inline-block" }}></span>
                      {member.status}
                    </span>
                  </td>
                  <td style={{ padding: "16px", textAlign: "right" }}>
                    {hoveredRow === i && (
                      <>
                        <button style={{ fontSize: "12px", fontWeight: 500, color: "#71717a", background: "none", border: "none", cursor: "pointer", marginRight: "12px" }}>
                          Edit Role
                        </button>
                        <button style={{ fontSize: "12px", fontWeight: 500, color: "#ba1a1a", background: "none", border: "none", cursor: "pointer" }}>
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ borderTop: "1px solid #e4e4e7", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#ffffff" }}>
          <span style={{ fontSize: "14px", color: "#71717a" }}>Showing 1 to 4 of 4 members</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button disabled style={{ padding: "4px 12px", border: "1px solid #e4e4e7", fontSize: "12px", fontWeight: 500, color: "#71717a", backgroundColor: "transparent", cursor: "not-allowed", opacity: 0.5 }}>Prev</button>
            <button disabled style={{ padding: "4px 12px", border: "1px solid #e4e4e7", fontSize: "12px", fontWeight: 500, color: "#71717a", backgroundColor: "transparent", cursor: "not-allowed", opacity: 0.5 }}>Next</button>
          </div>
        </div>
      </div>
    </main>
  );
}