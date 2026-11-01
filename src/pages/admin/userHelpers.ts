// Shared helpers for rendering User Management data (User Directory,
// Create/Edit User form, Pending Approvals) so role/status color-coding
// and formatting stay consistent across every screen that touches a
// staff account. Mirrors the existing cooperativeHelpers.ts /
// statusHelpers.ts pattern used elsewhere in this codebase.

// Human-readable labels for every UserRole value, since several of them
// (COMMERCIAL, DG, IT) read awkwardly or ambiguously as-is in a badge.
export const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Administrator',
    SUPER_ADMIN: 'Super Admin',
    INSPECTOR: 'Inspector',
    BUYER: 'Buyer',
    EXPORTER: 'Exporter',
    FARMER: 'Farmer',
    COMMERCIAL: 'Commercial Officer',
    DG: 'Director-General',
    TECHNICAL: 'Technical Officer',
    FINANCE: 'Finance Officer',
    IT: 'IT Officer',
};

export function roleLabel(role?: string | null): string {
    if (!role) return 'Unassigned';
    return ROLE_LABELS[role] || role;
}

// Tailwind color classes per role, grouped loosely by function (admin =
// purple, field/compliance = green/blue, finance/approval = amber/indigo)
// so the badge itself gives a visual hint of the account's scope.
export const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800',
    SUPER_ADMIN: 'bg-purple-100 text-purple-800',
    INSPECTOR: 'bg-blue-100 text-blue-800',
    TECHNICAL: 'bg-teal-100 text-teal-800',
    COMMERCIAL: 'bg-indigo-100 text-indigo-800',
    DG: 'bg-fuchsia-100 text-fuchsia-800',
    FINANCE: 'bg-amber-100 text-amber-800',
    IT: 'bg-cyan-100 text-cyan-800',
    BUYER: 'bg-orange-100 text-orange-800',
    EXPORTER: 'bg-orange-100 text-orange-800',
    FARMER: 'bg-green-100 text-green-800',
};

export function roleColor(role?: string | null): string {
    if (!role) return 'bg-gray-100 text-gray-600';
    return ROLE_COLORS[role] || 'bg-gray-100 text-gray-700';
}

export const STATUS_COLORS: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    SUSPENDED: 'bg-orange-100 text-orange-800',
    REJECTED: 'bg-red-100 text-red-800',
};

export function statusColor(status?: string | null): string {
    if (!status) return 'bg-gray-100 text-gray-700';
    return STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
}

export const STATUS_LABELS: Record<string, string> = {
    ACTIVE: 'Active',
    PENDING: 'Pending',
    SUSPENDED: 'Suspended',
    REJECTED: 'Rejected',
};

export function statusLabel(status?: string | null): string {
    if (!status) return 'Unknown';
    return STATUS_LABELS[status] || status;
}

/** "Jane Doe" -> "JD"; falls back to the first letter of the email. */
export function initials(name?: string | null, email?: string | null): string {
    const source = (name || '').trim();
    if (source) {
        const parts = source.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (email) return email[0]?.toUpperCase() || '?';
    return '?';
}

export function formatDateOnly(iso?: string | null): string {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Never';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string | null): string {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Never';
    return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

// Human-readable summary line for a single UserAuditLog row, e.g.
// "Role changed from Inspector to Technical Officer".
export function auditActionSummary(entry: {
    action: string;
    previousValue: string | null;
    newValue: string | null;
    notes: string | null;
}): string {
    switch (entry.action) {
        case 'CREATED':
            return `Account created${entry.newValue ? ` with role ${roleLabel(entry.newValue)}` : ''}.`;
        case 'ROLE_CHANGED':
            return `Role changed from ${roleLabel(entry.previousValue)} to ${roleLabel(entry.newValue)}.`;
        case 'STATUS_CHANGED':
            return `Status changed from ${statusLabel(entry.previousValue)} to ${statusLabel(entry.newValue)}.`;
        case 'PASSWORD_RESET':
            return 'Password reset by an administrator.';
        case 'PROFILE_UPDATED':
            return entry.notes || 'Profile details updated.';
        case 'APPROVED':
            return 'Account approved.';
        case 'REJECTED':
            return 'Account rejected.';
        case 'LOGIN':
            return 'Signed in.';
        default:
            return entry.notes || entry.action;
    }
}
