// Shared formatting/derivation helpers for the Cooperative Registry
// directory, detail panel, and import/admin screens. Kept separate from
// applications/statusHelpers.ts (that file is specific to the Application
// workflow's status enum) even though a couple of generic helpers
// (formatDateParts, durationLabel, apiErrorMessage) are reused from there
// rather than duplicated.

import type { CooperativeDirectoryItem } from '../../api/cooperatives';

/** Formats an integer with thousands separators (e.g. 2000 -> "2,000"). */
export function formatMembership(value: number | null | undefined): string {
    if (value === null || value === undefined) return 'Not reported';
    return value.toLocaleString('en-US');
}

/**
 * True when a cooperative has no reported membership total at all -
 * distinct from a cooperative whose reported membership is genuinely 0,
 * which `=== null` correctly does NOT match.
 */
export function isMembershipMissing(c: Pick<CooperativeDirectoryItem, 'membershipTotal'>): boolean {
    return c.membershipTotal === null || c.membershipTotal === undefined;
}

export type MembershipFilter = 'ALL' | 'AVAILABLE' | 'NOT_REPORTED';
export type QualityFilter = 'ALL' | 'NEEDS_REVIEW';
export type SortMode = 'NAME_ASC' | 'NAME_DESC' | 'MEMBERSHIP_DESC' | 'MEMBERSHIP_ASC' | 'RECENTLY_UPDATED';

export const SORT_LABELS: Record<SortMode, string> = {
    NAME_ASC: 'Name A–Z',
    NAME_DESC: 'Name Z–A',
    MEMBERSHIP_DESC: 'Highest Reported Membership',
    MEMBERSHIP_ASC: 'Lowest Reported Membership',
    RECENTLY_UPDATED: 'Recently Updated',
};

/**
 * Sums available membership figures across the given cooperatives,
 * excluding any with a missing (null) value - this is NOT a count of
 * unique farmers, and must never be presented as one. Returns both the
 * sum and how many of the input records actually contributed a number,
 * so the UI can show "(N of M reporting)" alongside the total.
 */
export function sumReportedMembership(items: Pick<CooperativeDirectoryItem, 'membershipTotal'>[]): { total: number; reportingCount: number } {
    let total = 0;
    let reportingCount = 0;
    for (const item of items) {
        if (item.membershipTotal !== null && item.membershipTotal !== undefined) {
            total += item.membershipTotal;
            reportingCount++;
        }
    }
    return { total, reportingCount };
}

/** Distinct, sorted commodity values actually present across the given
 * cooperatives - used to populate the Commodity filter dynamically from
 * real data rather than a hardcoded list, since the registry's
 * commodities field is free-form (not tied to the application wizard's
 * fixed Commodity enum). */
export function distinctCommodities(items: Pick<CooperativeDirectoryItem, 'commodities'>[]): string[] {
    const set = new Set<string>();
    for (const item of items) {
        for (const c of item.commodities || []) set.add(c);
    }
    return Array.from(set).sort();
}

/** Distinct, sorted county values actually present across the given
 * cooperatives. */
export function distinctCounties(items: Pick<CooperativeDirectoryItem, 'county'>[]): string[] {
    const set = new Set<string>();
    for (const item of items) {
        if (item.county) set.add(item.county);
    }
    return Array.from(set).sort();
}

/** The most recent updatedAt across the whole registry, or null if the
 * registry is empty - backs the header's "Last updated" figure. */
export function latestUpdatedAt(items: Pick<CooperativeDirectoryItem, 'updatedAt'>[]): string | null {
    let latest: string | null = null;
    for (const item of items) {
        if (!item.updatedAt) continue;
        if (!latest || new Date(item.updatedAt).getTime() > new Date(latest).getTime()) {
            latest = item.updatedAt;
        }
    }
    return latest;
}

export function formatDateOnly(iso?: string | null): string {
    if (!iso) return 'Not recorded';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Not recorded';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string | null): string {
    if (!iso) return 'Not recorded';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Not recorded';
    return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export const FLAG_TYPE_LABELS: Record<string, string> = {
    SUSPECTED_DUPLICATE: 'Suspected Duplicate',
    MISSING_INFORMATION: 'Missing Information',
    COMMODITY_INCONSISTENCY: 'Commodity Inconsistency',
};

export const FLAG_TYPE_COLORS: Record<string, string> = {
    SUSPECTED_DUPLICATE: 'bg-amber-100 text-amber-800 border border-amber-200',
    MISSING_INFORMATION: 'bg-slate-100 text-slate-700 border border-slate-200',
    COMMODITY_INCONSISTENCY: 'bg-orange-100 text-orange-800 border border-orange-200',
};
