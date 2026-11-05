import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    UserPlus, MapPinned, FileCheck, AlertTriangle, Users2, Sprout, ArrowUpRight,
    Loader2, RefreshCw, Info, ShieldCheck, FileWarning, FileBadge, ClipboardCheck,
    ShieldAlert, Package, Truck, Ship, Calendar,
} from 'lucide-react';
import {
    getDashboardStats, type DashboardStats, type DashboardFilterParams,
    getFarmMappingStats, type FarmMappingStats,
} from '../api/reports';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';

import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import AnimatedCounter from '../components/AnimatedCounter';
import { COUNTY_NAMES, getDistrictsForCounty } from '../data/liberiaCounties';
import PageHeader from '../components/ui/PageHeader';

import RegisterFarmer from './RegisterFarmer';

const COLORS = ['#10B981', '#F59E0B', '#EF4444']; // Green (Compliant), Amber (Needs Review), Red (High Risk)
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

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [mappingStats, setMappingStats] = useState<FarmMappingStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

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
        gender: (searchParams.get('gender') as any) || undefined,
        complianceStatus: (searchParams.get('complianceStatus') as any) || undefined,
        verificationStatus: (searchParams.get('verificationStatus') as any) || undefined,
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
            const [statsRes, mappingRes] = await Promise.all([
                getDashboardStats(filters),
                getFarmMappingStats(filters),
            ]);
            if (statsRes.data.status) {
                setStats(statsRes.data.data);
            } else {
                setError(statsRes.data.message || 'Failed to load dashboard statistics.');
            }
            if (mappingRes.data.status) setMappingStats(mappingRes.data.data);
        } catch (err: any) {
            console.error("Error fetching dashboard stats", err);
            if (err?.response?.status === 401) {
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
                    description="High-level snapshot of mapping, verification and compliance activity."
                />
                <div className="flex items-center gap-3 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading records…</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                            <div className="h-12 w-12 rounded-xl bg-gray-200 mb-4" />
                            <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
                            <div className="h-6 w-16 bg-gray-200 rounded" />
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
                    description="High-level snapshot of mapping, verification and compliance activity."
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

    const riskData = [
        { name: 'Compliant', value: stats.compliantFarms, status: 'Compliant' },
        { name: 'Needs Review', value: stats.mediumRiskFarms, status: 'Needs Review' },
        { name: 'High Risk', value: stats.highRiskFarms, status: 'High Risk' },
    ];

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
                description="High-level snapshot of mapping, verification and compliance activity."
                actions={
                    <button
                        onClick={fetchAll}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-green hover:text-brand-green-hover disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded px-2 py-1.5 border border-brand-green/30"
                    >
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Refresh
                    </button>
                }
                meta={
                    <div className="flex items-center gap-2 text-xs text-brand-muted">
                        <Calendar className="h-3.5 w-3.5 text-gray-500" />
                        <span>Reporting period: <b className="text-gray-800">{stats.reportingPeriod}</b></span>
                        <span className="text-gray-300">•</span>
                        <span>Last refreshed: <b className="text-gray-800">{new Date(stats.generatedAt).toLocaleString()}</b></span>
                    </div>
                }
            />

            {/* Filters */}
            <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-4">
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Date From</label>
                        <input type="date" value={filters.dateFrom || ''} onChange={(e) => updateFilter('dateFrom', e.target.value)} className="border border-gray-300 rounded-md py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Date To</label>
                        <input type="date" value={filters.dateTo || ''} onChange={(e) => updateFilter('dateTo', e.target.value)} className="border border-gray-300 rounded-md py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">County</label>
                        <select value={filters.county || ''} onChange={(e) => { updateFilter('county', e.target.value); updateFilter('district', ''); }} className="border border-gray-300 rounded-md py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green">
                            <option value="">All Counties</option>
                            {COUNTY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">District</label>
                        <select value={filters.district || ''} onChange={(e) => updateFilter('district', e.target.value)} disabled={!filters.county} className="border border-gray-300 rounded-md py-1.5 px-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green">
                            <option value="">All Districts</option>
                            {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Commodity</label>
                        <input type="text" placeholder="e.g. Cocoa" value={filters.commodity || ''} onChange={(e) => updateFilter('commodity', e.target.value)} className="border border-gray-300 rounded-md py-1.5 px-2 text-sm w-28 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Gender</label>
                        <select value={filters.gender || ''} onChange={(e) => updateFilter('gender', e.target.value)} className="border border-gray-300 rounded-md py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green">
                            <option value="">All</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Compliance Status</label>
                        <select value={filters.complianceStatus || ''} onChange={(e) => updateFilter('complianceStatus', e.target.value)} className="border border-gray-300 rounded-md py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green">
                            <option value="">All</option>
                            <option value="Compliant">Compliant</option>
                            <option value="Needs Review">Needs Review</option>
                            <option value="High Risk">High Risk</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Verification Status</label>
                        <select value={filters.verificationStatus || ''} onChange={(e) => updateFilter('verificationStatus', e.target.value)} className="border border-gray-300 rounded-md py-1.5 px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus:border-brand-green">
                            <option value="">All</option>
                            <option value="Verified">Verified</option>
                            <option value="Unverified">Unverified</option>
                            <option value="Conflict">Conflict</option>
                        </select>
                    </div>
                    {activeFilterCount > 0 && (
                        <button onClick={() => setSearchParams({})} className="text-sm text-gray-500 hover:text-gray-800 underline pb-1.5">
                            Clear filters ({activeFilterCount})
                        </button>
                    )}
                    {loading && <Loader2 className="h-4 w-4 animate-spin text-green-600 mb-1.5" />}
                </div>
            </div>

            {/* 1. Farmer & Farm Overview */}
            <div>
                <h2 className="text-[11px] font-semibold text-brand-muted tracking-wide uppercase mb-4">Farmer &amp; Farm Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard
                        icon={<UserPlus className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="Registered Farmers"
                        tooltip="Total number of Farmer records matching the current filters (Farmer Registry count)."
                        value={stats.totalFarmers}
                        onClick={() => setShowRegisterForm(!showRegisterForm)}
                        linkText={showRegisterForm ? "Hide Form" : "Add New"}
                    />
                    <StatCard
                        icon={<ShieldCheck className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="Verified Farmers"
                        tooltip={`Farmers whose identityStatus = 'Verified'. ${stats.verifiedFarmerRate}% of registered farmers. Kept separate from geometry/compliance rates.`}
                        value={stats.verifiedFarmers}
                        suffix={` (${stats.verifiedFarmerRate}%)`}
                        onClick={() => drillDown('/farmers', { verificationStatus: 'Verified' })}
                        linkText="View Verified"
                    />
                    <StatCard
                        icon={<MapPinned className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="Farms Mapped"
                        tooltip="Total number of Farm records matching the current filters (Farm Registry count)."
                        value={stats.totalFarms}
                        onClick={() => navigate('/map')}
                        linkText="View Map"
                    />
                    <StatCard
                        icon={<Sprout className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="Total Mapped Hectares"
                        tooltip="Sum of Farm.totalAreaHa (declared area) across every farm matching the current filters."
                        value={stats.totalMappedHectares}
                        suffix=" ha"
                        onClick={() => drillDown('/farms')}
                        linkText="View Farms"
                    />
                </div>
            </div>

            {/* 2. Geometry & Compliance */}
            <div>
                <h2 className="text-[11px] font-semibold text-brand-muted tracking-wide uppercase mb-4">Geometry &amp; Compliance</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard
                        icon={<ShieldCheck className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="Farms with Valid Polygons"
                        tooltip={`geometryStatus = 'Valid' (passed all 12 GPS/polygon validation rules). ${stats.geometryValidRate}% of mapped farms. Kept separate from complianceRate.`}
                        value={stats.farmsWithValidPolygons}
                        suffix={` (${stats.geometryValidRate}%)`}
                        onClick={() => drillDown('/farms', { geometryStatus: 'Valid' })}
                        linkText="View Farms"
                    />
                    <StatCard
                        icon={<FileWarning className="h-6 w-6" />}
                        iconBg="bg-amber-500"
                        title="Farms Needing Correction"
                        tooltip="geometryStatus IN (Invalid, Needs Review, Missing) — blocked from compliance certification until corrected."
                        value={stats.farmsNeedingCorrection}
                        onClick={() => navigate('/farms/data-correction-queue')}
                        linkText="Open Queue"
                    />
                    <StatCard
                        icon={<FileCheck className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="LACRA Compliance"
                        tooltip="Compliant farms ÷ total farms. A farm is Compliant only if riskLevel = 'Low' AND geometryStatus = 'Valid'. Click for the full calculation."
                        value={stats.complianceRate}
                        suffix="%"
                        onClick={() => drillDown('/risk-analysis', { complianceDetails: '1' })}
                        linkText="View Calculation"
                    />
                    <StatCard
                        icon={<AlertTriangle className="h-6 w-6" />}
                        iconBg="bg-red-500"
                        title="High Risk Farms"
                        tooltip="Farm.riskLevel = 'High' (from the most recent Whisp/deforestation risk assessment)."
                        value={stats.highRiskFarms}
                        onClick={() => drillDown('/risk-analysis', { riskLevel: 'High' })}
                        linkText="View Reasons"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                    <StatCard
                        icon={<FileCheck className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="Compliant Farms"
                        tooltip="riskLevel = 'Low' AND geometryStatus = 'Valid'."
                        value={stats.compliantFarms}
                        onClick={() => drillDown('/farms', { complianceStatus: 'Compliant' })}
                        linkText="View Farms"
                    />
                    <StatCard
                        icon={<AlertTriangle className="h-6 w-6" />}
                        iconBg="bg-amber-500"
                        title="Medium-Risk Farms"
                        tooltip="riskLevel = 'Medium', OR riskLevel = 'Low' but geometryStatus is not yet 'Valid'."
                        value={stats.mediumRiskFarms}
                        onClick={() => drillDown('/farms', { complianceStatus: 'Needs Review' })}
                        linkText="View Farms"
                    />
                </div>
            </div>

            {/* 3. Farmers by Gender / Farms by County / Farms by Commodity */}
            <div>
                <h2 className="text-[11px] font-semibold text-brand-muted tracking-wide uppercase mb-4">Breakdowns</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Users2 className="h-4.5 w-4.5 text-brand-green" /> Farmers by Gender
                        </h3>
                        <div className="space-y-2">
                            {Object.entries(stats.genderBreakdown).map(([gender, count]) => (
                                <button
                                    key={gender}
                                    onClick={() => drillDown('/farmers', { gender: gender === 'Unspecified' ? undefined : gender })}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-100 text-left"
                                >
                                    <span className="text-sm text-gray-700">{gender}</span>
                                    <span className="text-sm font-semibold text-gray-900">{count}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <MapPinned className="h-4.5 w-4.5 text-brand-green" /> Farms by County
                        </h3>
                        {stats.farmsByCounty.length === 0 ? (
                            <p className="text-gray-500 text-sm">No farm/county data yet.</p>
                        ) : (
                            <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                {stats.farmsByCounty.map((row) => (
                                    <button
                                        key={row.county}
                                        onClick={() => drillDown('/farms', { county: row.county === 'Unspecified' ? undefined : row.county })}
                                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-50 border border-gray-100 text-left"
                                    >
                                        <span className="text-sm text-gray-700">{row.county}</span>
                                        <span className="text-sm font-semibold text-gray-900">{row.count}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Sprout className="h-4.5 w-4.5 text-green-600" /> Farms by Commodity
                        </h3>
                        {stats.farmsByCommodity.length === 0 ? (
                            <p className="text-gray-500 text-sm">No farms with commodity data yet.</p>
                        ) : (
                            <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                {stats.farmsByCommodity.map((row) => (
                                    <button
                                        key={row.commodity}
                                        onClick={() => drillDown('/farms', { commodity: row.commodity })}
                                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-50 border border-gray-100 text-left"
                                    >
                                        <span className="text-sm text-gray-700">{row.commodity}</span>
                                        <span className="text-sm font-semibold text-gray-900">{row.count}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. Licensing, Inspectorate, Traceability */}
            <div>
                <h2 className="text-[11px] font-semibold text-brand-muted tracking-wide uppercase mb-4">Licensing, Inspectorate &amp; Traceability</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard
                        icon={<FileBadge className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="Active Licenses"
                        tooltip={`status IN (LICENSE_ISSUED, ACTIVE) AND (validTo is null or in the future). Expiring within ${stats.expiringWindowDays} days: ${stats.expiringLicenses}.`}
                        value={stats.activeLicenses}
                        onClick={() => navigate('/licenses')}
                        linkText={`${stats.expiringLicenses} expiring soon`}
                    />
                    <StatCard
                        icon={<FileBadge className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="Active Permits"
                        tooltip={`status = PERMIT_ISSUED AND (validTo is null or in the future). Expiring within ${stats.expiringWindowDays} days: ${stats.expiringPermits}.`}
                        value={stats.activePermits}
                        onClick={() => navigate('/permits')}
                        linkText={`${stats.expiringPermits} expiring soon`}
                    />
                    <StatCard
                        icon={<ClipboardCheck className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="Active Inspections"
                        tooltip="Inspection.status IN (SCHEDULED, IN_PROGRESS)."
                        value={stats.activeInspections}
                        onClick={() => navigate('/inspections')}
                        linkText="View Inspections"
                    />
                    <StatCard
                        icon={<ShieldAlert className="h-6 w-6" />}
                        iconBg="bg-amber-500"
                        title="Pending Quality Tests"
                        tooltip="QualityControl.result = 'PENDING'."
                        value={stats.pendingQualityTests}
                        onClick={() => navigate('/quality')}
                        linkText="View Quality"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <StatCard
                        icon={<Package className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="Traceable Batches"
                        tooltip={`Batches with a non-null farm link (attributable to a specific source). ${stats.traceableBatches} of ${stats.totalBatches} total batches.`}
                        value={stats.traceableBatches}
                        suffix={` / ${stats.totalBatches}`}
                        onClick={() => navigate('/logistics')}
                        linkText="View Batches"
                    />
                    <StatCard
                        icon={<Ship className="h-6 w-6" />}
                        iconBg="bg-brand-green"
                        title="Active Shipments"
                        tooltip="Shipment.status IN (VALIDATED, ISSUED, SHIPPED) — i.e. anything that has left DRAFT."
                        value={stats.activeShipments}
                        onClick={() => navigate('/export')}
                        linkText="View Shipments"
                    />
                </div>
            </div>

            {/* Register Farmer Section */}
            {showRegisterForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800">New Farmer Registration</h2>
                        <button onClick={() => setShowRegisterForm(false)} className="text-gray-500 hover:text-gray-700">
                            Close
                        </button>
                    </div>
                    <RegisterFarmer />
                </div>
            )}

            {/* 5. Analytical Charts */}
            <div>
                <h2 className="text-[11px] font-semibold text-brand-muted tracking-wide uppercase mb-4">Analytics &amp; Trends</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Farmer Growth Trend */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Farmer Registration Growth</h3>
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
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="count" stroke="#10B981" fillOpacity={1} fill="url(#colorFarmers)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Risk Distribution Pie — every segment clickable */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Farm Risk Distribution <span className="text-xs text-gray-500 font-normal">(click a segment)</span></h3>
                        <div className="h-64 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={riskData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        onClick={(entry: any) => drillDown('/farms', { complianceStatus: entry.status })}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {riskData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Shipment Status Bar — all 4 statuses now shown */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 lg:col-span-2">
                        <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Shipment Status</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={shipmentData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" allowDecimals={false} />
                                    <YAxis dataKey="name" type="category" width={100} />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="count" barSize={20} onClick={() => navigate('/export')} style={{ cursor: 'pointer' }}>
                                        {shipmentData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* EUDR Farm Mapping crop breakdown (legacy endpoint, kept for the point-only footer) */}
            {mappingStats && (
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <h3 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Truck className="h-4.5 w-4.5 text-green-600" /> GPS Mapping Coverage
                    </h3>
                    <div className="flex gap-6 text-[12px] text-gray-500">
                        <button onClick={() => drillDown('/farms', { geometryStatus: 'Valid' })} className="inline-flex items-center gap-1.5 hover:underline">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            GPS Polygon Boundary: <b className="text-gray-800 font-semibold">{mappingStats.farmsWithPolygon}</b>
                        </button>
                        <button onClick={() => navigate('/farms/data-correction-queue')} className="inline-flex items-center gap-1.5 hover:underline">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            Point Only / Needs Correction: <b className="text-gray-800 font-semibold">{mappingStats.farmsWithPointOnly}</b>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper Component for consistency — now supports an optional info
// tooltip explaining the exact calculation behind the number.
const StatCard = ({ icon, title, tooltip, value, link, linkText, iconBg = "bg-brand-green", onClick, suffix = "" }: any) => (
    <div className="group bg-white overflow-hidden rounded-xl border border-gray-200 hover:border-brand-green/40 transition-colors duration-150">
        <div className="p-5">
            <div className="flex items-center">
                <div className={`flex-shrink-0 h-12 w-12 rounded-xl ${iconBg} text-white flex items-center justify-center`}>{icon}</div>
                <div className="ml-4 w-0 flex-1">
                    <dl>
                        <dt className="text-[11px] font-semibold text-gray-500 truncate tracking-wide uppercase flex items-center">
                            {title}
                            {tooltip && <InfoTip text={tooltip} />}
                        </dt>
                        <dd className="text-[26px] font-bold text-gray-900 mt-1 leading-none tracking-tight">
                            {typeof value === 'number' ? <AnimatedCounter value={value} suffix={suffix} /> : value}
                        </dd>
                    </dl>
                </div>
            </div>
        </div>
        <div className="bg-gray-50/80 px-5 py-2.5 border-t border-gray-100">
            <div className="text-sm">
                {onClick ? (
                    <button onClick={onClick} className="font-semibold text-brand-green hover:text-brand-green-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded flex items-center gap-1">
                        {linkText} <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ) : (
                    <Link to={link} className="font-semibold text-brand-green hover:text-brand-green-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded flex items-center gap-1">
                        {linkText} <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                )}
            </div>
        </div>
    </div>
);

export default Dashboard;
