import {
    LayoutDashboard,
    Users,
    Sprout,
    Globe,
    ClipboardCheck,
    FileBadge,
    BarChart3,
    Settings,
    ShieldCheck,
    UserCog,
    Map as MapIcon,
    Truck,
    FileCheck2
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

export const navigationMenu: NavigationItem[] = [
    {
        label: 'Dashboard',
        path: '/',
        icon: LayoutDashboard // Level 1
    },
    {
        label: 'Farmer Management',
        icon: Users,
        children: [
            {
                label: 'Farmer Registry',
                path: '/farmers', // Level 2
            },
            {
                label: 'Farmer Groups',
                path: '/farmers/groups' // Placeholder
            }
        ]
    },
    {
        label: 'Commodity & Farm',
        icon: Sprout,
        children: [
            {
                label: 'Farm Registry',
                path: '/farms'
            },
            {
                label: 'Commodity Registry',
                path: '/commodities' // Placeholder
            },
            {
                label: 'Cooperative Registry (CDA)',
                path: '/admin/cooperatives'
            },
            {
                label: 'Import CDA Records',
                path: '/admin/cooperatives/import',
                roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN]
            }
        ]
    },
    {
        label: 'Marketing & Commercial',
        icon: Globe,
        children: [
            {
                label: 'Business Registry',
                path: '/admin/business',
                permissionPrefixes: ['business']
            },
            {
                label: 'Chain of Custody',
                path: '/custody'
            },
            {
                label: 'Export Operations',
                path: '/export',
                permissionPrefixes: ['shipment']
            }
        ]
    },
    {
        label: 'Inspectorate & QC',
        icon: ClipboardCheck,
        children: [
            {
                label: 'Inspection Management',
                path: '/inspections' // Placeholder
            },
            {
                label: 'Quality Control',
                path: '/quality' // Placeholder
            },
            {
                label: 'Enforcement Actions',
                path: '/admin/enforcement' // Updated from /admin/approvals
            }
        ]
    },
    {
        label: 'Permits & Licensing',
        icon: FileBadge,
        children: [
            {
                label: 'License Management',
                path: '/licenses',
                permissionPrefixes: ['license']
            },
            {
                label: 'Permit Management',
                path: '/permits',
                permissionPrefixes: ['permit']
            }
        ]
    },
    {
        // Review queues for the public /apply wizard's five application
        // categories (Local Buyer, Agency, Cooperative, Local/Foreign
        // Exporter) as they move through Commercial -> DG -> Technical ->
        // Inspector -> Billing -> Payment -> IT stages. Each child is
        // role-gated so a staff member only sees the queue(s) relevant to
        // their own department; ADMIN can see every queue via the
        // per-item role check already supported by hasPermission(). Some
        // also carry permissionPrefixes to further narrow visibility for
        // accounts that have a specific Permission Group assigned (see
        // Sidebar.tsx's hasPermission()).
        label: 'License Applications',
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
            },
            {
                label: 'Certificate Issuance',
                path: '/applications/it-queue',
                roles: [UserRole.IT, UserRole.ADMIN]
            }
        ]
    },
    {
        label: 'Reports & Analytics',
        icon: BarChart3,
        children: [
            {
                label: 'LACRA Traceability',
                path: '/map',
                icon: MapIcon
            },
            {
                label: 'Risk Reports',
                path: '/risk-analysis',
                icon: ShieldCheck
            },
            {
                label: 'Satellite Analysis',
                path: '/satellite'
            }
        ]
    },
    {
        label: 'User Management',
        icon: UserCog,
        roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN], // Restricted
        children: [
            {
                label: 'Users',
                path: '/admin/users'
            },
            {
                label: 'Pending Approvals',
                path: '/admin/approvals'
            },
            {
                label: 'Roles & Permissions',
                path: '/admin/roles'
            }
        ]
    },
    {
        label: 'System Admin',
        icon: Settings,
        roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN], // Restricted
        children: [
            {
                label: 'Master Data',
                path: '/logistics', // Mapped to logistics for now as it has batch data
                icon: Truck
            },
            {
                label: 'Audit Logs',
                path: '/audit' // Placeholder
            }
        ]
    }
];
