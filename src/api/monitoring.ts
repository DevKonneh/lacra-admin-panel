import apiClient from './client';
import type { ApiResponse } from './types';

// CMIS Monitoring API client — talks to the backend's /api/monitoring/*
// endpoints added in the Monitoring feature (MonitoringController.ts).
//
// Access notes (enforced server-side, mirrored here only for UI gating):
// - heartbeat: any authenticated web staff user.
// - userActivity / userSignInHistory: ADMIN only (403 for everyone else,
//   including FIELD_SUPERVISOR — staff-wide activity is admin-only).
// - enumerators / enumeratorDetail: ADMIN (sees all) or FIELD_SUPERVISOR
//   (sees only their own direct reports, access is resolved live server
//   side on every call — no caching/staleness, so a supervisor reassigned
//   away from an enumerator loses access to that enumerator immediately).

export type PresenceStatus = 'ONLINE' | 'IDLE' | 'OFFLINE';

export interface UserActivityEntry {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    lastLoginAt: string | null;
    presence: PresenceStatus;
}

export interface SignInAttemptEntry {
    id: string;
    userId: string;
    outcome: string;
    reason: string | null;
    platform: string | null;
    createdAt: string;
}

export type FieldStatus = 'NEVER_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT';

export interface LastReportedLocation {
    latitude: number;
    longitude: number;
    capturedAt: string;
    sourceEventType: string;
}

export interface SyncStatusSummary {
    lastSuccessfulSyncAt: string | null;
    lastPendingCount: number | null;
    lastPendingReportedAt: string | null;
    lastSyncError: string | null;
    lastSyncErrorAt: string | null;
}

// Farmer identity-verification states (Farmer.identityStatus) and farm
// geometry-validation states (Farm.geometryStatus), counted ONLY across
// the records this specific enumerator registered (registeredByUserId) —
// a subset breakdown of recordCounts.farmers/farms above, never a
// cross-enumerator queue/worklist. Deliberately kept as two SEPARATE
// breakdowns rather than one blended "review progress %", matching this
// backend's existing rule that verification/geometry/compliance numbers
// are always reported independently (see ReportsController).
export interface ReviewProgress {
    identityStatus: { Verified: number; Unverified: number; Conflict: number };
    geometryStatus: { Valid: number; 'Needs Review': number; Invalid: number; Missing: number };
}

export interface EnumeratorSummary {
    id: string;
    name: string;
    email: string;
    supervisorId: string | null;
    assignedCounty: string | null;
    assignedDistrict: string | null;
    fieldStatus: FieldStatus;
    lastReportedLocation: LastReportedLocation | null;
    // Actual record counts only — no assignment targets/completion % yet
    // (explicitly deferred per the approved Monitoring spec).
    recordCounts: { farmers: number; farms: number };
    reviewProgress: ReviewProgress;
    syncStatus: SyncStatusSummary | null;
}

export interface FieldEventEntry {
    id: string;
    enumeratorId: string;
    type: string;
    capturedAt: string;
    receivedAt: string;
    latitude: number | null;
    longitude: number | null;
    [key: string]: any;
}

export interface EnumeratorDetail extends EnumeratorSummary {
    timeline: FieldEventEntry[];
}

// Any authenticated web staff member may report their own heartbeat.
// tabId should be a stable per-tab identifier (e.g. generated once and
// stored in sessionStorage so each browser tab counts as its own session).
export const sendHeartbeat = async (tabId: string, interacted: boolean) => {
    return apiClient.post<ApiResponse<{ receivedAt: string }>>('/monitoring/heartbeat', {
        tabId,
        interacted,
    });
};

// Admin-only: all staff users with derived Online/Idle/Offline presence.
export const getUserActivity = async () => {
    return apiClient.get<ApiResponse<UserActivityEntry[]>>('/monitoring/user-activity');
};

// Admin-only: sign-in history for a single user, most recent first.
export const getUserSignInHistory = async (id: string) => {
    return apiClient.get<ApiResponse<SignInAttemptEntry[]>>(`/monitoring/users/${id}/sign-in-history`);
};

// ADMIN (all enumerators) or FIELD_SUPERVISOR (only their direct reports).
export const getEnumerators = async () => {
    return apiClient.get<ApiResponse<EnumeratorSummary[]>>('/monitoring/enumerators');
};

// ADMIN or the enumerator's own FIELD_SUPERVISOR. 403 if not visible to
// the current user (e.g. a supervisor requesting someone else's report,
// or a supervisor who has since been reassigned away from this enumerator).
export const getEnumeratorDetail = async (id: string) => {
    return apiClient.get<ApiResponse<EnumeratorDetail>>(`/monitoring/enumerators/${id}`);
};
