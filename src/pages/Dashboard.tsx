import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    UserPlus, MapPinned, FileCheck, AlertTriangle, Users2, Sprout, ArrowUpRight,
    Loader2, RefreshCw, Info, ShieldCheck, FileWarning, FileBadge, ClipboardCheck,
    ShieldAlert, Package, Ship, ShieldQuestion, Clock,
    UserPlus2, Stamp, FlaskConical,
} from 'lucide-react';
import {
    getDashboardStats, type DashboardStats, type DashboardFilterParams,
} from '../api/reports';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import AnimatedCounter from '../components/AnimatedCounter';
import { COUNTY_NAMES, getDistrictsForCounty } from '../data/liberiaCounties';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import SectionHeading from '../components/ui/SectionHeading';
import BarListRow from '../components/ui/BarListRow';
import { Filter, LayoutGrid, SlidersHorizontal, TrendingUp } from 'lucide-react';
import DashboardVisibilityMenu, { type VisibilityGroupDef } from '../components/dashboard/DashboardVisibilityMenu';
// Lazy-loaded: pulls the Needs Attention section (and its only-used-there
// API deps: farmerVerification, geometry, applications) out of the main
// bundle into its own chunk, fetched on demand when the Dashboard renders
// for a signed-in staff member. Keeps the main bundle under the PWA
// precache's 2 MiB limit without raising that limit — see
// NeedsAttentionSection.tsx for the component itself.
const NeedsAttentionSection = lazy(() => import('../components/dashboard/NeedsAttentionSection'));

import RegisterFarmer from './RegisterFarmer';

// Gray (Assessment Pending), Green (Assessed Low Risk/Valid Geometry),
// Amber (Needs Review), Red (High Risk). Assessment Pending is listed
// first and colored neutral gray (not a risk color) because it is NOT a
// risk result — it simply means no assessment has been completed yet.
// Keyed by `status` (not array index) so colors stay correct even after
// zero-value buckets are filtered out of the pie chart below.
const RISK_COLOR_MAP: Record<string, string> = {
    'Assessment Pending': '#9CA3AF',
    'Compliant': '#10B981',
    'Needs Review': '#F59E0B',
    'High Risk': '#EF4444',
};
const SHIPMENT_colors = {
    DRAFT: '#9CA3AF',
    VALIDATED: '#60A5FA',
    ISSUED: '#10B981',
    SHIPPED: '#3b82f6'
};

// Small info-tooltip so every stat's exact calculation rule is one hover
// away, per the "display calculation definitions through information
// tooltips" requirement — never silently assumed by the viewer.
const InfoTip: React.FC<{ text: string }> = ({ text }) => (
    <span className="relative inline-flex group/tip ml-1 align-middle">
        <Info className="h-3.5 w-3.5 text-gray-500 cursor-help" />
        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-56 rounded-lg bg-gray-900 text-white text-[11px] leading-snug px-2.5 py-1.5 opacity-0 group-hover/tip:opacity-100 transition-opacity z-20">
            {text}
        </span>
    </span>
);

// ---------------------------------------------------------------------
// Quick Actions — one action per task a signed-in user can actually
// perform right now, gated by role exactly like the Needs Attention
// queues and the sidebar (src/config/navigation.ts). An action only
// renders if `roles` includes the signed-in user's role; omitting `roles`
// means every authenticated staff member (non-Farmer) can see it.
// ---------------------------------------------------------------------
interface QuickAction {
    key: string;
    label: string;
    icon: React.ReactNode;
    path?: string;
    onClick?: (ctx: { setShowRegisterForm: (v: boolean) => void; showRegisterForm: boolean }) => void;
    roles?: UserRole[];
}
const QUICK_ACTIONS: QuickAction[] = [
    { key: 'register-farmer', label: 'Register Farmer', icon: <UserPlus2 className="h-4 w-4" />, onClick: ({ setShowRegisterForm, showRegisterForm }) => setShowRegisterForm(!showRegisterForm) },
    { key: 'add-farm', label: 'Add Farm', icon: <MapPinned className="h-4 w-4" />, path: '/farms/new' },
    { key: 'commercial-queue', label: 'Review Applications', icon: <FileCheck className="h-4 w-4" />, path: '/applications/commercial-queue', roles: [UserRole.COMMERCIAL, UserRole.ADMIN] },
    { key: 'dg-queue', label: 'DG Approvals', icon: <Stamp className="h-4 w-4" />, path: '/applications/dg-queue', roles: [UserRole.DG, UserRole.ADMIN] },
    { key: 'technical-queue', label: 'Technical Reviews', icon: <ClipboardCheck className="h-4 w-4" />, path: '/applications/technical-queue', roles: [UserRole.TECHNICAL, UserRole.ADMIN] },
    { key: 'inspection-queue', label: 'Inspector Assessments', icon: <ShieldAlert className="h-4 w-4" />, path: '/applications/inspection-queue', roles: [UserRole.INSPECTOR, UserRole.ADMIN] },
    { key: 'billing-queue', label: 'Billing Review', icon: <FileBadge className="h-4 w-4" />, path: '/applications/billing-queue', roles: [UserRole.FINANCE, UserRole.ADMIN] },
    { key: 'payment-queue', label: 'Payment Verification', icon: <FileBadge className="h-4 w-4" />, path: '/applications/payment-queue', roles: [UserRole.FINANCE, UserRole.ADMIN] },
    { key: 'it-queue', label: 'Certificate Issuance', icon: <FileCheck className="h-4 w-4" />, path: '/applications/it-queue', roles: [UserRole.IT, UserRole.ADMIN] },
    { key: 'identity-verification', label: 'Identity Verification', icon: <ShieldQuestion className="h-4 w-4" />, path: '/farmers/verification', roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSPECTOR] },
    { key: 'data-correction', label: 'Data Correction Queue', icon: <FileWarning className="h-4 w-4" />, path: '/farms/data-correction-queue', roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSPECTOR] },
    { key: 'quality', label: 'Quality Control', icon: <FlaskConical className="h-4 w-4" />, path: '/quality' },
    { key: 'inspections', label: 'Schedule Inspection', icon: <ClipboardCheck className="h-4 w-4" />, path: '/inspections' },
];

