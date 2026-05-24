"use client";

import { useState } from "react";
import { useUserStore } from "@/lib/stores/user-store";
import { useMyTeams, useCreateInvite, useOrgInvites, useRevokeInvite } from "@/lib/hooks";
import { ErrorState } from "@/lib/components/states";
import { LoadingSpinner } from "@/lib/components/loading-spinner";

export default function InvitesPage() {
  const { orgSlug } = useUserStore();
  const { teams } = useMyTeams(orgSlug);
  const { invites, isLoading, error, refetch } = useOrgInvites(orgSlug);
  const { createInvite, isLoading: isCreating, error: createError } = useCreateInvite();
  const { revokeInvite, isLoading: isRevoking } = useRevokeInvite();

  const [email, setEmail] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgSlug) return;
    setFormError(null);
    setNewInviteUrl(null);

    try {
      const result = await createInvite({
        orgSlug,
        email: email.trim() || undefined,
        teamSlug: teamSlug || undefined,
        expiresInDays,
      });
      setNewInviteUrl(result.inviteUrl);
      setEmail("");
      setTeamSlug("");
      await refetch();
    } catch (err: any) {
      setFormError(err?.message ?? "Failed to create invite.");
    }
  };

  const handleCopy = async () => {
    if (!newInviteUrl) return;
    await navigator.clipboard.writeText(newInviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (token: string) => {
    setRevokingToken(token);
    try {
      await revokeInvite({ token });
      await refetch();
    } finally {
      setRevokingToken(null);
    }
  };

  const activeInvites = invites.filter((inv) => !inv.usedAt && new Date(inv.expiresAt) > new Date());
  const usedInvites = invites.filter((inv) => inv.usedAt || new Date(inv.expiresAt) <= new Date());

  if (isLoading) return <LoadingSpinner size="large" text="Loading invites..." className="min-h-[400px] flex items-center justify-center" />;
  if (error) return <ErrorState error={error} title="Unable to load invites" />;

  return (
    <main style={{ flex: 1, padding: "32px", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px", paddingBottom: "16px", borderBottom: "1px solid #e4e4e7" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#18181b", letterSpacing: "-0.02em", textTransform: "uppercase", margin: 0 }}>
          Invite Members
        </h1>
        <p style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>
          Generate invite links so people can sign up and join your organization.
        </p>
      </div>

      {/* Create Invite Form */}
      <div style={{ maxWidth: "540px", border: "1px solid #e4e4e7", padding: "24px", marginBottom: "40px", backgroundColor: "#ffffff" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#18181b", marginBottom: "20px" }}>
          Generate Invite Link
        </h2>
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
              Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Lock invite to a specific email address"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e4e4e7", fontSize: "14px", color: "#18181b", boxSizing: "border-box" }}
            />
            <p style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>
              Leave blank for an open invite anyone can use.
            </p>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
              Assign to Team (optional)
            </label>
            <select
              value={teamSlug}
              onChange={(e) => setTeamSlug(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e4e4e7", fontSize: "14px", color: "#18181b", boxSizing: "border-box", backgroundColor: "#ffffff" }}
            >
              <option value="">No team assignment</option>
              {(teams as any[]).map((team: any) => (
                <option key={team.slug} value={team.slug}>{team.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
              Expires In
            </label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e4e4e7", fontSize: "14px", color: "#18181b", backgroundColor: "#ffffff", boxSizing: "border-box" }}
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days (recommended)</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          {formError && (
            <p style={{ fontSize: "13px", color: "#dc2626", padding: "10px 12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
              {formError}
            </p>
          )}
          {createError && (
            <p style={{ fontSize: "13px", color: "#dc2626", padding: "10px 12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
              {createError.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isCreating || !orgSlug}
            style={{ padding: "10px 24px", backgroundColor: "#18181b", color: "#ffffff", border: "none", fontSize: "13px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", cursor: isCreating ? "not-allowed" : "pointer", opacity: isCreating ? 0.6 : 1, alignSelf: "flex-start" }}
          >
            {isCreating ? "Generating…" : "Generate Invite Link"}
          </button>
        </form>

        {/* New invite URL display */}
        {newInviteUrl && (
          <div style={{ marginTop: "20px", padding: "16px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Invite Link Ready
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <code style={{ flex: 1, fontSize: "12px", color: "#18181b", wordBreak: "break-all", backgroundColor: "#ffffff", padding: "8px", border: "1px solid #e4e4e7" }}>
                {newInviteUrl}
              </code>
              <button
                onClick={handleCopy}
                style={{ padding: "8px 16px", backgroundColor: copied ? "#16A34A" : "#18181b", color: "#ffffff", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "background-color 0.2s" }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "#71717a", marginTop: "8px" }}>
              Share this link with the person you want to invite. It will work once and expire as configured.
            </p>
          </div>
        )}
      </div>

      {/* Active Invites */}
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#18181b", marginBottom: "16px" }}>
          Active Invites ({activeInvites.length})
        </h2>
        {activeInvites.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", border: "1px solid #e4e4e7", color: "#71717a", fontSize: "14px" }}>
            No active invites. Generate one above.
          </div>
        ) : (
          <div style={{ border: "1px solid #e4e4e7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f4f4f5" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email / Open</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Created By</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Expires</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeInvites.map((inv, idx) => (
                  <tr key={inv.token} style={{ borderTop: idx > 0 ? "1px solid #e4e4e7" : "none" }}>
                    <td style={{ padding: "14px 16px", fontSize: "14px", color: "#18181b" }}>
                      {inv.email ?? <span style={{ color: "#71717a", fontStyle: "italic" }}>Open invite</span>}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "13px", color: "#71717a" }}>
                      {inv.createdBy?.name || inv.createdBy?.email}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "13px", color: "#71717a" }}>
                      {new Date(inv.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button
                        onClick={() => handleRevoke(inv.token)}
                        disabled={isRevoking && revokingToken === inv.token}
                        style={{ fontSize: "12px", color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
                      >
                        {isRevoking && revokingToken === inv.token ? "Revoking…" : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Used / Expired Invites */}
      {usedInvites.length > 0 && (
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#18181b", marginBottom: "16px" }}>
            Used & Expired ({usedInvites.length})
          </h2>
          <div style={{ border: "1px solid #e4e4e7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f4f4f5" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email / Open</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {usedInvites.map((inv, idx) => (
                  <tr key={inv.token} style={{ borderTop: idx > 0 ? "1px solid #e4e4e7" : "none" }}>
                    <td style={{ padding: "14px 16px", fontSize: "14px", color: "#71717a" }}>
                      {inv.email ?? <span style={{ fontStyle: "italic" }}>Open invite</span>}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                        color: inv.usedAt ? "#166534" : "#92400e",
                        backgroundColor: inv.usedAt ? "#f0fdf4" : "#fffbeb",
                        padding: "2px 8px",
                      }}>
                        {inv.usedAt ? "Used" : "Expired"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: "13px", color: "#71717a" }}>
                      {inv.usedAt
                        ? new Date(inv.usedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : new Date(inv.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
