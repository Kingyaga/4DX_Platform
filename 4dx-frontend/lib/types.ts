/**
 * Type definitions for 4DX Platform
 * Matches all tRPC response structures from the backend
 */

// ─── USER & ORGANIZATION ───────────────────────────────────────────────────

export type UserRole = "ADMIN" | "TEAM_LEAD" | "MEMBER";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgSlug?: string | null;
  createdAt?: Date;
  defaultTeamId?: string | null;
  orgMemberships?: Array<{
    id?: string;
    role: "ADMIN" | "MEMBER";
    org: {
      id?: string;
      name: string;
      slug: string;
    };
  }>;
  teamMemberships?: Array<{
    id?: string;
    role: "LEAD" | "MEMBER";
    team: {
      id?: string;
      name: string;
      slug: string;
    };
  }>;
}

export interface OrgUser {
  id: string;
  email: string;
  name: string | null;
  orgMemberships?: Array<{
    role: "ADMIN" | "MEMBER";
    org?: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
  teamMemberships?: Array<{
    role: "LEAD" | "MEMBER" | "OBSERVER";
    team?: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  createdAt: Date;
}

export interface OrgMembership {
  id: string;
  role: "ADMIN" | "MEMBER";
  userId: string;
  orgId: string;
}

// ─── TEAM ──────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  role: "LEAD" | "MEMBER";
  joinedAt: Date;
  userId: string;
  teamId: string;
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  };
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  archivedAt: Date | null;
  orgId: string;
  leadUserId: string;
  members: TeamMember[];
  wigs: WIG[];
}

export interface TeamWithoutWigs {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  archivedAt: Date | null;
  orgId: string;
  leadUserId: string;
}

export interface MyTeamsResponse extends TeamWithoutWigs {
  members: Array<{
    role: "LEAD" | "MEMBER";
  }>;
  wigs: WIG[];
}

// ─── WIG (WILDLY IMPORTANT GOAL) ───────────────────────────────────────────

export type WIGStatus = "DRAFT" | "ACTIVE" | "ACHIEVED" | "MISSED" | "ABANDONED";
export type TrackingType = "NUMERIC" | "MILESTONE";
export type ActivityProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "DONE";

export interface WIG {
  id: string;
  title: string;
  description: string | null;
  trackingType: TrackingType;
  fromValue: number | null;
  toValue: number | null;
  currentValue: number | null;
  unit: string | null;
  deadline: Date;
  status: WIGStatus;
  createdAt: Date;
  closedAt: Date | null;
  teamId: string;
  createdByUserId: string;
  leadMeasures: LeadMeasure[];
}

export interface CreateWIGInput {
  teamSlug: string;
  title: string;
  trackingType?: TrackingType;
  fromValue?: number;
  toValue?: number;
  unit?: string;
  deadline: string; // ISO string
  description?: string;
}

export interface UpdateWIGInput {
  wigId: string;
  data: {
    title?: string;
    description?: string;
    deadline?: string;
  };
}

// ─── LEAD MEASURE ──────────────────────────────────────────────────────────

export type Cadence = "WEEKLY" | "BIWEEKLY";

export interface LeadMeasureOwner {
  id: string;
  leadMeasureId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ActivityLogEntry {
  id: string;
  value: number | null;
  progressStatus: ActivityProgressStatus | null;
  loggedForDate: Date;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  userId?: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface LeadMeasure {
  id: string;
  name: string;
  description: string | null;
  trackingType: TrackingType;
  cadence: Cadence;
  targetValue: number | null;
  unit: string | null;
  createdAt: Date;
  archivedAt: Date | null;
  wigId: string;
  owners?: LeadMeasureOwner[];
  activityLogs?: ActivityLogEntry[];
}

export interface CreateLeadMeasureInput {
  wigId: string;
  name: string;
  cadence: Cadence;
  trackingType?: TrackingType;
  targetValue?: number;
  unit?: string;
  ownerUserIds: string[];
  description?: string;
}

export interface UpdateLeadMeasureInput {
  leadMeasureId: string;
  data: {
    name?: string;
    cadence?: Cadence;
    trackingType?: TrackingType;
    targetValue?: number;
    unit?: string;
    description?: string;
  };
}

// ─── ACTIVITY LOG ──────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  value: number | null;
  progressStatus: ActivityProgressStatus | null;
  loggedForDate: Date;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  editedAt: Date | null;
  leadMeasureId: string;
  userId: string;
  user: {
    id: string;
    name: string;
  };
}

export interface LogActivityInput {
  leadMeasureId: string;
  value?: number;
  progressStatus?: ActivityProgressStatus;
  loggedForDate: string; // ISO string
  note?: string;
}

export interface EditActivityInput {
  logId: string;
  value?: number;
  progressStatus?: ActivityProgressStatus;
  note?: string;
}

// ─── WEEKLY SESSION & COMMITMENT ───────────────────────────────────────────

export type SessionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETE" | "OVERDUE";
export type CommitmentStatus = "PENDING" | "DONE" | "PARTIAL" | "NOT_DONE";
export type NotDoneReason = "WHIRLWIND" | "MISJUDGED" | "BLOCKED" | "OTHER";

export interface Commitment {
  id: string;
  text: string;
  status: CommitmentStatus;
  notDoneReason: NotDoneReason | null;
  reflection: string | null;
  resolvedAt: Date | null;
  weeklySessionId: string;
  linkedLeadMeasureId: string | null;
}

export interface WeeklySession {
  id: string;
  weekStarting: Date;
  status: SessionStatus;
  accountDoneAt: Date | null;
  reviewDoneAt: Date | null;
  commitDoneAt: Date | null;
  createdAt: Date;
  wigId: string;
  userId: string;
  commitments: Commitment[];
  wig: WIG;
}

export interface CompleteAccountInput {
  sessionId: string;
  commitmentUpdates: Array<{
    commitmentId: string;
    status: CommitmentStatus;
    notDoneReason?: NotDoneReason;
    reflection?: string;
  }>;
}

export interface CompleteCommitInput {
  sessionId: string;
  commitments: Array<{
    text: string;
    linkedLeadMeasureId?: string;
  }>;
}

// ─── API ERROR ─────────────────────────────────────────────────────────────

export interface TRPCErrorData {
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "BAD_REQUEST"
    | "CONFLICT"
    | "INTERNAL_SERVER_ERROR";
  httpStatus: 401 | 403 | 404 | 400 | 409 | 500;
}

export interface APIError {
  message: string;
  code: TRPCErrorData["code"];
  httpStatus: TRPCErrorData["httpStatus"];
}

// ─── UTILITY TYPES ─────────────────────────────────────────────────────────

export interface LoadingState {
  isLoading: boolean;
  error: APIError | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