// ---------------------------------------------------------------------
// Section visibility — lets a signed-in user hide dashboard content
// blocks they don't personally need, independent of role/permissions
// (which already control QUICK_ACTIONS/APPLICATION_QUEUES visibility and
// must never be affected by this). Persisted per-browser in localStorage
// so a chosen layout survives a refresh; purely a display preference,
// never sent to the backend and never alters what data is fetched.
// ---------------------------------------------------------------------
const DASHBOARD_HIDDEN_SECTIONS_KEY = 'dashboard_hidden_sections_v1';

const VISIBILITY_GROUPS: VisibilityGroupDef[] = [
    { group: 'Filters & Actions', items: [
        { key: 'filters', label: 'Filters Bar' },
        { key: 'quickActions', label: 'Quick Actions' },
        { key: 'needsAttention', label: 'Needs Attention' },
    ] },
    { group: 'Farmer & Farm Overview', items: [
        { key: 'overview', label: 'Overview Stat Cards' },
        { key: 'breakdownGender', label: 'Farmers by Gender' },
    ] },
    { group: 'Geometry & Compliance', items: [
        { key: 'geometry', label: 'Geometry Stat Cards' },
        { key: 'chartRisk', label: 'Farm Risk Distribution' },
    ] },
    { group: 'Licensing & Traceability', items: [
        { key: 'licensing', label: 'Licensing Stat Cards' },
        { key: 'chartShipment', label: 'Shipment Status' },
    ] },
    { group: 'Farms & Trends', items: [
        { key: 'breakdownCounty', label: 'Farms by County' },
        { key: 'breakdownCommodity', label: 'Farms by Commodity' },
        { key: 'chartGrowth', label: 'Farmer Registration Growth' },
    ] },
];

