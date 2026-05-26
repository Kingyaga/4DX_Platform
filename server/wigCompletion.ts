export type LeadMeasureCompletionInput = {
  id: string;
  name?: string | null;
  trackingType?: string | null;
  targetValue?: number | null;
  activityLogs?: Array<{
    value?: number | null;
    valueJson?: unknown;
    progressStatus?: string | null;
    loggedForDate?: Date | string | null;
  }>;
};

export type WigCompletionInput = {
  fromValue?: number | null;
  status: string;
  closedAt: Date | null;
  leadMeasures: LeadMeasureCompletionInput[];
};

export function getLeadMeasureApprovedTotal(leadMeasure: LeadMeasureCompletionInput) {
  return (leadMeasure.activityLogs || []).reduce((sum, log) => sum + (log.value ?? 0), 0);
}

function getLatestProgressStatus(leadMeasure: LeadMeasureCompletionInput) {
  return [...(leadMeasure.activityLogs || [])]
    .sort((a, b) => {
      const aTime = a.loggedForDate ? new Date(a.loggedForDate).getTime() : 0;
      const bTime = b.loggedForDate ? new Date(b.loggedForDate).getTime() : 0;
      return bTime - aTime;
    })[0]?.progressStatus;
}

export function isLeadMeasureComplete(leadMeasure: LeadMeasureCompletionInput) {
  if (leadMeasure.trackingType && leadMeasure.trackingType !== "NUMERIC" && leadMeasure.trackingType !== "PERCENTAGE" && leadMeasure.trackingType !== "DURATION") {
    return getLatestProgressStatus(leadMeasure) === "DONE";
  }

  return (leadMeasure.targetValue ?? 0) > 0 && getLeadMeasureApprovedTotal(leadMeasure) >= (leadMeasure.targetValue ?? 0);
}

export function getLeadMeasureCompletionPercent(leadMeasure: LeadMeasureCompletionInput) {
  if (leadMeasure.trackingType && leadMeasure.trackingType !== "NUMERIC" && leadMeasure.trackingType !== "PERCENTAGE" && leadMeasure.trackingType !== "DURATION") {
    const status = getLatestProgressStatus(leadMeasure);
    if (status === "DONE") return 100;
    if (status === "IN_PROGRESS") return 50;
    if (status === "BLOCKED") return 25;
    return 0;
  }

  if ((leadMeasure.targetValue ?? 0) <= 0) return 0;
  return Math.min(100, (getLeadMeasureApprovedTotal(leadMeasure) / (leadMeasure.targetValue ?? 0)) * 100);
}

export function getWigCompletionScore(leadMeasures: LeadMeasureCompletionInput[]) {
  if (leadMeasures.length === 0) return 0;

  const totalPercent = leadMeasures.reduce(
    (sum, leadMeasure) => sum + getLeadMeasureCompletionPercent(leadMeasure),
    0,
  );

  return Math.round(totalPercent / leadMeasures.length);
}

export function getLastCompletedLeadMeasure(leadMeasures: LeadMeasureCompletionInput[]) {
  return leadMeasures
    .map((leadMeasure) => {
      let total = 0;
      const completionLog = [...(leadMeasure.activityLogs || [])]
        .sort((a, b) => {
          const aTime = a.loggedForDate ? new Date(a.loggedForDate).getTime() : 0;
          const bTime = b.loggedForDate ? new Date(b.loggedForDate).getTime() : 0;
          return aTime - bTime;
        })
        .find((log) => {
          total += log.value ?? 0;
          if (leadMeasure.trackingType && leadMeasure.trackingType !== "NUMERIC" && leadMeasure.trackingType !== "PERCENTAGE" && leadMeasure.trackingType !== "DURATION") {
            return log.progressStatus === "DONE";
          }
          return (leadMeasure.targetValue ?? 0) > 0 && total >= (leadMeasure.targetValue ?? 0);
        });

      return completionLog
        ? {
            id: leadMeasure.id,
            name: leadMeasure.name || "Lead measure",
            completedAt: completionLog.loggedForDate ? new Date(completionLog.loggedForDate) : null,
          }
        : null;
    })
    .filter((completion): completion is { id: string; name: string; completedAt: Date | null } => Boolean(completion))
    .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0] || null;
}

export function getNextWigCompletionState(wig: WigCompletionInput, now: Date = new Date()) {
  const totalApproved = wig.leadMeasures.reduce(
    (sum, leadMeasure) => sum + getLeadMeasureApprovedTotal(leadMeasure),
    0,
  );
  const allLeadMeasuresCompleted =
    wig.leadMeasures.length > 0 && wig.leadMeasures.every(isLeadMeasureComplete);

  return {
    currentValue: (wig.fromValue ?? 0) + totalApproved,
    completionScore: getWigCompletionScore(wig.leadMeasures),
    lastCompletedLeadMeasure: getLastCompletedLeadMeasure(wig.leadMeasures),
    status: allLeadMeasuresCompleted ? "ACHIEVED" : wig.status,
    closedAt: allLeadMeasuresCompleted ? wig.closedAt ?? now : wig.closedAt,
    achieved: allLeadMeasuresCompleted && wig.status !== "ACHIEVED",
  };
}
