import { router } from "../trpc";
import { wigsRouter } from "./wigs";
import { teamsRouter } from "./teams";
import { authRouter } from "./auth";
import { leadMeasuresRouter } from "./leadMeasures";
import { activityLogsRouter } from "./activityLogs";
<<<<<<< HEAD
import { sessionsRouter } from "./session";
=======
import { sessionsRouter } from "./sessions";
import { orgRouter } from "./org";
import { notificationsRouter } from "./notifications";
>>>>>>> origin/main
import { invitesRouter } from "./invites";

export const appRouter = router({
  wigs: wigsRouter,
  teams: teamsRouter,
  auth: authRouter,
  leadMeasures: leadMeasuresRouter,
  activityLogs: activityLogsRouter,
  sessions: sessionsRouter,
<<<<<<< HEAD
=======
  org: orgRouter,
  notifications: notificationsRouter,
>>>>>>> origin/main
  invites: invitesRouter,
});

export type AppRouter = typeof appRouter;
