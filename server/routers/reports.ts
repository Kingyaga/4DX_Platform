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

  const currentUserId = (ctx.session.user as any).id;
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
    current: leadMeasure.activityLogs.reduce((sum: number, log: any) => sum + log.value, 0),
  }));
  const executionScore = leadMeasureTotals.length > 0
    ? Math.round(
        leadMeasureTotals.reduce((sum: number, leadMeasure: any) => {
          return sum + Math.min((leadMeasure.current / (leadMeasure.targetValue || 1)) * 100, 100);
        }, 0) / leadMeasureTotals.length,
      )
    : 0;
  const onTrackCount = leadMeasureTotals.filter((leadMeasure: any) => leadMeasure.current >= leadMeasure.targetValue).length;

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
        const denominator = wig.toValue - wig.fromValue;
        const rawProgress = denominator > 0 ? ((wig.currentValue - wig.fromValue) / denominator) * 100 : 0;
        return [
          wig.title,
          String(wig.fromValue),
          String(wig.currentValue),
          String(wig.toValue),
          `${Math.max(0, Math.min(100, Math.round(rawProgress)))}%`,
          wig.status,
        ];
      }),
    ];
  } else {
    rows = [
      ["WIG", "Lead Measure", "Cadence", "Current", "Target", "Unit", "Status"],
      ...leadMeasureTotals.map((leadMeasure: any) => [
        leadMeasure.wig.title,
        leadMeasure.name,
        leadMeasure.cadence,
        String(leadMeasure.current),
        String(leadMeasure.targetValue),
        leadMeasure.unit,
        leadMeasure.current >= leadMeasure.targetValue ? "ON TRACK" : "BEHIND",
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
        where: { id: (ctx.session.user as any).id },
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