function readHiddenSections(): Set<string> {
    try {
        const stored = localStorage.getItem(DASHBOARD_HIDDEN_SECTIONS_KEY);
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
        return new Set();
    }
}

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    const [hiddenSections, setHiddenSections] = useState<Set<string>>(() => readHiddenSections());
    const isSectionVisible = (key: string) => !hiddenSections.has(key);
    const toggleSection = (key: string) => {
        setHiddenSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            try { localStorage.setItem(DASHBOARD_HIDDEN_SECTIONS_KEY, JSON.stringify([...next])); } catch { /* ignore storage errors */ }
            return next;
        });
    };
    const resetSections = () => {
        setHiddenSections(new Set());
        try { localStorage.removeItem(DASHBOARD_HIDDEN_SECTIONS_KEY); } catch { /* ignore storage errors */ }
    };

    // Filters — reflected in the URL so a filtered dashboard view is
    // shareable/bookmarkable and survives a refresh. Every indicator on
    // the page is re-fetched from the SAME filtered backend query, so the
    // numbers shown always match what a drill-down (which passes these
    // same params on to FarmersList/FarmsList/etc.) would show.
    const [searchParams, setSearchParams] = useSearchParams();
    const filters: DashboardFilterParams = {
        dateFrom: searchParams.get('dateFrom') || undefined,
        dateTo: searchParams.get('dateTo') || undefined,
        county: searchParams.get('county') || undefined,
        district: searchParams.get('district') || undefined,
        commodity: searchParams.get('commodity') || undefined,
        gender: searchParams.get('gender') || undefined,
        complianceStatus: (searchParams.get('complianceStatus') as DashboardFilterParams['complianceStatus']) || undefined,
        verificationStatus: (searchParams.get('verificationStatus') as DashboardFilterParams['verificationStatus']) || undefined,
    };
    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    const updateFilter = (key: keyof DashboardFilterParams, value: string) => {
        const next = new URLSearchParams(searchParams);
        if (!value) next.delete(key);
        else next.set(key, value);
        setSearchParams(next);
    };

    const fetchAll = async () => {
        try {
            setLoading(true);
            setError(null);
            const statsRes = await getDashboardStats(filters);
            if (statsRes.data.status) {
                setStats(statsRes.data.data);
            } else {
                setError(statsRes.data.message || 'Failed to load dashboard statistics.');
            }
        } catch (err: unknown) {
            console.error("Error fetching dashboard stats", err);
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 401) {
                setError('Your session has expired. Please log in again.');
            } else {
                setError('Failed to load dashboard statistics. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === UserRole.FARMER) return; // Skip fetching admin stats for farmers
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, searchParams.toString()]);

    // Drill-down helper: navigates to a target route carrying the same
    // filters currently applied on the dashboard PLUS any extra params
    // specific to the clicked stat/segment (e.g. gender=Female).
    const drillDown = (path: string, extra: Record<string, string | undefined> = {}) => {
        const params = new URLSearchParams();
        Object.entries({ ...filters, ...extra }).forEach(([k, v]) => {
            if (v) params.set(k, v);
        });
        const qs = params.toString();
        navigate(`${path}${qs ? `?${qs}` : ''}`);
    };

    if (user?.role === UserRole.FARMER) {
        return (
            <div className="space-y-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Farmer Dashboard</h2>
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <p>Welcome back, {user.name}!</p>
                    <div className="mt-4">
                        <Link to="/farmers/profile" className="text-green-600 hover:text-green-800 font-medium">View My Profile</Link>
                    </div>
                </div>
            </div>
        );
    }

    const districtOptions = filters.county ? getDistrictsForCounty(filters.county) : [];

    // ---- Loading / error states (never show "0" while loading) ----
    // The PageHeader is rendered here too (not just in the fully-loaded
    // return below) so the page title/breadcrumb is never missing while
    // data is loading or has failed to load.
    if (loading && !stats) {
        return (
            <div className="space-y-8">
                <PageHeader
                    breadcrumb={[{ label: 'Dashboard' }]}
                    title="Dashboard"
                />
                <div className="flex items-center gap-3 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading records…</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
                                    <div className="h-6 w-16 bg-gray-200 rounded" />
                                </div>
                                <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div className="space-y-8">
                <PageHeader
                    breadcrumb={[{ label: 'Dashboard' }]}
                    title="Dashboard"
                />
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                    <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
                        <AlertTriangle className="h-7 w-7 text-red-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-900">{error}</p>
                    <button
                        onClick={fetchAll}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                    >
                        <RefreshCw className="h-4 w-4" /> Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!stats) return null;

    // Four mutually-exclusive, exhaustive buckets that always sum to
    // totalFarms. "Assessment Pending" is listed first since it is not a
    // risk RESULT — it means no assessment has been completed yet.
    // The pie itself only renders buckets with a non-zero count: Recharts'
    // paddingAngle reserves a visible gap for every slice regardless of
    // value, so when (as in typical early-stage data) 3 of the 4 buckets
    // are 0, the ring showed stray gaps that looked like a rendering
    // glitch rather than "all farms fall in one bucket". riskDataAll (with
    // zeros included) still drives a separate always-complete 4-item
    // legend below, so every category name/color stays explained even
    // when its slice is hidden.
    const riskDataAll = [
        { name: 'Assessment Pending', value: stats.assessmentPendingFarms, status: 'Assessment Pending' },
        { name: 'Assessed Low Risk, Valid Geometry', value: stats.compliantFarms, status: 'Compliant' },
        { name: 'Needs Review', value: stats.mediumRiskFarms, status: 'Needs Review' },
        { name: 'High Risk', value: stats.highRiskFarms, status: 'High Risk' },
    ];
    const riskData = riskDataAll.filter((r) => r.value > 0);

    const shipmentData = stats.shipmentStats ? [
        { name: 'Draft', count: stats.shipmentStats.DRAFT, fill: SHIPMENT_colors.DRAFT },
        { name: 'Validated', count: stats.shipmentStats.VALIDATED, fill: SHIPMENT_colors.VALIDATED },
        { name: 'Issued', count: stats.shipmentStats.ISSUED, fill: SHIPMENT_colors.ISSUED },
        { name: 'Shipped', count: stats.shipmentStats.SHIPPED, fill: SHIPMENT_colors.SHIPPED },
    ] : [];

    return (
        <div className="space-y-8">
            <PageHeader
                breadcrumb={[{ label: 'Dashboard' }]}
                title="Dashboard"
                actions={
                    <>
                        <DashboardVisibilityMenu
                            groups={VISIBILITY_GROUPS}
                            isVisible={isSectionVisible}
                            onToggle={toggleSection}
                            onReset={resetSections}
                        />
                        <button
                            onClick={fetchAll}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-green hover:text-brand-green-hover disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded px-2 py-1.5 border border-brand-green/30"
                        >
                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Refresh
                        </button>
                    </>
                }
            />

            {/* Filters — hiding this bar only hides the UI control; any
                filters already applied via the URL (and thus still driving
                every stat/drill-down below) remain in effect. A small
                "Filters hidden" reminder with a one-click way to bring it
                back is shown instead whenever that's the case, so an
                active filter is never silently invisible. */}
            {isSectionVisible('filters') ? (
            <div className={`bg-white rounded-xl border p-4 transition-colors ${activeFilterCount > 0 ? 'border-brand-green/30 ring-1 ring-brand-green/10' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                    <SlidersHorizontal className="h-4 w-4 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Filters</span>
                    {activeFilterCount > 0 && (
                        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-brand-green text-white text-[11px] font-bold">
                            {activeFilterCount}
                        </span>
                    )}
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-green ml-1" />}
                    {activeFilterCount > 0 && (
                        <button onClick={() => setSearchParams({})} className="ml-auto text-xs font-medium text-gray-500 hover:text-red-600 inline-flex items-center gap-1">
                            <Filter className="h-3 w-3" /> Clear filters
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Date From</label>
                        <input type="date" value={filters.dateFrom || ''} onChange={(e) => updateFilter('dateFrom', e.target.value)} className="w-full border border-gray-300 rounded-lg py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Date To</label>
                        <input type="date" value={filters.dateTo || ''} onChange={(e) => updateFilter('dateTo', e.target.value)} className="w-full border border-gray-300 rounded-lg py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">County</label>
                        <select value={filters.county || ''} onChange={(e) => { updateFilter('county', e.target.value); updateFilter('district', ''); }} className="w-full border border-gray-300 rounded-lg py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green">
                            <option value="">All Counties</option>
                            {COUNTY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">District</label>
                        <select value={filters.district || ''} onChange={(e) => updateFilter('district', e.target.value)} disabled={!filters.county} className="w-full border border-gray-300 rounded-lg py-1.5 px-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green">
                            <option value="">All Districts</option>
                            {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Commodity</label>
                        <input type="text" placeholder="e.g. Cocoa" value={filters.commodity || ''} onChange={(e) => updateFilter('commodity', e.target.value)} className="w-full border border-gray-300 rounded-lg py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Gender</label>
                        <select value={filters.gender || ''} onChange={(e) => updateFilter('gender', e.target.value)} className="w-full border border-gray-300 rounded-lg py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green">
                            <option value="">All</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Compliance Status</label>
                        <select value={filters.complianceStatus || ''} onChange={(e) => updateFilter('complianceStatus', e.target.value)} className="w-full border border-gray-300 rounded-lg py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green">
                            <option value="">All</option>
                            <option value="Assessment Pending">Assessment Pending</option>
                            <option value="Compliant">Assessed Low Risk, Valid Geometry</option>
                            <option value="Needs Review">Needs Review</option>
                            <option value="High Risk">High Risk</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Verification Status</label>
                        <select value={filters.verificationStatus || ''} onChange={(e) => updateFilter('verificationStatus', e.target.value)} className="w-full border border-gray-300 rounded-lg py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green">
                            <option value="">All</option>
                            <option value="Verified">Verified</option>
                            <option value="Unverified">Unverified</option>
                            <option value="Conflict">Conflict</option>
                        </select>
                    </div>
                </div>
            </div>
            ) : activeFilterCount > 0 ? (
                <div className="flex items-center justify-between gap-3 bg-brand-green/5 border border-brand-green/20 rounded-xl px-4 py-2.5 text-sm">
                    <span className="flex items-center gap-2 text-gray-700">
                        <Filter className="h-3.5 w-3.5 text-brand-green" />
                        <b className="text-brand-green">{activeFilterCount}</b> filter{activeFilterCount === 1 ? '' : 's'} active — the Filters bar is hidden, but these are still applied below.
                    </span>
                    <button onClick={() => toggleSection('filters')} className="text-xs font-semibold text-brand-green hover:text-brand-green-hover flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded px-1">
                        Show Filters
                    </button>
                </div>
            ) : null}

            {/* NOTE: a one-line "summary row" used to live here, repeating
                Farmers/Farms/Verified Farmers/Assessment Coverage/Compliance
                Rate/High Risk Farms as plain numbers. It was removed because
                every one of those values is already shown as its own
                StatCard (with a tooltip explaining the exact calculation and
                a click-through to drill in) in the "Farmer & Farm Overview"
                and "Geometry & Compliance" sections just below — showing the
                same number twice in two different styles within a few
                hundred pixels of each other read as cluttered/duplicated
                rather than as a helpful "at a glance" summary. */}

            {/* Quick Actions — only the tasks the signed-in user's role can
                actually perform. */}
            {(() => {
                if (!isSectionVisible('quickActions')) return null;
                const visibleActions = QUICK_ACTIONS.filter((a) => !a.roles || (user && a.roles.includes(user.role as UserRole)));
                return visibleActions.length > 0 ? (
                    <div>
                        <SectionHeading icon={<LayoutGrid />}>Quick Actions</SectionHeading>
                        <div className="flex flex-wrap gap-2.5">
                            {visibleActions.map((action) => (
                                <button
                                    key={action.key}
                                    onClick={() => action.path ? navigate(action.path) : action.onClick?.({ setShowRegisterForm, showRegisterForm })}
                                    className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-brand-green hover:bg-brand-green/5 hover:text-brand-green transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                                >
                                    <span className="text-gray-400 group-hover:text-brand-green transition-colors">{action.icon}</span>
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null;
            })()}

            {/* Needs Attention — role-based worklist, independent of the
                filters above (always shows the signed-in user's real,
                current outstanding work, not a filtered view of it).
                Lazy-loaded: see NeedsAttentionSection.tsx. */}
            {user && isSectionVisible('needsAttention') && (
                <Suspense fallback={
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Checking for outstanding work…
                    </div>
                }>
                    <NeedsAttentionSection user={{ role: user.role, permissions: user.permissions }} />
                </Suspense>
            )}

            {/* 1. Farmer & Farm Overview */}
            {isSectionVisible('overview') && (
            <div>
                <SectionHeading icon={<Users2 />}>Farmer &amp; Farm Overview</SectionHeading>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard
                        icon={<UserPlus className="h-5 w-5" />}
                        tone="blue"
                        title="Registered Farmers"
                        tooltip="Total number of Farmer records matching the current filters (Farmer Registry count)."
                        value={stats.totalFarmers}
                        onClick={() => setShowRegisterForm(!showRegisterForm)}
                        linkText={showRegisterForm ? "Hide Form" : "Add New"}
                    />
                    <StatCard
                        icon={<ShieldCheck className="h-5 w-5" />}
                        tone="green"
                        title="Verified Farmers"
                        tooltip={`Farmers whose identityStatus = 'Verified'. ${stats.verifiedFarmerRate}% of registered farmers. Kept separate from geometry/compliance rates.`}
                        value={stats.verifiedFarmers}
                        suffix={` (${stats.verifiedFarmerRate}%)`}
                        ratePercent={stats.verifiedFarmerRate}
                        onClick={() => drillDown('/farmers', { verificationStatus: 'Verified' })}
                        linkText="View Verified"
                    />
                    <StatCard
                        icon={<MapPinned className="h-5 w-5" />}
                        tone="indigo"
                        title="Farms Mapped"
                        tooltip="Total number of Farm records matching the current filters (Farm Registry count)."
                        value={stats.totalFarms}
                        onClick={() => navigate('/map')}
                        linkText="View Map"
                    />
                    <StatCard
                        icon={<Sprout className="h-5 w-5" />}
                        tone="green"
                        title="Total Mapped Hectares"
                        tooltip="Sum of Farm.totalAreaHa (declared area) across every farm matching the current filters."
                        value={stats.totalMappedHectares}
                        suffix=" ha"
                        onClick={() => drillDown('/farms')}
                        linkText="View Farms"
                    />
                </div>
            </div>
            )}

            {/* 2. Geometry & Compliance — 6 cards (down from 8). The previous
                8-card version actually showed only 6 distinct pieces of
                information: "Assessed Low Risk, Valid Geometry" (%) and
                "Compliant Farms" (count) were the SAME compliantFarms number
                shown twice in different formats, and "Assessment Pending"
                (count) / "Assessment Coverage" (%) are exact mathematical
                inverses of each other (coverage = (total - pending) / total)
                that even pointed at the identical drill-down destination.
                Each pair is now ONE card showing count + rate together,
                matching the "Farms with Valid Polygons" pattern below. 6
                cards fills a grid-cols-3 exactly (2 full rows). */}
            {isSectionVisible('geometry') && (
            <div>
                <SectionHeading icon={<ShieldCheck />}>Geometry &amp; Compliance</SectionHeading>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                        icon={<ShieldCheck className="h-5 w-5" />}
                        tone="green"
                        title="Farms with Valid Polygons"
                        tooltip={`geometryStatus = 'Valid' (passed all 12 GPS/polygon validation rules). ${stats.geometryValidRate}% of mapped farms. Kept separate from complianceRate.`}
                        value={stats.farmsWithValidPolygons}
                        suffix={` (${stats.geometryValidRate}%)`}
                        ratePercent={stats.geometryValidRate}
                        onClick={() => drillDown('/farms', { geometryStatus: 'Valid' })}
                        linkText="View Farms"
                    />
                    <StatCard
                        icon={<FileWarning className="h-5 w-5" />}
                        tone="amber"
                        title="Farms Needing Correction"
                        tooltip="geometryStatus IN (Invalid, Needs Review, Missing) — blocked from compliance certification until corrected."
                        value={stats.farmsNeedingCorrection}
                        onClick={() => navigate('/farms/data-correction-queue')}
                        linkText="Open Queue"
                    />
                    <StatCard
                        icon={<FileCheck className="h-5 w-5" />}
                        tone="green"
                        title="Assessed Low Risk, Valid Geometry"
                        tooltip={`${stats.compliantFarms} ÷ ${stats.totalFarms} ALL REGISTERED FARMS (${stats.complianceDenominatorLabel}) = ${stats.complianceRate}%. A farm is counted here ONLY if it has (1) a COMPLETED risk assessment, (2) a Low risk result, AND (3) a Valid GPS boundary. Farms with no completed assessment are EXCLUDED here and counted separately as Assessment Pending — see that card. Click for the full calculation.`}
                        value={stats.compliantFarms}
                        suffix={` (${stats.complianceRate}%)`}
                        ratePercent={stats.complianceRate}
                        onClick={() => drillDown('/risk-analysis', { complianceDetails: '1' })}
                        linkText="View Calculation"
                    />
                    <StatCard
                        icon={<Clock className="h-5 w-5" />}
                        tone="gray"
                        title="Assessment Pending"
                        tooltip={`lastRiskAssessmentDate IS NULL — this farm has NEVER completed a risk assessment. ${stats.assessmentPendingFarms} ÷ ${stats.totalFarms} farms (${(100 - stats.assessmentCoverageRate).toFixed(1)}%) are still pending — i.e. ${stats.assessmentCoverageRate}% assessment coverage. NOT a risk result, and NEVER counted as Compliant even if its default riskLevel happens to read 'Low'.`}
                        value={stats.assessmentPendingFarms}
                        suffix={` (${(100 - stats.assessmentCoverageRate).toFixed(1)}%)`}
                        onClick={() => drillDown('/farms', { complianceStatus: 'Assessment Pending' })}
                        linkText="View Farms"
                    />
                    <StatCard
                        icon={<AlertTriangle className="h-5 w-5" />}
                        tone="red"
                        title="High Risk Farms"
                        tooltip="A COMPLETED assessment with Farm.riskLevel = 'High' (from the most recent Whisp/deforestation risk assessment)."
                        value={stats.highRiskFarms}
                        onClick={() => drillDown('/risk-analysis', { riskLevel: 'High' })}
                        linkText="View Reasons"
                    />
                    <StatCard
                        icon={<AlertTriangle className="h-5 w-5" />}
                        tone="amber"
                        title="Medium-Risk Farms"
                        tooltip="A COMPLETED assessment with riskLevel = 'Medium', OR riskLevel = 'Low' but geometryStatus is not yet 'Valid'."
                        value={stats.mediumRiskFarms}
                        onClick={() => drillDown('/farms', { complianceStatus: 'Needs Review' })}
                        linkText="View Farms"
                    />
                </div>
            </div>
            )}

            {/* 3. Farmers by Gender / Farms by County / Farms by Commodity —
                each of the 3 breakdown cards is independently toggleable, so
                the section itself only disappears when ALL THREE are
                hidden; otherwise the grid simply shows the remaining ones. */}
            {(isSectionVisible('breakdownGender') || isSectionVisible('breakdownCounty') || isSectionVisible('breakdownCommodity')) && (
            <div>
                <SectionHeading icon={<TrendingUp />}>Breakdowns</SectionHeading>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {isSectionVisible('breakdownGender') && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0"><Users2 className="h-4 w-4" /></span>
                            Farmers by Gender
                        </h3>
                        <div className="space-y-1.5">
                            {(() => {
                                const entries = Object.entries(stats.genderBreakdown);
                                const max = Math.max(1, ...entries.map(([, c]) => c));
                                const GENDER_COLORS: Record<string, string> = {
                                    Male: 'bg-blue-400/25', Female: 'bg-pink-400/25', Other: 'bg-purple-400/25', Unspecified: 'bg-gray-300/40',
                                };
                                return entries.map(([gender, count]) => (
                                    <BarListRow
                                        key={gender}
                                        label={gender}
                                        count={count}
                                        maxCount={max}
                                        colorClassName={GENDER_COLORS[gender] || 'bg-brand-green/15'}
                                        onClick={() => drillDown('/farmers', { gender: gender === 'Unspecified' ? undefined : gender })}
                                    />
                                ));
                            })()}
                        </div>
                        {stats.genderBreakdown.Unspecified > 0 && (
                            <p className="mt-3 text-[11px] text-gray-500 leading-snug border-t border-gray-100 pt-3">
                                <b className="text-gray-700">{stats.genderBreakdown.Unspecified}</b> farmer{stats.genderBreakdown.Unspecified === 1 ? '' : 's'} {stats.genderBreakdown.Unspecified === 1 ? 'has' : 'have'} no gender recorded ("Unspecified"). The Male and Female totals above do NOT represent all registered farmers — they exclude anyone with missing gender data.
                            </p>
                        )}
                    </div>
                    )}

                    {isSectionVisible('breakdownCounty') && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0"><MapPinned className="h-4 w-4" /></span>
                            Farms by County
                        </h3>
                        {stats.farmsByCounty.length === 0 ? (
                            <EmptyState title="No farm/county data yet" />
                        ) : (
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                {(() => {
                                    const max = Math.max(1, ...stats.farmsByCounty.map((r) => r.count));
                                    return stats.farmsByCounty.map((row) => (
                                        <BarListRow
                                            key={row.county}
                                            label={row.county}
                                            count={row.count}
                                            maxCount={max}
                                            colorClassName="bg-blue-400/20"
                                            onClick={() => drillDown('/farms', { county: row.county === 'Unspecified' ? undefined : row.county })}
                                        />
                                    ));
                                })()}
                            </div>
                        )}
                    </div>
                    )}

                    {isSectionVisible('breakdownCommodity') && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex-shrink-0"><Sprout className="h-4 w-4" /></span>
                            Farms by Commodity
                        </h3>
                        {stats.farmsByCommodity.length === 0 ? (
                            <EmptyState title="No farms with commodity data yet" />
                        ) : (
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                {(() => {
                                    const max = Math.max(1, ...stats.farmsByCommodity.map((r) => r.count));
                                    return stats.farmsByCommodity.map((row) => (
                                        <BarListRow
                                            key={row.commodity}
                                            label={row.commodity}
                                            count={row.count}
                                            maxCount={max}
                                            colorClassName="bg-emerald-400/20"
                                            onClick={() => drillDown('/farms', { commodity: row.commodity })}
                                        />
                                    ));
                                })()}
                            </div>
                        )}
                    </div>
                    )}
                </div>
            </div>
            )}

            {/* 4. Licensing, Inspectorate, Traceability — 6 cards total in
                ONE grid-cols-3 (2 full rows) so nothing is left dangling
                (previously 4 cards in a grid-cols-4 row followed by a
                separate 2-card grid-cols-2 row, which left 2 empty slots
                at the end of the first row). */}
            {isSectionVisible('licensing') && (
            <div>
                <SectionHeading icon={<FileBadge />}>Licensing, Inspectorate &amp; Traceability</SectionHeading>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                        icon={<FileBadge className="h-5 w-5" />}
                        tone="blue"
                        title="Active Licenses"
                        tooltip={`status IN (LICENSE_ISSUED, ACTIVE) AND (validTo is null or in the future). Expiring within ${stats.expiringWindowDays} days: ${stats.expiringLicenses}.`}
                        value={stats.activeLicenses}
                        onClick={() => navigate('/licenses')}
                        linkText={`${stats.expiringLicenses} expiring soon`}
                    />
                    <StatCard
                        icon={<FileBadge className="h-5 w-5" />}
                        tone="blue"
                        title="Active Permits"
                        tooltip={`status = PERMIT_ISSUED AND (validTo is null or in the future). Expiring within ${stats.expiringWindowDays} days: ${stats.expiringPermits}.`}
                        value={stats.activePermits}
                        onClick={() => navigate('/permits')}
                        linkText={`${stats.expiringPermits} expiring soon`}
                    />
                    <StatCard
                        icon={<ClipboardCheck className="h-5 w-5" />}
                        tone="indigo"
                        title="Active Inspections"
                        tooltip="Inspection.status IN (SCHEDULED, IN_PROGRESS)."
                        value={stats.activeInspections}
                        onClick={() => navigate('/inspections')}
                        linkText="View Inspections"
                    />
                    <StatCard
                        icon={<ShieldAlert className="h-5 w-5" />}
                        tone="amber"
                        title="Pending Quality Tests"
                        tooltip="QualityControl.result = 'PENDING'."
                        value={stats.pendingQualityTests}
                        onClick={() => navigate('/quality')}
                        linkText="View Quality"
                    />
                    <StatCard
                        icon={<Package className="h-5 w-5" />}
                        tone="green"
                        title="Traceable Batches"
                        tooltip={`Batches with a non-null farm link (attributable to a specific source). ${stats.traceableBatches} of ${stats.totalBatches} total batches.`}
                        value={stats.traceableBatches}
                        suffix={` / ${stats.totalBatches}`}
                        ratePercent={stats.totalBatches > 0 ? (stats.traceableBatches / stats.totalBatches) * 100 : undefined}
                        onClick={() => navigate('/logistics')}
                        linkText="View Batches"
                    />
                    <StatCard
                        icon={<Ship className="h-5 w-5" />}
                        tone="indigo"
                        title="Active Shipments"
                        tooltip="Shipment.status IN (VALIDATED, ISSUED, SHIPPED) — i.e. anything that has left DRAFT."
                        value={stats.activeShipments}
                        onClick={() => navigate('/export')}
                        linkText="View Shipments"
                    />
                </div>
            </div>
            )}

            {/* Register Farmer Section */}
            {showRegisterForm && (
                <div className="bg-white border border-brand-green/20 rounded-xl p-6 shadow-card">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <UserPlus2 className="h-5 w-5 text-brand-green" /> New Farmer Registration
                        </h2>
                        <button onClick={() => setShowRegisterForm(false)} className="text-sm font-medium text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded px-2 py-1">
                            Close
                        </button>
                    </div>
                    <RegisterFarmer />
                </div>
            )}

            {/* 5. Analytical Charts — each of the 3 charts is independently
                toggleable, same pattern as Breakdowns above. */}
            {(isSectionVisible('chartGrowth') || isSectionVisible('chartRisk') || isSectionVisible('chartShipment')) && (
            <div>
                <SectionHeading icon={<TrendingUp />}>Analytics &amp; Trends</SectionHeading>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Farmer Growth Trend */}
                    {isSectionVisible('chartGrowth') && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Farmer Registration Growth</h3>
                        <p className="text-xs text-gray-500 mb-4">New farmer registrations per month, last 6 calendar months. Unit: farmers/month.</p>
                        {stats.registrationTrend.every((r) => r.count === 0) ? (
                            <EmptyState title="No farmer registrations in the last 6 months" description="New registrations will appear here as they come in." />
                        ) : (
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.registrationTrend}>
                                        <defs>
                                            <linearGradient id="colorFarmers" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" />
                                        <YAxis allowDecimals={false} label={{ value: 'Farmers', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6b7280' } }} />
                                        <Tooltip formatter={(value?: number) => [`${value ?? 0} farmer${value === 1 ? '' : 's'}`, 'Registered']} />
                                        <Area type="monotone" dataKey="count" name="Farmers registered" stroke="#10B981" fillOpacity={1} fill="url(#colorFarmers)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                    )}

                    {/* Risk Distribution Pie — every segment clickable */}
                    {isSectionVisible('chartRisk') && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Farm Risk Distribution <span className="text-xs text-gray-500 font-normal">(click a segment)</span></h3>
                        <p className="text-xs text-gray-500 mb-4">All {stats.totalFarms} registered farms, grouped into 4 mutually-exclusive assessment/risk buckets. Unit: farms.</p>
                        {stats.totalFarms === 0 ? (
                            <EmptyState title="No farms registered yet" description="Risk distribution will appear here once farms are added." />
                        ) : (
                            <>
                                <div className="h-56 flex items-center justify-center relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={riskData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={riskData.length > 1 ? 5 : 0}
                                                dataKey="value"
                                                onClick={(entry: { status?: DashboardFilterParams['complianceStatus'] }) => drillDown('/farms', { complianceStatus: entry.status })}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {riskData.map((entry) => (
                                                    <Cell key={entry.status} fill={RISK_COLOR_MAP[entry.status]} stroke="none" />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value: number | undefined, _name: string | undefined, entry: { payload?: { name?: string } }) => [`${value ?? 0} farms`, entry?.payload?.name]} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    {/* Center label — without this the ring (especially when
                                        every farm falls in a single bucket, rendering as one
                                        solid-colored circle with no visible segmentation) reads
                                        as a blank/broken placeholder rather than a chart. */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-2xl font-bold text-gray-900 leading-none">{stats.totalFarms}</span>
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Total Farms</span>
                                    </div>
                                </div>
                                {/* Custom legend built from ALL 4 buckets (not just the
                                    ones with a non-zero slice), so every category stays
                                    labeled/explained even when its count is 0 and it has
                                    no visible slice in the ring above. Pill-shaped chips
                                    (not bare text + dot) give each category a tappable,
                                    visually-bounded target consistent with Badge usage
                                    elsewhere in the app. */}
                                <div className="flex flex-wrap justify-center gap-2 mt-3">
                                    {riskDataAll.map((entry) => {
                                        const active = entry.value > 0;
                                        return (
                                            <button
                                                key={entry.status}
                                                onClick={() => drillDown('/farms', { complianceStatus: entry.status as DashboardFilterParams['complianceStatus'] })}
                                                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${active ? 'hover:bg-gray-50' : 'opacity-60'}`}
                                                style={{
                                                    color: RISK_COLOR_MAP[entry.status],
                                                    borderColor: `${RISK_COLOR_MAP[entry.status]}40`,
                                                    backgroundColor: `${RISK_COLOR_MAP[entry.status]}0D`,
                                                }}
                                            >
                                                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: RISK_COLOR_MAP[entry.status] }} />
                                                {entry.name} ({entry.value})
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                    )}

                    {/* Shipment Status Bar — all 4 statuses now shown */}
                    {isSectionVisible('chartShipment') && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200 lg:col-span-2">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Shipment Status</h3>
                        <p className="text-xs text-gray-500 mb-4">All shipments by current pipeline stage (Draft → Validated → Issued → Shipped). Unit: shipments.</p>
                        {shipmentData.every((s) => s.count === 0) ? (
                            <EmptyState title="No shipments yet" description="Shipment activity will appear here once export shipments are created." />
                        ) : (
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={shipmentData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" allowDecimals={false} label={{ value: 'Shipments', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#6b7280' } }} />
                                        <YAxis dataKey="name" type="category" width={100} />
                                        <Tooltip cursor={{ fill: 'transparent' }} formatter={(value?: number) => [`${value ?? 0} shipments`, 'Count']} />
                                        <Bar dataKey="count" name="Shipments" barSize={20} onClick={() => navigate('/export')} style={{ cursor: 'pointer' }}>
                                            {shipmentData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                    )}
                </div>
            </div>
            )}

            {/* NOTE: a "GPS Mapping Coverage" footer box used to live here,
                sourced from the legacy /reports/farm-mapping-stats endpoint.
                It was removed because farmsWithPolygon/farmsWithPointOnly
                are the exact same geometryStatus counts already shown as
                "Farms with Valid Polygons" / "Farms Needing Correction" in
                the Geometry & Compliance section above — a third copy of
                the same two numbers. The rest of that endpoint's payload
                (cropBreakdown) was not used anywhere on this page either
                ("Farms by Commodity" in Breakdowns above is sourced from
                the main dashboard-stats endpoint instead), so the whole
                getFarmMappingStats() call was removed as dead weight. */}
        </div>
    );
};

