"use client";

import { useMemo, useState } from "react";
import { useTeamStore } from "@/lib/stores/team-store";
import { trpc } from "@/lib/api-client";
import { usePendingActivityRequests, useApproveActivityRequest, useApproveAllActivityRequests, useDeclineActivityRequest } from "@/lib/hooks";
import { ErrorState, EmptyState } from "@/lib/components/states";
import { LoadingSpinner } from "@/lib/components/loading-spinner";

export default function TeamLeadRequestsPage() {
  const { currentTeamSlug } = useTeamStore();
  const trpcCtx = trpc.useContext();
  const { pendingRequests, isLoading, error, refetch } = usePendingActivityRequests(currentTeamSlug);
  const { approveRequest, isLoading: approving, error: approveError } = useApproveActivityRequest();
  const { approveAllRequests, isLoading: approvingAll, error: approveAllError } = useApproveAllActivityRequests();
  const { declineRequest, isLoading: declining, error: declineError } = useDeclineActivityRequest();

  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [processingRequestAction, setProcessingRequestAction] = useState<"approve" | "decline" | null>(null);
  const [requestStatusMessage, setRequestStatusMessage] = useState<string | null>(null);

  const actionInProgress = Boolean(processingRequestId) || approving || approvingAll || declining;

  const hasRequests = pendingRequests.length > 0;

  const sortedRequests = useMemo(
    () => [...pendingRequests].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [pendingRequests],
  );

  const handleApprove = async (requestId: string) => {
    setProcessingRequestId(requestId);
    setProcessingRequestAction("approve");
    setRequestStatusMessage(null);

    try {
      await approveRequest({ logId: requestId });
      await Promise.all([
        refetch(),
        trpcCtx.activityLogs.getPendingForTeam.invalidate({ teamSlug: currentTeamSlug || "" }),
        trpcCtx.wigs.getByTeam.invalidate({ teamSlug: currentTeamSlug || "" }),
        trpcCtx.activityLogs.getByUser.invalidate(),
        trpcCtx.sessions.getCurrentSession.invalidate({ teamSlug: currentTeamSlug || "" }),
      ]);
      setRequestStatusMessage("Request approved — activity log is now active.");
    } catch (err: any) {
      setRequestStatusMessage(err?.message || "Unable to approve this request. Please refresh and try again.");
    } finally {
      setProcessingRequestId(null);
      setProcessingRequestAction(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    if (!window.confirm("Decline this activity request? The member will be notified.")) return;
    setProcessingRequestId(requestId);
    setProcessingRequestAction("decline");
    setRequestStatusMessage(null);

    try {
      await declineRequest({ logId: requestId });
      await Promise.all([
        refetch(),
        trpcCtx.activityLogs.getPendingForTeam.invalidate({ teamSlug: currentTeamSlug || "" }),
        trpcCtx.wigs.getByTeam.invalidate({ teamSlug: currentTeamSlug || "" }),
        trpcCtx.activityLogs.getByUser.invalidate(),
        trpcCtx.sessions.getCurrentSession.invalidate({ teamSlug: currentTeamSlug || "" }),
      ]);
      setRequestStatusMessage("Request declined.");
    } catch (err: any) {
      setRequestStatusMessage(err?.message || "Unable to decline this request. Please refresh and try again.");
    } finally {
      setProcessingRequestId(null);
      setProcessingRequestAction(null);
    }
  };

  const handleApproveAll = async () => {
    if (!currentTeamSlug || pendingRequests.length === 0) return;

    setProcessingRequestId("all");
    setProcessingRequestAction("approve");
    setRequestStatusMessage(null);

    try {
      const requestedCount = pendingRequests.length;
      const result = await approveAllRequests({ teamSlug: currentTeamSlug });
      const approvedCount = typeof result?.count === "number" ? result.count : requestedCount;
      await Promise.all([
        refetch(),
        trpcCtx.activityLogs.getPendingForTeam.invalidate({ teamSlug: currentTeamSlug }),
        trpcCtx.wigs.getByTeam.invalidate({ teamSlug: currentTeamSlug }),
        trpcCtx.activityLogs.getByUser.invalidate(),
        trpcCtx.sessions.getCurrentSession.invalidate({ teamSlug: currentTeamSlug }),
      ]);
      setRequestStatusMessage(`${approvedCount} request${approvedCount === 1 ? "" : "s"} approved.`);
    } catch (err: any) {
      setRequestStatusMessage(err?.message || "Unable to approve requests. Please refresh and try again.");
    } finally {
      setProcessingRequestId(null);
      setProcessingRequestAction(null);
    }
  };

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
        <div data-tour="requests-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0" }}>Requests</h1>
            <p style={{ margin: 0, color: "#71717a", fontSize: "14px" }}>
              Review and approve pending activity logging requests from your team members.
            </p>
          </div>
          <div data-tour="approve-all">
          {hasRequests && (
            <button
              type="button"
              onClick={handleApproveAll}
              disabled={actionInProgress}
              style={{
                padding: "12px 16px",
                backgroundColor: actionInProgress ? "#71717a" : "#18181b",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                cursor: actionInProgress ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: "13px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {processingRequestId === "all" ? (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>hourglass_top</span>
                  Approving all...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>done_all</span>
                  Approve all
                </>
              )}
            </button>
          )}
          </div>
        </div>

        {(error || approveError || approveAllError || declineError) && (
          <ErrorState
            error={error || approveError || approveAllError || declineError}
            title="Unable to load or update requests"
          />
        )}

        {requestStatusMessage && (
          <div style={{ padding: "16px", borderRadius: "16px", backgroundColor: "#ecfdf5", color: "#166534", fontWeight: 600, marginBottom: "16px" }}>
            {requestStatusMessage}
          </div>
        )}

        {isLoading ? (
          <div style={{ minHeight: "420px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LoadingSpinner size="large" text="Loading pending requests..." />
          </div>
        ) : !hasRequests ? (
          <EmptyState
            title="No pending requests"
            description="All activity requests are approved or declined. Members will see their logs once approved."
          />
        ) : (
          <div data-tour="requests-list" style={{ display: "grid", gap: "18px" }}>
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
                      <p style={{ margin: "4px 0 0 0", fontSize: "14px", fontWeight: 700, color: "#18181b" }}>
                        {request.value} {request.leadMeasure.wig.unit}
                      </p>
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
                    disabled={actionInProgress && processingRequestId !== request.id}
                    style={{
                      padding: "14px 16px",
                      backgroundColor: "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "10px",
                      cursor: actionInProgress && processingRequestId !== request.id ? "not-allowed" : "pointer",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {processingRequestId === request.id && processingRequestAction === "approve" ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>hourglass_top</span>
                        Approving...
                      </>
                    ) : (
                      "Approve"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(request.id)}
                    disabled={actionInProgress && processingRequestId !== request.id}
                    style={{
                      padding: "14px 16px",
                      backgroundColor: "#ef4444",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "10px",
                      cursor: actionInProgress && processingRequestId !== request.id ? "not-allowed" : "pointer",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {processingRequestId === request.id && processingRequestAction === "decline" ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>hourglass_top</span>
                        Declining...
                      </>
                    ) : (
                      "Decline"
                    )}
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
