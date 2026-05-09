import type { UserRole } from "../types";

interface RoleBadgeProps {
  role: UserRole;
  size?: "sm" | "md" | "lg";
}

const roleConfig: Record<UserRole, { bgColor: string; textColor: string; label: string }> = {
  ADMIN: {
    bgColor: "#fef3c7",
    textColor: "#b45309",
    label: "Admin",
  },
  TEAM_LEAD: {
    bgColor: "#dbeafe",
    textColor: "#0c4a6e",
    label: "Team Lead",
  },
  MEMBER: {
    bgColor: "#e0e7ff",
    textColor: "#312e81",
    label: "Member",
  },
};

const sizeConfig: Record<string, { fontSize: string; padding: string }> = {
  sm: { fontSize: "11px", padding: "2px 6px" },
  md: { fontSize: "12px", padding: "4px 8px" },
  lg: { fontSize: "13px", padding: "6px 10px" },
};

export function RoleBadge({ role, size = "md" }: RoleBadgeProps) {
  const config = roleConfig[role];
  const sizeStyle = sizeConfig[size];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: config.bgColor,
        color: config.textColor,
        fontSize: sizeStyle.fontSize,
        fontWeight: 600,
        padding: sizeStyle.padding,
        borderRadius: "4px",
        letterSpacing: "0.5px",
      }}
    >
      {config.label}
    </span>
  );
}
