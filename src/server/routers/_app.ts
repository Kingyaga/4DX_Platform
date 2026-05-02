import { router } from "../trpc";
import { wigsRouter } from "./wigs";
import { teamsRouter } from "./teams";
import { authRouter } from "./auth";
import { leadMeasuresRouter } from "./leadMeasures";
import { activityLogsRouter } from "./activityLogs";
import { sessionsRouter } from "./sessions";
import { orgRouter } from "./org";

export const appRouter = router({
  wigs: wigsRouter,
  teams: teamsRouter,
  auth: authRouter,
  leadMeasures: leadMeasuresRouter,
  activityLogs: activityLogsRouter,
  sessions: sessionsRouter,
  org: orgRouter,
});

export type AppRouter = typeof appRouter;
