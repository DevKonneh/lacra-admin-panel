export const UserRole = {
    ADMIN: "ADMIN",
    INSPECTOR: "INSPECTOR",
    BUYER: "BUYER",
    EXPORTER: "EXPORTER",
    FARMER: "FARMER",
    SUPER_ADMIN: "SUPER_ADMIN",
    // Commercial and Marketing Officer / Director-General — added for the
    // Application workflow's Commercial Verification + First DG Approval
    // stages. Matches backend UserRole enum values exactly.
    COMMERCIAL: "COMMERCIAL",
    DG: "DG",
    // Technical Services Officer — added for Phase 3 (Technical Review +
    // Inspector Assignment + Warehouse Assessment + Second DG Approval).
    // INSPECTOR already existed above and is reused as-is.
    TECHNICAL: "TECHNICAL",
    // Finance Officer / IT Officer — added for Phase 4 (Billing Review +
    // Payment Verification + Final DG Approval + Certificate Printing/
    // Issuance). FINANCE covers both Billing and Payment stages; IT
    // handles certificate printing/issuance. Matches backend UserRole
    // enum values exactly.
    FINANCE: "FINANCE",
    IT: "IT",
    // Field Supervisor — added for the CMIS Monitoring feature. A field
    // supervisor oversees a set of enumerators (INSPECTOR role users) via
    // User.supervisorId and has scoped access to their field activity,
    // presence, and sync status under /api/monitoring/*. Matches backend
    // UserRole enum value exactly.
    FIELD_SUPERVISOR: "FIELD_SUPERVISOR"
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    createdAt: string;
    updatedAt: string;
}

// Matches the backend UserStatus enum exactly (entities/User.ts).
// SUSPENDED is distinct from REJECTED: REJECTED only ever applies to a
// declined PENDING self-registration, while SUSPENDED is an admin
// deliberately deactivating a previously-ACTIVE account (soft-delete,
// reversible) without losing the account's history or the records it's
// still referenced by.
export const UserStatus = {
    PENDING: "PENDING",
    ACTIVE: "ACTIVE",
    REJECTED: "REJECTED",
    SUSPENDED: "SUSPENDED",
} as const;

export type UserStatus = typeof UserStatus[keyof typeof UserStatus];

export interface User {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
    role: UserRole;
    assignedRole?: Role;
    status: UserStatus;
    lastLoginAt?: string | null;
    createdAt: string;
    updatedAt: string;
    // CMIS Monitoring fields (backend entities/User.ts). supervisorId is the
    // direct (one, non-hierarchical) FIELD_SUPERVISOR this user reports to,
    // relevant only for INSPECTOR (enumerator) users. assignedCounty/
    // assignedDistrict are the enumerator's declared territory ("Assigned
    // area"), kept explicitly separate from field-reported/observed area.
    // supervisorName is a denormalized convenience field some endpoints
    // may return alongside supervisorId for display purposes.
    supervisorId?: string | null;
    supervisorName?: string | null;
    assignedCounty?: string | null;
    assignedDistrict?: string | null;
}

// Matches the backend UserAuditAction enum exactly (entities/UserAuditLog.ts).
export type UserAuditAction =
    | 'CREATED'
    | 'ROLE_CHANGED'
    | 'STATUS_CHANGED'
    | 'PASSWORD_RESET'
    | 'PROFILE_UPDATED'
    | 'APPROVED'
    | 'REJECTED'
    | 'LOGIN'
    // CMIS Monitoring: logged by UserController.update() when an
    // enumerator's supervisorId or assignedCounty/assignedDistrict changes.
    | 'SUPERVISOR_CHANGED'
    | 'TERRITORY_CHANGED';

export interface UserAuditLogEntry {
    id: string;
    userId: string;
    action: UserAuditAction;
    previousValue: string | null;
    newValue: string | null;
    performedByUserId: string | null;
    performedByName: string | null;
    notes: string | null;
    createdAt: string;
}

