import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, MapPinned, FileCheck, AlertTriangle, Users2, Sprout, ArrowUpRight } from 'lucide-react';
import { getDashboardStats, type DashboardStats, getFarmMappingStats, type FarmMappingStats } from '../api/reports';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';

import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import AnimatedCounter from '../components/AnimatedCounter';

import RegisterFarmer from './RegisterFarmer';

const COLORS = ['#10B981', '#F59E0B', '#EF4444']; // Green (Compliant), Amber (Needs Review), Red (High Risk)
const SHIPMENT_colors = {
    DRAFT: '#9CA3AF',
    VALIDATED: '#60A5FA',
    ISSUED: '#10B981',
    SHIPPED: '#3b82f6'
};

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [mappingStats, setMappingStats] = useState<FarmMappingStats | null>(null);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        if (user?.role === UserRole.FARMER) return; // Skip fetching admin stats for farmers

        const fetchStats = async () => {
            try {
                const response = await getDashboardStats();
                if (response.data.status) {
                    setStats(response.data.data);
                }
            } catch (error) {
                console.error("Error fetching stats", error);
            }
        };
        const fetchMappingStats = async () => {
            try {
                const response = await getFarmMappingStats();
                if (response.data.status) {
                    setMappingStats(response.data.data);
                }
            } catch (error) {
                console.error("Error fetching farm mapping stats", error);
            }
        };
        fetchStats();
        fetchMappingStats();
    }, [user]);

    if (user?.role === UserRole.FARMER) {
        return (
            <div className="space-y-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Farmer Dashboard</h2>
                <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100">
                    <p>Welcome back, {user.name}!</p>
                    <div className="mt-4">
                        <Link to="/farmers/profile" className="text-green-600 hover:text-green-800 font-medium">View My Profile</Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!stats) return <div className="p-10 text-center">Loading Analytics...</div>;

    const riskData = [
        { name: 'Compliant', value: stats.compliantFarms },
        { name: 'Needs Review', value: stats.mediumRisks },
        { name: 'High Risk', value: stats.activeRisks },
    ];

    const shipmentData = stats.shipmentStats ? [
        { name: 'Draft', count: stats.shipmentStats.DRAFT, fill: SHIPMENT_colors.DRAFT },
        { name: 'Issued', count: stats.shipmentStats.ISSUED, fill: SHIPMENT_colors.ISSUED },
    ] : [];

    return (
        <div className="space-y-8">
            {/* Page header */}
            <div className="animate-fade-up">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">EUDR farm mapping &amp; compliance overview</p>
            </div>

            {/* 1. Header & Quick Stats */}
            <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Platform Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard
                        icon={<UserPlus className="h-6 w-6" />}
                        iconBg="bg-blue-500"
                        title="Farmers Registered"
                        value={stats.totalFarmers}
                        onClick={() => setShowRegisterForm(!showRegisterForm)}
                        linkText={showRegisterForm ? "Hide Form" : "Add New"}
                        delayClass="animate-fade-up-1"
                    />
                    <StatCard icon={<MapPinned className="h-6 w-6" />} iconBg="bg-purple-500" title="Farms Mapped" value={stats.totalFarms} link="/map" linkText="View Map" delayClass="animate-fade-up-2" />
                    <StatCard icon={<AlertTriangle className="h-6 w-6" />} iconBg="bg-red-500" title="High Risk Detected" value={stats.activeRisks} link="/risk-analysis" linkText="Analyze" delayClass="animate-fade-up-3" />
                    <StatCard icon={<FileCheck className="h-6 w-6" />} iconBg="bg-green-600" title="LACRA Compliance" value={stats.complianceRate} suffix="%" link="#" linkText="Reports" delayClass="animate-fade-up-4" />
                </div>
            </div>

            {/* EUDR Farm Mapping Overview */}
            {mappingStats && (
                <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">EUDR Farm Mapping Overview</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                        <StatCard
                            icon={<Users2 className="h-6 w-6" />}
                            iconBg="bg-indigo-500"
                            title="Total Number of Farmers"
                            value={mappingStats.totalFarmers}
                            link="/farmers"
                            linkText="View Farmers"
                            delayClass="animate-fade-up-1"
                        />
                        <StatCard
                            icon={<MapPinned className="h-6 w-6" />}
                            iconBg="bg-purple-500"
                            title="Total Number of Farm Maps"
                            value={mappingStats.totalFarms}
                            link="/map"
                            linkText="View Map"
                            delayClass="animate-fade-up-2"
                        />
                        <StatCard
                            icon={<User2Icon />}
                            iconBg="bg-pink-500"
                            title="Female Farmers"
                            value={mappingStats.genderBreakdown.Female}
                            link="/farmers"
                            linkText="View Farmers"
                            delayClass="animate-fade-up-3"
                        />
                        <StatCard
                            icon={<User2Icon />}
                            iconBg="bg-sky-500"
                            title="Male Farmers"
                            value={mappingStats.genderBreakdown.Male}
                            link="/farmers"
                            linkText="View Farmers"
                            delayClass="animate-fade-up-4"
                        />
                    </div>

                    <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100 animate-fade-up animate-fade-up-5">
                        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Sprout className="h-5 w-5 text-green-600" /> Crop Type Breakdown (by number of farms)
                        </h3>
                        {mappingStats.cropBreakdown.length === 0 ? (
                            <p className="text-gray-500 text-sm">No farms with crop data yet.</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {mappingStats.cropBreakdown.map((c, idx) => {
                                    const palette = [
                                        'from-green-50 to-green-100/70 border-green-100 text-green-700',
                                        'from-amber-50 to-amber-100/70 border-amber-100 text-amber-700',
                                        'from-blue-50 to-blue-100/70 border-blue-100 text-blue-700',
                                        'from-purple-50 to-purple-100/70 border-purple-100 text-purple-700',
                                    ];
                                    const style = palette[idx % palette.length];
                                    return (
                                        <div key={c.cropType} className={`p-4 bg-gradient-to-br ${style.split(' ').slice(0, 2).join(' ')} rounded-xl text-center border ${style.split(' ')[2]}`}>
                                            <p className={`text-2xl font-bold ${style.split(' ')[3]}`}>{c.count}</p>
                                            <p className="text-xs text-gray-600 mt-1">{c.cropType} Farmer{c.count !== 1 ? 's' : ''}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-6 text-xs text-gray-500">
                            <span>🟢 Farms with GPS Polygon Boundary: <b className="text-gray-800">{mappingStats.farmsWithPolygon}</b></span>
                            <span>🟡 Farms with Point Only: <b className="text-gray-800">{mappingStats.farmsWithPointOnly}</b></span>
                        </div>
                    </div>
                </div>
            )}

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

            {/* 2. Analytical Charts */}
            <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Analytics &amp; Trends</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Farmer Growth Trend */}
                <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100 animate-fade-up animate-fade-up-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Farmer Registration Growth</h3>
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

                {/* Risk Distribution Pie */}
                <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100 animate-fade-up animate-fade-up-2">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Farm Risk Distribution</h3>
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

                {/* Shipment Status Bar */}
                <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100 lg:col-span-2 animate-fade-up animate-fade-up-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Active Shipment Status</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={shipmentData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="count" barSize={20}>
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
        </div>
    );
};

// Small inline gender icon (avoids extra lucide import churn)
const User2Icon = () => (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M6 21v-2a6 6 0 0112 0v2" />
    </svg>
);

// Helper Component for consistency
const StatCard = ({ icon, title, value, link, linkText, iconBg = "bg-green-600", onClick, suffix = "", delayClass = "" }: any) => (
    <div className={`group bg-white overflow-hidden shadow-md rounded-xl border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 animate-fade-up ${delayClass}`}>
        <div className="p-5">
            <div className="flex items-center">
                <div className={`flex-shrink-0 h-12 w-12 rounded-xl ${iconBg} text-white flex items-center justify-center shadow-sm`}>{icon}</div>
                <div className="ml-4 w-0 flex-1">
                    <dl>
                        <dt className="text-xs font-semibold text-gray-500 truncate uppercase tracking-wide">{title}</dt>
                        <dd className="text-2xl font-bold text-gray-900 mt-0.5">
                            {typeof value === 'number' ? <AnimatedCounter value={value} suffix={suffix} /> : value}
                        </dd>
                    </dl>
                </div>
            </div>
        </div>
        <div className="bg-gray-50/80 px-5 py-2.5 border-t border-gray-100">
            <div className="text-sm">
                {onClick ? (
                    <button onClick={onClick} className="font-semibold text-green-700 hover:text-green-900 focus:outline-none flex items-center gap-1">
                        {linkText} <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ) : (
                    <Link to={link} className="font-semibold text-green-700 hover:text-green-900 flex items-center gap-1">
                        {linkText} <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                )}
            </div>
        </div>
    </div>
);

export default Dashboard;