// ---------------------------------------------------------------------
// StatCard tone system — each card's icon chip and optional rate bar use a
// semantic color (never purely decorative): green = positive/healthy
// metric, blue = neutral count, amber = needs attention / caution,
// red = critical risk, gray = neutral/not-yet-assessed, indigo = neutral
// secondary metric. Replaces the previous version where nearly every card
// used an identical solid-green icon block regardless of what it meant
// (e.g. "Medium-Risk Farms" was rendered with the same green as "Verified
// Farmers"), which read as an unstyled/undifferentiated wall of cards.
// Tint style (soft bg + colored icon/text) instead of solid fill reads as
// a deliberately designed dashboard rather than a generic scaffold.
// ---------------------------------------------------------------------
type StatTone = 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'indigo';
const TONE_STYLES: Record<StatTone, { chipBg: string; chipText: string; bar: string; ring: string }> = {
    green: { chipBg: 'bg-emerald-50', chipText: 'text-emerald-600', bar: 'bg-emerald-500', ring: 'hover:border-emerald-300' },
    blue: { chipBg: 'bg-blue-50', chipText: 'text-blue-600', bar: 'bg-blue-500', ring: 'hover:border-blue-300' },
    amber: { chipBg: 'bg-amber-50', chipText: 'text-amber-600', bar: 'bg-amber-500', ring: 'hover:border-amber-300' },
    red: { chipBg: 'bg-red-50', chipText: 'text-red-600', bar: 'bg-red-500', ring: 'hover:border-red-300' },
    gray: { chipBg: 'bg-slate-100', chipText: 'text-slate-500', bar: 'bg-slate-400', ring: 'hover:border-slate-300' },
    indigo: { chipBg: 'bg-indigo-50', chipText: 'text-indigo-600', bar: 'bg-indigo-500', ring: 'hover:border-indigo-300' },
};

