export const UserRole = {
    ADMIN: "ADMIN",
    INSPECTOR: "INSPECTOR",
    BUYER: "BUYER",
    EXPORTER: "EXPORTER",
    FARMER: "FARMER",
    SUPER_ADMIN: "SUPER_ADMIN"
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

