import api from './index';
import type { ApiResponse } from './types';

// Compliance Actions — a NEW, SIBLING api module shared by the Agency
// Register (src/api/agencies.ts) and Local Produce Buyer Register
// (src/api/localProduceBuyers.ts). Talks to the backend's
// ComplianceActionController routes, mounted under both
// /api/agencies/:id/compliance-actions (and the personnel-level variant)
// and /api/local-produce-buyers/:id/compliance-actions.
//
// Every action requires a staff-entered `reason` (enforced server-side by
// ComplianceActionService — "A reason is required for every compliance
// action."). FINE additionally requires a positive `fineAmount`.
//
// SUSPEND/REVOKE/REINSTATE flip the underlying Application.status, which
// PermitVerificationService.computePublicStatus() already checks ahead of
// the normal issued/expired timeline — so the register list/profile status
// badges and the public QR-verification pages pick this up automatically
// with no separate wiring needed here.

export type ComplianceActionType = 'WARNING' | 'FINE' | 'SUSPEND' | 'REVOKE' | 'REINSTATE';
export type ComplianceSubjectType = 'CERTIFICATE' | 'AGENT_PERSONNEL';

export interface ComplianceAction {
    id: string;
    subjectType: ComplianceSubjectType;
    subjectId: string;
    subjectName: string | null;
    subjectPermitNumber: string | null;
    actionType: ComplianceActionType;
    reason: string;
    fineAmount: number | null;
    fineCurrency: string | null;
    finePaid: boolean;
    finePaidAt: string | null;
    performedByUserId: string | null;
    performedByName: string | null;
    previousStatus: string | null;
    newStatus: string | null;
    createdAt: string;
}

export interface CreateComplianceActionPayload {
    actionType: ComplianceActionType;
    reason: string;
    // Required (and must be > 0) when actionType === 'FINE'. Ignored for
    // every other action type.
    fineAmount?: number;
    fineCurrency?: string;
}

// ---------------------------------------------------------------------
// Certificate-level (Agency or Local Produce Buyer) compliance actions.
// `basePath` is either '/agencies' or '/local-produce-buyers' — both
// routers mount an identical pair of routes via the shared
// ComplianceActionController, so a single generic pair of functions here
// covers both registers instead of duplicating four near-identical
// functions per module.
// ---------------------------------------------------------------------

export const createCertificateComplianceAction = (
    basePath: '/agencies' | '/local-produce-buyers',
    certificateId: string,
    payload: CreateComplianceActionPayload
) => {
    return api.post<ApiResponse<{ action: ComplianceAction; subject: any }>>(
        `${basePath}/${certificateId}/compliance-actions`,
        payload
    );
};

export const listCertificateComplianceActions = (
    basePath: '/agencies' | '/local-produce-buyers',
    certificateId: string
) => {
    return api.get<ApiResponse<ComplianceAction[]>>(`${basePath}/${certificateId}/compliance-actions`);
};

// ---------------------------------------------------------------------
// Personnel-level (individual Agent/Clerk) compliance actions — Agency
// Register only, since Local Produce Buyer has no personnel roster.
// ---------------------------------------------------------------------

export const createPersonnelComplianceAction = (
    agencyId: string,
    personnelId: string,
    payload: CreateComplianceActionPayload
) => {
    return api.post<ApiResponse<{ action: ComplianceAction; subject: any }>>(
        `/agencies/${agencyId}/personnel/${personnelId}/compliance-actions`,
        payload
    );
};

export const listPersonnelComplianceActions = (agencyId: string, personnelId: string) => {
    return api.get<ApiResponse<ComplianceAction[]>>(
        `/agencies/${agencyId}/personnel/${personnelId}/compliance-actions`
    );
};

// Convenience wrappers so call sites read naturally for each register.
export const createAgencyComplianceAction = (agencyId: string, payload: CreateComplianceActionPayload) =>
    createCertificateComplianceAction('/agencies', agencyId, payload);

export const listAgencyComplianceActions = (agencyId: string) =>
    listCertificateComplianceActions('/agencies', agencyId);

export const createLocalProduceBuyerComplianceAction = (buyerId: string, payload: CreateComplianceActionPayload) =>
    createCertificateComplianceAction('/local-produce-buyers', buyerId, payload);

export const listLocalProduceBuyerComplianceActions = (buyerId: string) =>
    listCertificateComplianceActions('/local-produce-buyers', buyerId);
