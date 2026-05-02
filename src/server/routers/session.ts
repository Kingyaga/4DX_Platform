import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const sessionsRouter = router({
  // Called every Monday to generate sessions for all team members
  generateForTeam: protectedProcedure
    .input(z.object({ teamSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.team.findUnique({
        where: { slug: input.teamSlug },
        include: {
          members: true,
          wigs: { where: { status: "ACTIVE" } },
        },
      });

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });

      if (team.leadUserId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const monday = getThisMonday();

      // Create one session per member per active WIG
      const sessionsToCreate = team.members.flatMap((member) =>
        team.wigs.map((wig) => ({
          userId: member.userId,
          wigId: wig.id,
          weekStarting: monday,
          status: "PENDING" as const,
        })),
      );

      await ctx.db.weeklySession.createMany({
        data: sessionsToCreate,
        skipDuplicates: true,
      });

      return { created: sessionsToCreate.length };
    }),

  // Step 1 of 3: Account — review last week's commitments
  completeAccount: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        commitmentUpdates: z.array(
          z.object({
            commitmentId: z.string(),
            status: z.enum(["DONE", "PARTIAL", "NOT_DONE"]),
            notDoneReason: z
              .enum(["WHIRLWIND", "MISJUDGED", "BLOCKED", "OTHER"])
              .optional(),
            reflection: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.weeklySession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== ctx.session.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      if (session.accountDoneAt)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Account step already completed.",
        });

      // Update each commitment's outcome
      await Promise.all(
        input.commitmentUpdates.map((update) =>
          ctx.db.commitment.update({
            where: { id: update.commitmentId },
            data: {
              status: update.status,
              notDoneReason: update.notDoneReason,
              reflection: update.reflection,
              resolvedAt: new Date(),
            },
          }),
        ),
      );

      return ctx.db.weeklySession.update({
        where: { id: input.sessionId },
        data: {
          accountDoneAt: new Date(),
          status: "IN_PROGRESS",
        },
      });
    }),

  // Step 2 of 3: Review — acknowledge the scoreboard
  completeReview: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.weeklySession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== ctx.session.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });

      // Gate: Account must be done first
      if (!session.accountDoneAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "You must complete the Account step before reviewing the scoreboard.",
        });
      }

      if (session.reviewDoneAt)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Review step already completed.",
        });

      return ctx.db.weeklySession.update({
        where: { id: input.sessionId },
        data: { reviewDoneAt: new Date() },
      });
    }),

  // Step 3 of 3: Commit — make 1-3 commitments for next week
  completeCommit: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        commitments: z
          .array(
            z.object({
              text: z.string().min(5),
              linkedLeadMeasureId: z.string().optional(),
            }),
          )
          .min(1)
          .max(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.weeklySession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== ctx.session.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });

      // Gate: Both Account and Review must be done first
      if (!session.accountDoneAt || !session.reviewDoneAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You must complete the Account and Review steps first.",
        });
      }

      if (session.commitDoneAt)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Commit step already completed.",
        });

      await ctx.db.commitment.createMany({
        data: input.commitments.map((c) => ({
          weeklySessionId: input.sessionId,
          text: c.text,
          linkedLeadMeasureId: c.linkedLeadMeasureId,
          status: "PENDING",
        })),
      });

      return ctx.db.weeklySession.update({
        where: { id: input.sessionId },
        data: {
          commitDoneAt: new Date(),
          status: "COMPLETE",
        },
      });
    }),

  getMySession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.weeklySession.findUnique({
        where: { id: input.sessionId },
        include: {
          commitments: true,
          wig: { include: { leadMeasures: true } },
        },
      });

      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== ctx.session.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });

      return session;
    }),
});

// Helper: get the most recent Monday at midnight UTC
function getThisMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}
