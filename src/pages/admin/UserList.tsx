import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getUsers, deleteUser, setUserStatus } from '../../api/users';
import type { User } from '../../types';
import { UserStatus, UserRole } from '../../types';
import { apiErrorMessage } from '../applications/statusHelpers';
import {
    roleLabel, roleColor, statusLabel, statusColor, initials,
    formatDateTime,
} from './userHelpers';
import {
    Search, Plus, Users, ShieldCheck, Clock, Ban, UserCog,
    Pencil, Power, Trash2, AlertTriangle,
} from 'lucide-react';

// Every role a staff account can hold, in the order they should appear in
// the filter dropdown (admin/leadership first, field roles after).
const ROLE_OPTIONS: string[] = [
    UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DG,
    UserRole.COMMERCIAL, UserRole.TECHNICAL, UserRole.FINANCE, UserRole.IT,
    UserRole.INSPECTOR, UserRole.BUYER, UserRole.EXPORTER, UserRole.FARMER,
];

const SummaryCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent: string }> = ({ icon, label, value, accent }) => (
    <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>{icon}</div>
        <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">{label}</p>
            <p className="text-xl font-bold text-brand-text leading-tight">{value}</p>
        </div>
    </div>
);

const Avatar: React.FC<{ name?: string | null; email?: string | null; size?: string }> = ({ name, email, size = 'h-10 w-10' }) => (
    <div className={`${size} rounded-full bg-gradient-to-br from-brand-green to-emerald-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm`}>
        {initials(name, email)}
    </div>
);

const SkeletonRow: React.FC = () => (
    <tr>
        <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" /><div className="space-y-1.5"><div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" /><div className="h-2.5 w-36 bg-gray-100 rounded animate-pulse" /></div></div></td>
        <td className="px-5 py-3"><div className="h-5 w-24 bg-gray-200 rounded-full animate-pulse" /></td>
        <td className="px-5 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" /></td>
        <td className="px-5 py-3"><div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-5 py-3 text-right"><div className="h-3.5 w-20 bg-gray-200 rounded animate-pulse ml-auto" /></td>
    </tr>
);

