import {
    LayoutDashboard,
    Users,
    BookUser,
    Building2,
    ShieldQuestion,
    LandPlot,
    Map as MapIcon,
    ShieldCheck,
    Satellite,
    Briefcase,
    Truck,
    Link2,
    Ship,
    FileCheck2,
    FileBadge,
    Stamp,
    ClipboardCheck,
    FlaskConical,
    Gavel,
    Settings,
    UserCheck,
    UploadCloud,
} from 'lucide-react';
import { UserRole } from '../types';

export interface NavigationItem {
    label: string;
    path?: string;
    icon?: any;
    children?: NavigationItem[];
    roles?: UserRole[];
    // Optional, additional narrowing on top of `roles`. Only takes effect
    // for accounts that have an explicit Permission Group assigned (see
    // Sidebar.tsx's hasPermission()) — accounts without one are unaffected
    // and see this item exactly as the `roles` check alone would show it.
    // Matches if the account's permissions include ANY entry starting with
    // one of these prefixes, e.g. "license" matches "license.view",
    // "license.approve", etc.
    permissionPrefixes?: string[];
}

// -----------------------------------------------------------------------
// Navigation taxonomy (8 task-oriented groups)
// -----------------------------------------------------------------------
// Reorganised from the previous 10-group structure into the groups staff
// actually think in terms of (Farmers & Cooperatives, Farms & Mapping,
// Businesses & Trade, etc). Every `path`, `roles` and `permissionPrefixes`
// value below is carried over UNCHANGED from the prior navigation.ts —
// only grouping, labels and icons changed. Two destinations were
// explicitly renamed because their old labels were misleading about what
// they actually open:
//   - "Master Data" (/logistics, Batch Management & Traceability)
//     -> "Batches & Traceability"
//   - "LACRA Traceability" (/map, the national map view)
//     -> "National Farm Map"
//
// Destinations intentionally OMITTED from the menu below (no real route
// exists for them in App.tsx today — we don't invent empty destinations
// just to fill out a proposed menu):
//   - "Farmer Groups" (/farmers/groups) — no route registered.
//   - "Commodity Registry" (/commodities) — no route registered.
//   - "Audit Logs" (/audit) — no route registered.
//   - "Reference Data" (requested under Administration) — no matching
//     page/route exists anywhere in the app.
//   - A standalone "Reports & Analytics" group — once National Farm Map,
//     Risk Analysis and Satellite Analysis move to Farms & Mapping (where
//     staff actually expect them), there is no remaining dedicated
//     reporting screen to list; Dashboard itself is already the
//     platform's reporting/analytics landing page and has its own
//     top-level entry above.
// If/when real pages are built for any of the above, add them here with
// their actual `path` — do not add a placeholder path ahead of time.
export const navigationMenu: NavigationItem[] = [
    {
        label: 'Dashboard',
        path: '/',
        icon: LayoutDashboard
    },
    {
        label: 'Farmers & Cooperatives',
        icon: Users,
        children: [
            {
                label: 'Farmer Registry',
                path: '/farmers',
                icon: BookUser
            },
            {
                label: 'Cooperative Registry',
                path: '/admin/cooperatives',
                icon: Building2
            },
            {
                // Identity Verification queue — Unverified/Conflict farmers.
                // ADMIN + INSPECTOR can both view this list (inspectors use
                // their existing correction permissions to fix flagged
                // data/documents); only ADMIN sees the actual Verify/Flag
                // Conflict/Revert/Bulk action buttons on the page itself
                // (and the backend independently enforces ADMIN-only on
                // every write endpoint regardless of what the UI shows).
                label: 'Identity Verification',
                path: '/farmers/verification',
                icon: ShieldQuestion,
                roles: [UserRole.ADMIN, UserRole.INSPECTOR],
            }
        ]
    },
    {
        label: 'Farms & Mapping',
        icon: LandPlot,
        children: [
            {
                label: 'Farm Registry',
                path: '/farms',
                icon: LandPlot
            },
            {
                label: 'National Farm Map',
                path: '/map',
                icon: MapIcon
            },
            {
                label: 'Risk Analysis',
                path: '/risk-analysis',
                icon: ShieldCheck
            },
            {
                label: 'Satellite Analysis',
                path: '/satellite',
                icon: Satellite
            }
        ]
    },
    {
        label: 'Businesses & Trade',
        icon: Briefcase,
        children: [
            {
                label: 'Business Registry',
                path: '/admin/business',
                icon: Briefcase,
                permissionPrefixes: ['business']
            },
            {
                label: 'Batches & Traceability',
                path: '/logistics',
                icon: Truck
            },
            {
                label: 'Chain of Custody',
                path: '/custody',
                icon: Link2
            },
            {
                label: 'Export Operations',
                path: '/export',
                icon: Ship,
                permissionPrefixes: ['shipment']
            }
        ]
    },
    {
        label: 'Licensing & Permits',
        icon: FileBadge,
        children: [
            {
                // Umbrella for the per-department review queues the public
                // /apply wizard's applications move through (Commercial ->
                // DG -> Technical -> Inspector -> Billing -> Payment -> IT).
                // Each child is role-gated so a staff member only sees the
                // queue(s) relevant to their own department; ADMIN can see
                // every queue via the per-item role check already
                // supported by hasPermission(). Some also carry
                // permissionPrefixes to further narrow visibility for
                // accounts that have a specific Permission Group assigned.
                label: 'Applications & Review Queues',
                icon: FileCheck2,
                children: [
                    {
                        label: 'Commercial Review',
                        path: '/applications/commercial-queue',
                        roles: [UserRole.COMMERCIAL, UserRole.ADMIN],
                        permissionPrefixes: ['license.review', 'permit.review']
                    },
                    {
                        label: 'DG Approval',
                        path: '/applications/dg-queue',
                        roles: [UserRole.DG, UserRole.ADMIN],
                        permissionPrefixes: ['license.approve', 'permit.approve']
                    },
                    {
                        label: 'Technical Review',
                        path: '/applications/technical-queue',
                        roles: [UserRole.TECHNICAL, UserRole.ADMIN]
                    },
                    {
                        label: 'Inspector Assessment',
                        path: '/applications/inspection-queue',
                        roles: [UserRole.INSPECTOR, UserRole.ADMIN]
                    },
                    {
                        label: 'Billing Review',
                        path: '/applications/billing-queue',
                        roles: [UserRole.FINANCE, UserRole.ADMIN],
                        permissionPrefixes: ['license.issue', 'permit.issue']
                    },
                    {
                        label: 'Payment Verification',
                        path: '/applications/payment-queue',
                        roles: [UserRole.FINANCE, UserRole.ADMIN],
                        permissionPrefixes: ['license.issue', 'permit.issue']
                    }
                ]
            },
            {
                label: 'License Registry',
                path: '/licenses',
                icon: FileBadge,
                permissionPrefixes: ['license']
            },
            {
                label: 'Permit Management',
                path: '/permits',
                icon: Stamp,
                permissionPrefixes: ['permit']
            },
            {
                label: 'Certificate Issuance',
                path: '/applications/it-queue',
                icon: FileCheck2,
                roles: [UserRole.IT, UserRole.ADMIN]
            }
        ]
    },
    {
        label: 'Inspections & Enforcement',
        icon: ClipboardCheck,
        children: [
            {
                label: 'Inspection Management',
                path: '/inspections',
                icon: ClipboardCheck
            },
            {
                label: 'Quality Control',
                path: '/quality',
                icon: FlaskConical
            },
            {
                label: 'Enforcement Actions',
                path: '/admin/enforcement',
                icon: Gavel
            }
        ]
    },
    {
        label: 'Administration',
        icon: Settings,
        roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN], // Restricted
        children: [
            {
                label: 'Users',
                path: '/admin/users',
                icon: Users
            },
            {
                label: 'Account Approvals',
                path: '/admin/approvals',
                icon: UserCheck
            },
            {
                label: 'Roles & Permissions',
                path: '/admin/roles',
                icon: ShieldCheck
            },
            {
                label: 'CDA Import',
                path: '/admin/cooperatives/import',
                icon: UploadCloud,
                roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN]
            }
        ]
    }
];
