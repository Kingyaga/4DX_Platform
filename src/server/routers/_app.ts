import { router } from "../trpc";
import { authRouter } from "./auth";
import { orgRouter } from "./org";
import { teamsRouter } from "./teams";
import { wigsRouter } from "./wigs";
import { leadMeasuresRouter } from "./leadMeasure";
import { activityLogsRouter } from "./activityLogs";
import { sessionsRouter } from "./session";
import { invitesRouter } from "./invites";

export const appRouter = router({
  auth: authRouter,
  org: orgRouter,
  teams: teamsRouter,
  wigs: wigsRouter,
  leadMeasures: leadMeasuresRouter,
  activityLogs: activityLogsRouter,
  sessions: sessionsRouter,
  invites: invitesRouter,
});

export type AppRouter = typeof appRouter;
