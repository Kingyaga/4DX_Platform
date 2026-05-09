"use client";

export default function DashboardPage() {
  return (
    <main style={{ flex: 1, padding: "32px", maxWidth: "1200px", width: "100%" }}>
      
      {/* Page Header */}
      <div style={{
        marginBottom: "32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        borderBottom: "1px solid #e4e4e7",
        paddingBottom: "16px",
      }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em", textTransform: "uppercase" }}>Org Dashboard</h1>
          <p style={{ fontSize: "14px", color: "#71717a", marginTop: "4px", textTransform: "uppercase" }}>Executive Overview</p>
        </div>
        <button style={{
          backgroundColor: "#000000",
          color: "#ffffff",
          fontSize: "12px",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          padding: "8px 16px",
          border: "none",
          cursor: "pointer",
        }}>
          Generate Report
        </button>
      </div>

      {/* Metrics Strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        marginBottom: "32px",
        border: "1px solid #e4e4e7",
        backgroundColor: "#ffffff",
      }}>
        <div style={{ padding: "20px", borderRight: "1px solid #e4e4e7" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "8px" }}>Total Teams</span>
          <span style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.03em", color: "#18181b" }}>24</span>
        </div>
        <div style={{ padding: "20px", borderRight: "1px solid #e4e4e7", backgroundColor: "#f4f4f5" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "8px" }}>Active WIGs</span>
          <span style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.03em", color: "#18181b" }}>72</span>
        </div>
        <div style={{ padding: "20px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#71717a", display: "block", marginBottom: "8px" }}>Overall Completion</span>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.03em", color: "#18181b" }}>88%</span>
            <div style={{ flex: 1, height: "4px", backgroundColor: "#e4e4e7", marginBottom: "4px" }}>
              <div style={{ height: "100%", backgroundColor: "#18181b", width: "88%" }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Table */}
      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7" }}>
        <div style={{
          padding: "16px",
          borderBottom: "1px solid #e4e4e7",
          backgroundColor: "#f4f4f5",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <h2 style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#18181b" }}>Team Performance Directory</h2>
          <button style={{ padding: "4px", border: "1px solid #e4e4e7", backgroundColor: "transparent", cursor: "pointer" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#52525b", display: "block" }}>filter_list</span>
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e4e7", backgroundColor: "#ffffff" }}>
                {["Team Name", "WIG Health", "Session Completion (4W)", "Last Active", "Action"].map((h, i) => (
                  <th key={h} style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "#71717a",
                    padding: "12px 16px",
                    textAlign: i === 4 ? "right" : "left",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{ fontSize: "14px", color: "#18181b" }}>
              {[
                { name: "Engineering Core", health: ["#16A34A", "#16A34A", "#EAB308"], completion: 100, active: "2 hrs ago" },
                { name: "Sales Alpha", health: ["#16A34A", "#EF4444"], completion: 75, active: "1 day ago" },
                { name: "Marketing Ops", health: ["#EAB308", "#EAB308", "#EAB308"], completion: 100, active: "5 hrs ago" },
                { name: "Customer Success", health: ["#16A34A", "#16A34A", "#16A34A", "#16A34A"], completion: 50, active: "3 days ago" },
              ].map((row) => (
                <tr key={row.name} style={{ borderBottom: "1px solid #f4f4f5", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f4f4f5"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                >
                  <td style={{ padding: "16px", fontWeight: 500, textTransform: "uppercase" }}>{row.name}</td>
                  <td style={{ padding: "16px" }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {row.health.map((color, i) => (
                        <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: color }}></div>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "128px" }}>
                      <span style={{ fontSize: "12px", width: "32px", textAlign: "right" }}>{row.completion}%</span>
                      <div style={{ flex: 1, height: "4px", backgroundColor: "#e4e4e7" }}>
                        <div style={{ height: "100%", backgroundColor: "#18181b", width: `${row.completion}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "16px", color: "#71717a", fontSize: "12px", textTransform: "uppercase" }}>{row.active}</td>
                  <td style={{ padding: "16px", textAlign: "right" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "#a1a1aa" }}>chevron_right</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}