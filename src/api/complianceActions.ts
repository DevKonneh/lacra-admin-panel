import api from './index';
import type { ApiResponse } from './types';

// Compliance Actions — a NEW, SIBLING api module shared by the Agency
// Register (src/api/agencies.ts), Local Produce Buyer Register
// (src/api/localProduceBuyers.ts), and Exporter Register
// (src/api/exporters.ts). Talks to the backend's ComplianceActionController
// routes, mounted under /api/agencies/:id/compliance-actions (and the
// personnel-level variant), /api/local-produce-buyers/:id/compliance-actions,
// and /api/exporters/:id/compliance-actions — the controller itself is
// fully generic (keyed by subjectType/subjectId, not by register), so no
// backend change was needed to support the Exporter Register.
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
// Certificate-level (Agency, Local Produce Buyer, Exporter, or
// Cooperative) compliance actions. `basePath` is '/agencies',
// '/local-produce-buyers', '/exporters', or '/cooperative-permits' — all
// four routers mount an identical pair of routes via the shared
// ComplianceActionController, so a single generic pair of functions here
// covers all four registers instead of duplicating near-identical
// functions per module.
// ---------------------------------------------------------------------

export type CertificateRegisterBasePath = '/agencies' | '/local-produce-buyers' | '/exporters' | '/cooperative-permits';

export const createCertificateComplianceAction = (
    basePath: CertificateRegisterBasePath,
    certificateId: string,
    payload: CreateComplianceActionPayload
) => {
    return api.post<ApiResponse<{ action: ComplianceAction; subject: any }>>(
        `${basePath}/${certificateId}/compliance-actions`,
        payload
    );
};

export const listCertificateComplianceActions = (
    basePath: CertificateRegisterBasePath,
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

export const createExporterComplianceAction = (exporterId: string, payload: CreateComplianceActionPayload) =>
    createCertificateComplianceAction('/exporters', exporterId, payload);

export const listExporterComplianceActions = (exporterId: string) =>
    listCertificateComplianceActions('/exporters', exporterId);

export const createCooperativePermitComplianceAction = (cooperativePermitId: string, payload: CreateComplianceActionPayload) =>
    createCertificateComplianceAction('/cooperative-permits', cooperativePermitId, payload);

export const listCooperativePermitComplianceActions = (cooperativePermitId: string) =>
    listCertificateComplianceActions('/cooperative-permits', cooperativePermitId);
