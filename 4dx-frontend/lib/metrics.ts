import type { LeadMeasure, WIG } from "@/lib/types";

export function isProgressStatusLeadMeasure(trackingType?: string | null) {
  return trackingType !== "NUMERIC" && trackingType !== "PERCENTAGE" && trackingType !== "DURATION";
}

export function getLeadMeasureApprovedTotal(leadMeasure: Pick<LeadMeasure, "activityLogs">) {
  return (leadMeasure.activityLogs || []).reduce((sum, log) => sum + (log.value ?? 0), 0);
}

export function getLatestProgressStatus(leadMeasure: Pick<LeadMeasure, "activityLogs">) {
  return [...(leadMeasure.activityLogs || [])]
    .sort((a, b) => new Date(b.loggedForDate).getTime() - new Date(a.loggedForDate).getTime())[0]
    ?.progressStatus;
}

export function getLeadMeasureProgress(leadMeasure: LeadMeasure) {
  if (isProgressStatusLeadMeasure(leadMeasure.trackingType)) {
    const latestStatus = getLatestProgressStatus(leadMeasure);
    if (latestStatus === "DONE") return 100;
    if (latestStatus === "IN_PROGRESS") return 50;
    if (latestStatus === "BLOCKED") return 25;
    return 0;
  }

  const target = leadMeasure.targetValue ?? 0;
  if (target <= 0) return 0;
  return Math.min(100, Math.round((getLeadMeasureApprovedTotal(leadMeasure) / target) * 100));
}

export function getWigProgress(wig: Pick<WIG, "leadMeasures">) {
  const leadMeasures = wig.leadMeasures || [];
  if (leadMeasures.length === 0) return 0;

  const total = leadMeasures.reduce((sum, leadMeasure) => sum + getLeadMeasureProgress(leadMeasure), 0);
  return Math.round(total / leadMeasures.length);
}

export function getExecutionScore(leadMeasures: LeadMeasure[]) {
  if (leadMeasures.length === 0) return 0;
  return Math.round(
    leadMeasures.reduce((sum, leadMeasure) => sum + getLeadMeasureProgress(leadMeasure), 0) / leadMeasures.length,
  );
}

export function getActiveWigs<T extends Pick<WIG, "status" | "archivedAt">>(wigs: T[]) {
  return wigs.filter((wig) => wig.status === "ACTIVE" && !wig.archivedAt);
}
