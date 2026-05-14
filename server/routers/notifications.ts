import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const notificationsRouter = router({
  // Get all unread notifications for the logged in user
  getUnread: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.notification.findMany({
      where: {
        userId: (ctx.session.user as any).id,
        readAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Mark a notification as read
  markRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.notification.update({
        where: { id: input.notificationId },
        data: { readAt: new Date() },
      });
    }),

  // Mark all notifications as read
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.db.notification.updateMany({
      where: {
        userId: (ctx.session.user as any).id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }),

  // Get notification count — for the badge on the bell icon
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.notification.count({
      where: {
        userId: (ctx.session.user as any).id,
        readAt: null,
      },
    });
    return { count };
  }),
});
