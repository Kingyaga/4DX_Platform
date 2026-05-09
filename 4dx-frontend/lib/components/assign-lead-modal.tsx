import { useState } from "react";
import type { Team } from "@/lib/types";

interface AssignLeadModalProps {
  team: any;
  onClose: () => void;
  onAssign: (userId: string, teamSlug: string) => void;
  isLoading: boolean;
}

export function AssignLeadModal({ team, onClose, onAssign, isLoading }: AssignLeadModalProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const handleAssign = () => {
    if (selectedMemberId) {
      onAssign(selectedMemberId, team.slug);
      setSelectedMemberId(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "400px",
          width: "90%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "600" }}>Assign Team Lead</h2>
        <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#71717a" }}>
          Select a member to become the team lead for <strong>{team.name}</strong>
        </p>

        {/* Member List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px", maxHeight: "300px", overflowY: "auto" }}>
          {team.members && team.members.length > 0 ? (
            team.members.map((member: any) => (
              <label
                key={member.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  border: selectedMemberId === member.id ? "2px solid #3b82f6" : "1px solid #e4e4e7",
                  borderRadius: "6px",
                  cursor: "pointer",
                  backgroundColor: selectedMemberId === member.id ? "#eff6ff" : "white",
                }}
              >
                <input
                  type="radio"
                  name="lead"
                  value={member.id}
                  checked={selectedMemberId === member.id}
                  onChange={() => setSelectedMemberId(member.id)}
                  style={{ cursor: "pointer" }}
                />
                <div>
                  <p style={{ margin: 0, fontWeight: "500", fontSize: "14px" }}>
                    {member.user?.name || member.user?.email?.split("@")[0] || "Unknown"}
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#a1a1aa" }}>
                    {member.user?.email || "No email"}
                  </p>
                </div>
              </label>
            ))
          ) : (
            <p style={{ margin: 0, color: "#a1a1aa", fontSize: "14px" }}>No members in this team</p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 16px",
              backgroundColor: "white",
              color: "#18181b",
              border: "1px solid #e4e4e7",
              borderRadius: "6px",
              fontWeight: "500",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedMemberId || isLoading}
            style={{
              padding: "10px 16px",
              backgroundColor: selectedMemberId && !isLoading ? "#3b82f6" : "#cbd5e1",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "500",
              fontSize: "14px",
              cursor: selectedMemberId && !isLoading ? "pointer" : "not-allowed",
            }}
          >
            {isLoading ? "Assigning..." : "Assign as Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
