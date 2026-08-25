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
    Truck
} from 'lucide-react';
import { UserRole } from '../types';

export interface NavigationItem {
    label: string;
    path?: string;
    icon?: any;
    children?: NavigationItem[];
    roles?: UserRole[];
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
            }
        ]
    },
    {
        label: 'Marketing & Commercial',
        icon: Globe,
        children: [
            {
                label: 'Business Registry',
                path: '/admin/business'
            },
            {
                label: 'Chain of Custody',
                path: '/custody'
            },
            {
                label: 'Export Operations',
                path: '/export'
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
                path: '/licenses'
            },
            {
                label: 'Permit Management',
                path: '/permits'
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
