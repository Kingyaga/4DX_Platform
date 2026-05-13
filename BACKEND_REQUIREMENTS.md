# Backend Requirements for Role-Based Dashboard

## Current Status
The frontend is trying to fetch the user's role from the session, but the NextAuth session doesn't include it. The frontend needs ONE of the following solutions:

## Solution 1: Add Role to NextAuth Session (PREFERRED)

Modify the NextAuth configuration to include the user's role in the session callback:

```typescript
// In your NextAuth configuration
callbacks: {
  async session({ session, token }) {
    if (session.user) {
      session.user.role = token.role; // Add role from JWT token
    }
    return session;
  },
  async jwt({ token, user }) {
    if (user) {
      token.role = user.role; // Add role when user is set
    }
    return token;
  },
},
```

This way, the role will be available in the NextAuth session automatically.

## Solution 2: Create `auth.me()` Backend Endpoint

If you prefer to fetch the user separately, add this endpoint to your tRPC auth router:

```typescript
// In src/server/routers/auth.ts
me: publicProcedure
  .query(async ({ ctx }) => {
    if (!ctx.session?.user?.id) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        defaultTeamId: true,
      },
    });
    
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    
    return user;
  }),
```

## Frontend Implementation Status

✅ **UserInitializer Component** - Initializes user store from session
✅ **useCurrentUser Hook** - Attempts to fetch user profile with role
✅ **useRoleCheck Hook** - Provides permission checks based on role
✅ **Dashboard Layout** - Filters nav items based on role
✅ **All Dashboard Pages** - Created for ADMIN and TEAM_LEAD roles

## What the Frontend is Doing

1. On app load, `UserInitializer` component checks if session exists
2. It calls `useCurrentUser()` hook which attempts to fetch `/api/trpc/auth.me`
3. If endpoint exists, it sets user store with role
4. Dashboard layout filters navigation based on `userRole` 
5. Nav items show: Admin pages (ADMIN only), Team Lead pages (TEAM_LEAD only)

## Testing

Once you implement one of the above solutions:

1. User logs in
2. Frontend receives session + role
3. User store is populated
4. Navigation filters to show role-specific pages
5. User sees Admin dashboard (if ADMIN) or Team Lead dashboard (if TEAM_LEAD)

## Current Test User

Email: dave@test.com
Current Role: MEMBER (because backend doesn't have role in session yet)
Need to set role in database for this user to see Admin/Team Lead pages.
