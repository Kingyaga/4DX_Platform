/**
 * Custom Data Hooks
 * Provide easy access to API data with loading/error states
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession as useAuthSession } from "next-auth/react";
import { trpc, parseTRPCError } from "./api-client";
import { useUserStore } from "./stores/user-store";
import { useTeamStore } from "./stores/team-store";
import { useSessionStore } from "./stores/session-store";
import type { Team, WIG, LeadMeasure, WeeklySession, APIError, UserRole } from "./types";

/**
 * Fetch and sync current user's profile and role from backend
 */
export function useCurrentUser() {
  const router = useRouter();
  const { data: session, status } = useAuthSession();
  const { user, setUser, setOrgSlug, clearUser } = useUserStore();
  
  // Fetch user data - refetch when session changes
  const { data: me, isLoading, error, refetch } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 0, // Always refetch to get latest data
    gcTime: 0, // Don't cache the data
  });

  // Refetch when session status changes
  useEffect(() => {
    if (status === "authenticated") {
      console.log("Session authenticated, refetching user data");
      refetch();
    } else if (status === "unauthenticated") {
      console.log("Session unauthenticated, clearing user");
      clearUser();
    }
  }, [status, refetch, clearUser]);

  useEffect(() => {
    // Handle unauthorized error - user not logged in
    if (error?.data?.code === "UNAUTHORIZED") {
      console.log("User not authenticated, clearing store and redirecting to login");
      clearUser();
      router.push("/login");
      return;
    }
  }, [error, router, clearUser]);

  useEffect(() => {
    if (me) {
      console.log("Fetched user from auth.me:", me);
      // me.role will be "ADMIN", "TEAM_LEAD", or "MEMBER"
      setUser(me as any);
      setOrgSlug(me.orgSlug || null);
    }
  }, [me, setUser, setOrgSlug]);

  return { data: me, isLoading, error, refetch };
}

/**
 * Check current user's role and permissions
 */
export function useRoleCheck() {
  const { userRole, user } = useUserStore();
  const { currentTeamSlug, myTeams } = useTeamStore();

  const isCurrentTeamLead = Boolean(
    userRole === "TEAM_LEAD" &&
    user?.id &&
    currentTeamSlug &&
    myTeams.some((team) => team.slug === currentTeamSlug && team.leadUserId === user.id),
  );

  return {
    isAdmin: userRole === "ADMIN",
    isTeamLead: userRole === "TEAM_LEAD",
    isMember: userRole === "MEMBER",
    canCreateWIG: isCurrentTeamLead,
    canArchiveWIG: userRole === "ADMIN" || isCurrentTeamLead,
    canGenerateReport: userRole === "ADMIN" || isCurrentTeamLead,
    canAddMembers: isCurrentTeamLead,
    canAssignTeamLead: userRole === "ADMIN",
    role: userRole,
  };
}

/**
 * Fetch user's teams for an organization
 */
export function useMyTeams(orgSlug: string | null) {
  const { setMyTeams } = useTeamStore();
  const query = (trpc.teams as any).getMyTeams.useQuery(
    { orgSlug: orgSlug || "" },
    { enabled: !!orgSlug },
  );

  useEffect(() => {
    if (query.data && orgSlug) {
      setMyTeams(query.data as any);
    }
  }, [query.data, orgSlug, setMyTeams]);

  return {
    teams: (query.data as any) || [],
    isLoading: query.isLoading,
    error: query.error ? parseTRPCError(query.error) : null,
    refetch: query.refetch,
  };
}

/**
 * Fetch all teams in an organization (Admin only)
 */
export function useAllTeams(orgSlug: string | null) {
  const query = (trpc.teams as any).getAllTeams.useQuery(
    { orgSlug: orgSlug || "" },
    { enabled: !!orgSlug },
  );

  return {
    teams: (query.data as any) || [],
    isLoading: query.isLoading,
    error: query.error ? parseTRPCError(query.error) : null,
    refetch: query.refetch,
  };
}

/**
 * Fetch a single team by slug
 */
export function useTeam(teamSlug: string | null) {
  const query = (trpc.teams as any).getBySlug.useQuery(
    { slug: teamSlug || "" },
    { enabled: !!teamSlug },
  );

  return {
    team: query.data || null,
    isLoading: query.isLoading,
    error: query.error ? parseTRPCError(query.error) : null,
    refetch: query.refetch,
  };
}

/**
 * Fetch WIGs for a team
 */
export function useWIGs(teamSlug: string | null) {
  const query = trpc.wigs.getByTeam.useQuery(
    { teamSlug: teamSlug || "" },
    { enabled: !!teamSlug },
  );

  return {
    wigs: query.data || [],
    isLoading: query.isLoading,
    error: query.error ? parseTRPCError(query.error) : null,
    refetch: query.refetch,
  };
}

/**
 * Fetch a single WIG by ID
 * NOTE: Backend doesn't have this endpoint yet - commenting out
 */
// export function useWIG(wigId: string | null) {
//   const query = trpc.wigs.getById.useQuery({ wigId: wigId || "" });
//
//   return {
//     wig: query.data || null,
//     isLoading: query.isLoading,
//     error: query.error ? parseTRPCError(query.error) : null,
//     refetch: query.refetch,
//   };
// }

/**
 * Fetch lead measures for a WIG
 */
