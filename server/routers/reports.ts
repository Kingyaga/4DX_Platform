import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { sendReportSharedEmail } from "../email";

const reportTypeSchema = z.enum(["execution", "lag", "lead"]);

type ReportType = z.infer<typeof reportTypeSchema>;

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function reportTitle(reportType: ReportType) {
  switch (reportType) {
    case "execution":
      return "Execution Score Report";
    case "lag":
      return "Lag Measures Report";
    case "lead":
      return "Lead Measures Report";
  }
}

function leadMeasureScore(leadMeasure: any) {
  if (leadMeasure.trackingType === "MILESTONE") {
    const latest = [...(leadMeasure.activityLogs || [])].sort((a: any, b: any) => new Date(b.loggedForDate).getTime() - new Date(a.loggedForDate).getTime())[0];
    if (latest?.progressStatus === "DONE") return 100;
    if (latest?.progressStatus === "IN_PROGRESS") return 50;
    if (latest?.progressStatus === "BLOCKED") return 25;
    return 0;
  }

  const current = leadMeasure.activityLogs.reduce((sum: number, log: any) => sum + (log.value ?? 0), 0);
  const target = leadMeasure.targetValue ?? 0;
  return target > 0 ? Math.min((current / target) * 100, 100) : 0;
}

function wigScore(wig: any) {
  if (wig.trackingType === "MILESTONE") {
    const leadMeasures = wig.leadMeasures || [];
    return leadMeasures.length > 0
      ? Math.round(leadMeasures.reduce((sum: number, leadMeasure: any) => sum + leadMeasureScore(leadMeasure), 0) / leadMeasures.length)
      : 0;
  }

  const fromValue = wig.fromValue ?? 0;
  const toValue = wig.toValue ?? 0;
  const currentValue = wig.currentValue ?? fromValue;
  const denominator = toValue - fromValue;
  return denominator > 0 ? Math.max(0, Math.min(100, Math.round(((currentValue - fromValue) / denominator) * 100))) : 0;
}

async function assertCanUseTeamReports(ctx: any, teamSlug: string) {
  const team = await ctx.db.team.findUnique({
    where: { slug: teamSlug },
    include: {
      org: true,
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });

  const currentUserId = ctx.session.user.id;
  const isTeamLead = team.leadUserId === currentUserId;
  const isOrgAdmin = await ctx.db.orgMembership.findFirst({
    where: { orgId: team.orgId, userId: currentUserId, role: "ADMIN" },
  });

  if (!isTeamLead && !isOrgAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the team lead or org admin can generate team reports.",
    });
  }

  return team;
}

async function buildReport(ctx: any, teamSlug: string, reportType: ReportType) {
  const team = await assertCanUseTeamReports(ctx, teamSlug);
  const wigs = await ctx.db.wIG.findMany({
    where: { teamId: team.id },
    include: {
      leadMeasures: {
        where: { archivedAt: null },
        include: {
          activityLogs: {
            where: { status: "APPROVED" },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { loggedForDate: "desc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const leadMeasures = wigs.flatMap((wig: any) =>
    wig.leadMeasures.map((leadMeasure: any) => ({ ...leadMeasure, wig })),
  );
  const leadMeasureTotals = leadMeasures.map((leadMeasure: any) => ({
    ...leadMeasure,
    current: leadMeasure.activityLogs.reduce((sum: number, log: any) => sum + (log.value ?? 0), 0),
    score: leadMeasureScore(leadMeasure),
  }));
  const incompleteLeadMeasureTotals = leadMeasureTotals.filter((leadMeasure: any) => leadMeasure.score < 100);
  const executionScore = leadMeasureTotals.length > 0
    ? Math.round(
        leadMeasureTotals.reduce((sum: number, leadMeasure: any) => {
          return sum + leadMeasure.score;
        }, 0) / leadMeasureTotals.length,
      )
    : 0;
  const onTrackCount = leadMeasureTotals.filter((leadMeasure: any) => leadMeasure.score >= 100).length;

  let rows: string[][];
  if (reportType === "execution") {
    rows = [
      ["Metric", "Value"],
      ["Team", team.name],
      ["Overall Score", `${executionScore}%`],
      ["Lead Measures On Track", String(onTrackCount)],
      ["Lead Measures Behind Pace", String(leadMeasureTotals.length - onTrackCount)],
      ["Total Lead Measures", String(leadMeasureTotals.length)],
    ];
  } else if (reportType === "lag") {
    rows = [
      ["WIG", "Baseline", "Current", "Target", "Progress", "Status"],
      ...wigs.map((wig: any) => {
        return [
          wig.title,
          wig.trackingType === "MILESTONE" ? "Outcome" : String(wig.fromValue ?? 0),
          wig.trackingType === "MILESTONE" ? `${wigScore(wig)}%` : String(wig.currentValue ?? wig.fromValue ?? 0),
          wig.trackingType === "MILESTONE" ? "Milestone" : String(wig.toValue ?? 0),
          `${wigScore(wig)}%`,
          wig.status,
        ];
      }),
    ];
  } else {
    rows = [
      ["WIG", "Lead Measure", "Cadence", "Current", "Target", "Unit", "Status"],
      ...incompleteLeadMeasureTotals.map((leadMeasure: any) => [
        leadMeasure.wig.title,
        leadMeasure.name,
        leadMeasure.cadence,
        leadMeasure.trackingType === "MILESTONE" ? `${leadMeasure.score}%` : String(leadMeasure.current),
        leadMeasure.trackingType === "MILESTONE" ? "Done" : String(leadMeasure.targetValue ?? 0),
        leadMeasure.trackingType === "MILESTONE" ? "Status" : (leadMeasure.unit ?? ""),
        leadMeasure.score >= 100 ? "ON TRACK" : "BEHIND",
      ]),
    ];
  }

  const date = new Date().toISOString().slice(0, 10);
  return {
    team,
    title: reportTitle(reportType),
    filename: `${team.slug}-${reportType}-report-${date}.csv`,
    csv: toCsv(rows),
  };
}

export const reportsRouter = router({
  exportCsv: protectedProcedure
    .input(z.object({ teamSlug: z.string(), reportType: reportTypeSchema }))
    .query(async ({ ctx, input }) => {
      const report = await buildReport(ctx, input.teamSlug, input.reportType);
      return {
        filename: report.filename,
        contentType: "text/csv;charset=utf-8",
        csv: report.csv,
      };
    }),

  share: protectedProcedure
    .input(z.object({ teamSlug: z.string(), reportType: reportTypeSchema }))
    .mutation(async ({ ctx, input }) => {
      const report = await buildReport(ctx, input.teamSlug, input.reportType);
      const currentUser = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { name: true, email: true },
      });

      let sent = 0;
      for (const member of report.team.members) {
        const didSend = await sendReportSharedEmail({
          to: member.user.email,
          name: member.user.name || member.user.email,
          teamName: report.team.name,
          reportTitle: report.title,
          sharedByName: currentUser?.name || currentUser?.email || "Your team lead",
          csv: report.csv,
        });
        if (didSend) sent += 1;
      }

      return {
        sent,
        recipients: report.team.members.length,
        emailConfigured: sent > 0 || report.team.members.length === 0,
      };
    }),
});