const UserList: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    const [searchParams, setSearchParams] = useSearchParams();
    const searchTerm = searchParams.get('q') || '';
    const roleFilter = searchParams.get('role') || 'All';
    const statusFilter = searchParams.get('status') || 'All';

    const updateParam = (key: string, value: string) => {
        const next = new URLSearchParams(searchParams);
        if (!value || value === 'All') next.delete(key);
        else next.set(key, value);
        setSearchParams(next);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getUsers();
            if (data.data.status) {
                setUsers(data.data.data);
            } else {
                setError(data.data.message || 'Failed to load users.');
            }
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load users. Please check your connection and try again.'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (user: User) => {
        if (!window.confirm(`Permanently delete ${user.name || user.email}? This cannot be undone — consider Deactivate instead if you just want to revoke access.`)) return;
        setActionError('');
        setBusyId(user.id);
        try {
            const res = await deleteUser(user.id);
            if (res.data.status) {
                setUsers(prev => prev.filter(u => u.id !== user.id));
            } else {
                setActionError(res.data.message || 'Failed to delete user.');
            }
        } catch (err) {
            setActionError(apiErrorMessage(err, 'Failed to delete user.'));
        } finally {
            setBusyId(null);
        }
    };

    const handleToggleStatus = async (user: User) => {
        const next = user.status === UserStatus.SUSPENDED ? UserStatus.ACTIVE : UserStatus.SUSPENDED;
        const verb = next === UserStatus.SUSPENDED ? 'deactivate' : 'reactivate';
        if (!window.confirm(`Are you sure you want to ${verb} ${user.name || user.email}?`)) return;
        setActionError('');
        setBusyId(user.id);
        try {
            const res = await setUserStatus(user.id, next);
            if (res.data.status) {
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: next } : u));
            } else {
                setActionError(res.data.message || `Failed to ${verb} user.`);
            }
        } catch (err) {
            setActionError(apiErrorMessage(err, `Failed to ${verb} user.`));
        } finally {
            setBusyId(null);
        }
    };

    const filteredUsers = users.filter(user => {
        // NOTE: some accounts (e.g. farmers self-registered from the mobile
        // app before entering a name, or placeholder "@lacra.temp" accounts)
        // have `name: null` from the backend. Guard against that so a single
        // null-named user doesn't crash the whole User Management page with
        // "Cannot read properties of null (reading 'toLowerCase')".
        const name = (user.name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term || name.includes(term) || email.includes(term);
        const matchesRole = roleFilter === 'All' || user.role === roleFilter;
        const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
    });

    const activeFilterCount = [roleFilter, statusFilter].filter(v => v !== 'All').length + (searchTerm ? 1 : 0);

    const stats = useMemo(() => ({
        total: users.length,
        active: users.filter(u => u.status === UserStatus.ACTIVE).length,
        pending: users.filter(u => u.status === UserStatus.PENDING).length,
        suspended: users.filter(u => u.status === UserStatus.SUSPENDED).length,
    }), [users]);

    return (
        <div className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-brand-text leading-tight">User Management</h1>
                    <p className="text-sm text-brand-muted mt-0.5">Staff accounts, roles, and access control.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        to="/admin/approvals"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 text-sm font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                        <Clock className="h-4 w-4" />
                        Pending Approvals
                        {stats.pending > 0 && (
                            <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-full bg-yellow-100 text-yellow-800 text-[11px] font-bold">
                                {stats.pending}
                            </span>
                        )}
                    </Link>
                    <Link
                        to="/admin/users/new"
                        className="inline-flex items-center gap-1.5 px-4 py-2 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-brand-green hover:bg-brand-green-hover transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Create User
                    </Link>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard icon={<Users className="h-5 w-5 text-brand-green" />} label="Total Accounts" value={loading ? '—' : stats.total} accent="bg-green-50" />
                <SummaryCard icon={<ShieldCheck className="h-5 w-5 text-blue-600" />} label="Active" value={loading ? '—' : stats.active} accent="bg-blue-50" />
                <SummaryCard icon={<Clock className="h-5 w-5 text-yellow-600" />} label="Pending Approval" value={loading ? '—' : stats.pending} accent="bg-yellow-50" />
                <SummaryCard icon={<Ban className="h-5 w-5 text-orange-600" />} label="Suspended" value={loading ? '—' : stats.suspended} accent="bg-orange-50" />
            </div>

            {actionError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span className="flex-1">{actionError}</span>
                    <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 font-bold px-1">&times;</button>
                </div>
            )}

            <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                {/* Toolbar: search + role/status filters */}
                <div className="p-3.5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2.5 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50/60 placeholder-gray-400 text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                            placeholder="Search by name or email"
                            value={searchTerm}
                            onChange={(e) => updateParam('q', e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={roleFilter}
                            onChange={(e) => updateParam('role', e.target.value)}
                            className="border border-gray-200 bg-gray-50/60 rounded-lg py-2 px-2.5 text-sm text-gray-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        >
                            <option value="All">All Roles</option>
                            {ROLE_OPTIONS.map(r => (
                                <option key={r} value={r}>{roleLabel(r)}</option>
                            ))}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => updateParam('status', e.target.value)}
                            className="border border-gray-200 bg-gray-50/60 rounded-lg py-2 px-2.5 text-sm text-gray-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        >
                            <option value="All">All Statuses</option>
                            <option value={UserStatus.ACTIVE}>Active</option>
                            <option value={UserStatus.PENDING}>Pending</option>
                            <option value={UserStatus.SUSPENDED}>Suspended</option>
                            <option value={UserStatus.REJECTED}>Rejected</option>
                        </select>
                        {activeFilterCount > 0 && (
                            <button
                                onClick={() => setSearchParams({})}
                                className="text-sm text-gray-500 hover:text-gray-800 underline px-1.5 whitespace-nowrap"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {error ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button
                            onClick={loadUsers}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/90 backdrop-blur-sm sticky top-0 z-10">
                                <tr>
                                    <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">User</th>
                                    <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                                    <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                                    <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Last Active</th>
                                    <th scope="col" className="px-5 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-50">
                                {loading ? (
                                    <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500">
                                            No users found matching your criteria.
                                        </td>
                                    </tr>
                                ) : filteredUsers.map(user => {
                                    const isSuspended = user.status === UserStatus.SUSPENDED;
                                    const isBusy = busyId === user.id;
                                    return (
                                        <tr key={user.id} className="hover:bg-green-50/40 transition-colors">
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <Avatar name={user.name} email={user.email} />
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-gray-900 truncate">
                                                            {user.name || <span className="italic text-gray-400 font-normal">No name set</span>}
                                                        </div>
                                                        <div className="text-xs text-gray-500 truncate">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                {user.assignedRole ? (
                                                    <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[11px] font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                                        <UserCog className="h-3 w-3" /> {user.assignedRole.name}
                                                    </span>
                                                ) : (
                                                    <span className={`px-2 py-0.5 inline-flex items-center text-[11px] font-semibold rounded-full ${roleColor(user.role)}`}>
                                                        {roleLabel(user.role)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 inline-flex items-center text-[11px] font-semibold rounded-full ${statusColor(user.status)}`}>
                                                    {statusLabel(user.status)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                                                {formatDateTime(user.lastLoginAt)}
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Link
                                                        to={`/admin/users/${user.id}`}
                                                        title="Edit"
                                                        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleToggleStatus(user)}
                                                        disabled={isBusy}
                                                        title={isSuspended ? 'Reactivate' : 'Deactivate'}
                                                        className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${isSuspended ? 'text-green-600 hover:bg-green-50' : 'text-orange-500 hover:bg-orange-50'}`}
                                                    >
                                                        <Power className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user)}
                                                        disabled={isBusy}
                                                        title="Delete permanently"
                                                        className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserList;