// Helper Component for consistency — supports an optional info tooltip
// explaining the exact calculation behind the number, and an optional
// `ratePercent` that renders a thin, color-matched progress bar so a rate
// (e.g. "16.7%") has a visual representation, not just text in parentheses.
const StatCard = ({ icon, title, tooltip, value, link, linkText, tone = 'green', onClick, suffix = "", ratePercent }: {
    icon: React.ReactNode; title: string; tooltip?: string; value: React.ReactNode;
    link?: string; linkText?: string; tone?: StatTone; onClick?: () => void; suffix?: string;
    /** 0-100. When provided, renders a thin progress bar under the value. */
    ratePercent?: number;
}) => {
    const t = TONE_STYLES[tone];
    return (
        <div className={`group bg-white overflow-hidden rounded-xl border border-gray-200 ${t.ring} hover:shadow-card transition-all duration-150`}>
            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <dt className="text-[11px] font-semibold text-gray-500 truncate tracking-wide uppercase flex items-center">
                            {title}
                            {tooltip && <InfoTip text={tooltip} />}
                        </dt>
                        <dd className="text-[26px] font-bold text-gray-900 mt-1.5 leading-none tracking-tight">
                            {typeof value === 'number' ? <AnimatedCounter value={value} suffix={suffix} /> : value}
                        </dd>
                    </div>
                    <div className={`flex-shrink-0 h-11 w-11 rounded-xl ${t.chipBg} ${t.chipText} flex items-center justify-center`}>{icon}</div>
                </div>
                {typeof ratePercent === 'number' && (
                    <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(ratePercent)} aria-valuemin={0} aria-valuemax={100}>
                        <div className={`h-full rounded-full ${t.bar} transition-all duration-700`} style={{ width: `${Math.min(Math.max(ratePercent, 0), 100)}%` }} />
                    </div>
                )}
            </div>
            <div className="bg-gray-50/80 px-5 py-2.5 border-t border-gray-100">
                <div className="text-sm">
                    {onClick ? (
                        <button onClick={onClick} className="font-semibold text-brand-green hover:text-brand-green-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded flex items-center gap-1">
                            {linkText} <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    ) : (
                        <Link to={link || '#'} className="font-semibold text-brand-green hover:text-brand-green-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded flex items-center gap-1">
                            {linkText} <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
