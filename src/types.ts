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
    IT: "IT"
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
    | 'LOGIN';

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

