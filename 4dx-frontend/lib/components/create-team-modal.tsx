import { useState } from "react";

interface CreateTeamModalProps {
  orgSlug: string;
  onClose: () => void;
  onCreate: (name: string, slug: string) => void;
  isLoading: boolean;
}

export function CreateTeamModal({ orgSlug, onClose, onCreate, isLoading }: CreateTeamModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const handleCreate = () => {
    if (name.trim() && slug.trim()) {
      onCreate(name.trim(), slug.trim());
      setName("");
      setSlug("");
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate slug from name
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) {
      setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
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
        <h2 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "600" }}>Create New Team</h2>
        <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#71717a" }}>
          Create a new team in your organization. You can add members and assign a team lead later.
        </p>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: "500" }}>
              Team Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter team name"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #e4e4e7",
                borderRadius: "6px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: "500" }}>
              Team Slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, ''))}
              placeholder="team-slug"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #e4e4e7",
                borderRadius: "6px",
                fontSize: "14px",
                fontFamily: "monospace",
                boxSizing: "border-box",
              }}
            />
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#a1a1aa" }}>
              Used in URLs and must be unique. Only lowercase letters, numbers, and hyphens.
            </p>
          </div>
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
            onClick={handleCreate}
            disabled={!name.trim() || !slug.trim() || isLoading}
            style={{
              padding: "10px 16px",
              backgroundColor: name.trim() && slug.trim() && !isLoading ? "#3b82f6" : "#cbd5e1",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "500",
              fontSize: "14px",
              cursor: name.trim() && slug.trim() && !isLoading ? "pointer" : "not-allowed",
            }}
          >
            {isLoading ? "Creating..." : "Create Team"}
          </button>
        </div>
      </div>
    </div>
  );
}