"use client";

import { useMemo } from "react";
import { useTeamStore } from "@/lib/stores/team-store";
import { usePendingActivityRequests, useApproveActivityRequest, useDeclineActivityRequest } from "@/lib/hooks";
import { ErrorState, EmptyState } from "@/lib/components/states";

export default function TeamLeadRequestsPage() {
  const { currentTeamSlug } = useTeamStore();
  const { pendingRequests, isLoading, error, refetch } = usePendingActivityRequests(currentTeamSlug);
  const { approveRequest, isLoading: approving, error: approveError } = useApproveActivityRequest();
  const { declineRequest, isLoading: declining, error: declineError } = useDeclineActivityRequest();

  const actionInProgress = approving || declining;

  const hasRequests = pendingRequests.length > 0;

  const sortedRequests = useMemo(
    () => [...pendingRequests].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [pendingRequests],
  );

  const handleApprove = async (requestId: string) => {
    await approveRequest({ logId: requestId });
    refetch();
  };

  const handleDecline = async (requestId: string) => {
    await declineRequest({ logId: requestId });
    refetch();
  };

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0" }}>Requests</h1>
          <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>
            Review and approve pending activity logging requests from your team members.
          </p>
        </div>

        {(error || approveError || declineError) && (
          <ErrorState
            error={error || approveError || declineError}
            title="Unable to load or update requests"
          />
        )}

        {isLoading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#71717a" }}>
            Loading pending requests...
          </div>
        ) : !hasRequests ? (
          <EmptyState
            title="No pending requests"
            description="All activity requests are approved or declined. Members will see their logs once approved."
          />
        ) : (
          <div style={{ display: "grid", gap: "18px" }}>
            {sortedRequests.map((request) => (
              <div
                key={request.id}
                style={{
                  border: "1px solid #e4e4e7",
                  borderRadius: "16px",
                  backgroundColor: "#ffffff",
                  padding: "24px",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "18px",
                }}
              >
                <div style={{ display: "grid", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {request.leadMeasure.wig.title} • {request.leadMeasure.name}
                      </p>
                      <h2 style={{ margin: "6px 0 0 0", fontSize: "18px", fontWeight: 700, color: "#18181b" }}>
                        {request.user.name}
                      </h2>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontSize: "12px", color: "#71717a" }}>{new Date(request.loggedForDate).toLocaleDateString()}</p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "14px", fontWeight: 700, color: "#18181b" }}>{request.value}</p>
                    </div>
                  </div>

                  <p style={{ margin: 0, color: "#333333", fontSize: "14px", lineHeight: 1.75 }}>
                    {request.note || "No note provided."}
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: "180px" }}>
                  <button
                    type="button"
                    onClick={() => handleApprove(request.id)}
                    disabled={actionInProgress}
                    style={{
                      padding: "14px 16px",
                      backgroundColor: "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "10px",
                      cursor: actionInProgress ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(request.id)}
                    disabled={actionInProgress}
                    style={{
                      padding: "14px 16px",
                      backgroundColor: "#ef4444",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "10px",
                      cursor: actionInProgress ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
