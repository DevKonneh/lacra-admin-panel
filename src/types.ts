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

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    assignedRole?: Role;
    status: string;
    createdAt: string;
    updatedAt: string;
}