export function useLeadMeasures(wigId: string | null) {
  const query = trpc.leadMeasures.getByWig.useQuery(
    { wigId: wigId || "" },
    { enabled: !!wigId },
  );

  return {
    leadMeasures: query.data || [],
    isLoading: query.isLoading,
    error: query.error ? parseTRPCError(query.error) : null,
    refetch: query.refetch,
  };
}

/**
 * Fetch current week sessions for a team
 */
export function useCurrentSessions(teamSlug: string | null) {
  const { setCurrentSessions } = useSessionStore();
  const query = trpc.sessions.getCurrentSession.useQuery({ teamSlug: teamSlug || "" });

  useEffect(() => {
    if (query.data && teamSlug) {
      setCurrentSessions([(query.data as any) as WeeklySession]);
    }
  }, [query.data, teamSlug, setCurrentSessions]);

  return {
    sessions: query.data ? [(query.data as any) as WeeklySession] : [],
    isLoading: query.isLoading,
    error: query.error ? parseTRPCError(query.error) : null,
    refetch: query.refetch,
  };
}

/**
 * Fetch a single session by ID
 */
export function useSession(sessionId: string | null) {
  const query = trpc.sessions.getMySession.useQuery({ sessionId: sessionId || "" });

  return {
    session: query.data || null,
    isLoading: query.isLoading,
    error: query.error ? parseTRPCError(query.error) : null,
    refetch: query.refetch,
  };
}

/**
 * Fetch organization dashboard (org admin only)
 */
export function useOrgDashboard(orgSlug: string | null) {
  const query = trpc.org.getDashboard.useQuery(
    { orgSlug: orgSlug || "" },
    { enabled: !!orgSlug },
  );

  return {
    org: query.data || null,
    isLoading: query.isLoading,
    error: query.error ? parseTRPCError(query.error) : null,
    refetch: query.refetch,
  };
}

/**
 * Fetch all users in the organization (Admin only)
 */
export function useOrgUsers(orgSlug: string | null) {
  const query = trpc.auth.getAllUsers.useQuery(
    { orgSlug: orgSlug || "" },
    { enabled: !!orgSlug },
  );

  return {
    users: query.data || [],
    isLoading: query.isLoading,
    error: query.error ? parseTRPCError(query.error) : null,
    refetch: query.refetch,
  };
}

/**
 * Delete a user (Admin only)
 */
export function useDeleteUser() {
  const mutation = trpc.auth.deleteUser.useMutation();

  return {
    deleteUser: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Delete a team (Admin only)
 */
export function useDeleteTeam() {
  const mutation = (trpc.teams as any).delete.useMutation();

  return {
    deleteTeam: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Create a new WIG (Team Lead only)
 */
export function useCreateWIG() {
  const mutation = trpc.wigs.create.useMutation();

  return {
    createWIG: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Create a new lead measure (Team Lead only)
 */
export function useCreateLeadMeasure() {
  const mutation = trpc.leadMeasures.create.useMutation();

  return {
    createLeadMeasure: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Log activity
 */
export function useLogActivity() {
  const mutation = trpc.activityLogs.log.useMutation();

  return {
    logActivity: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Fetch pending activity requests for the selected team
 */
export function usePendingActivityRequests(teamSlug: string | null) {
  const query = trpc.activityLogs.getPendingForTeam.useQuery(
    { teamSlug: teamSlug || "" },
    { enabled: !!teamSlug },
  );

  return {
    pendingRequests: query.data || [],
    isLoading: query.isLoading,
    error: query.error ? parseTRPCError(query.error) : null,
    refetch: query.refetch,
  };
}

export function useApproveActivityRequest() {
  const mutation = trpc.activityLogs.approve.useMutation();

  return {
    approveRequest: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

export function useDeclineActivityRequest() {
  const mutation = trpc.activityLogs.decline.useMutation();

  return {
    declineRequest: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Edit an existing activity log (within 24 hours)
 */
export function useEditActivity() {
  const mutation = trpc.activityLogs.edit.useMutation();

  return {
    editActivity: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Complete account step of weekly session
 */
export function useCompleteAccount() {
  const mutation = trpc.sessions.completeAccount.useMutation();

  return {
    completeAccount: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Complete review step of weekly session
 */
export function useCompleteReview() {
  const mutation = trpc.sessions.completeReview.useMutation();

  return {
    completeReview: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Complete commit step of weekly session
 */
export function useCompleteCommit() {
  const mutation = trpc.sessions.completeCommit.useMutation();

  return {
    completeCommit: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Close a WIG (Team Lead only)
 */
export function useCloseWIG() {
  const mutation = trpc.wigs.close.useMutation();

  return {
    closeWIG: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Update a WIG (Team Lead only)
 */
export function useUpdateWIG() {
  const mutation = trpc.wigs.update.useMutation();

  return {
    updateWIG: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Add member to team (Team lead or organization admin)
 */
export function useAddTeamMember() {
  const mutation = (trpc.teams as any).addMember.useMutation();

  return {
    addMember: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Remove member from team (Team Lead only)
 */
export function useRemoveTeamMember() {
  const mutation = (trpc.teams as any).removeMember.useMutation();

  return {
    removeMember: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Assign a team lead (Admin only)
 */
export function useAssignTeamLead() {
  const mutation = (trpc.teams as any).assignLead.useMutation();

  return {
    assignTeamLead: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Create a new team (Admin only)
 */
export function useCreateTeam() {
  const mutation = (trpc.teams as any).create.useMutation();

  return {
    createTeam: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? parseTRPCError(mutation.error) : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}
