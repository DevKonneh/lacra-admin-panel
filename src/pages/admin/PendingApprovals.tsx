import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPendingUsers, approveUser, rejectUser } from '../../api/users';
import type { User } from '../../types';
import { apiErrorMessage } from '../applications/statusHelpers';
import { roleLabel, roleColor, initials, formatDateOnly } from './userHelpers';
import { ArrowLeft, Check, X, AlertTriangle, UserCheck } from 'lucide-react';

const Avatar: React.FC<{ name?: string | null; email?: string | null }> = ({ name, email }) => (
    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm">
        {initials(name, email)}
    </div>
);

const SkeletonRow: React.FC = () => (
    <tr>
        <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" /><div className="space-y-1.5"><div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" /><div className="h-2.5 w-36 bg-gray-100 rounded animate-pulse" /></div></div></td>
        <td className="px-5 py-3"><div className="h-5 w-24 bg-gray-200 rounded-full animate-pulse" /></td>
        <td className="px-5 py-3"><div className="h-3.5 w-20 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-5 py-3 text-right"><div className="h-6 w-16 bg-gray-200 rounded animate-pulse ml-auto" /></td>
    </tr>
);

const PendingApprovals: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getPendingUsers();
            if (res.data.status) {
                setUsers(res.data.data);
            } else {
                setError(res.data.message || 'Failed to load pending approvals.');
            }
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load pending approvals. Please check your connection and try again.'));
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (user: User) => {
        if (!window.confirm(`Approve ${user.name || user.email}? They will be able to sign in immediately.`)) return;
        setActionError('');
        setBusyId(user.id);
        try {
            const res = await approveUser(user.id);
            if (res.data.status) {
                setUsers(prev => prev.filter(u => u.id !== user.id));
            } else {
                setActionError(res.data.message || 'Failed to approve user.');
            }
        } catch (err) {
            setActionError(apiErrorMessage(err, 'Failed to approve user.'));
        } finally {
            setBusyId(null);
        }
    };

    const handleReject = async (user: User) => {
        if (!window.confirm(`Reject ${user.name || user.email}? They will not be able to sign in.`)) return;
        setActionError('');
        setBusyId(user.id);
        try {
            const res = await rejectUser(user.id);
            if (res.data.status) {
                setUsers(prev => prev.filter(u => u.id !== user.id));
            } else {
                setActionError(res.data.message || 'Failed to reject user.');
            }
        } catch (err) {
            setActionError(apiErrorMessage(err, 'Failed to reject user.'));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <Link
                    to="/admin/users"
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                    title="Back to User Management"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-xl font-semibold text-brand-text leading-tight">Pending Approvals</h1>
                    <p className="text-sm text-brand-muted mt-0.5">New self-registered accounts awaiting admin review.</p>
                </div>
            </div>

            {actionError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span className="flex-1">{actionError}</span>
                    <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 font-bold px-1">&times;</button>
                </div>
            )}

            <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
                {error ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button
                            onClick={fetchPending}
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
                                    <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Applicant</th>
                                    <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Requested Role</th>
                                    <th scope="col" className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Registered On</th>
                                    <th scope="col" className="px-5 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-50">
                                {loading ? (
                                    <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-5 py-14 text-center">
                                            <div className="flex flex-col items-center gap-2 text-gray-400">
                                                <UserCheck className="h-8 w-8" />
                                                <p className="text-sm text-gray-500">No pending approvals right now.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : users.map(user => {
                                    const isBusy = busyId === user.id;
                                    return (
                                        <tr key={user.id} className="hover:bg-yellow-50/40 transition-colors">
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
                                                <span className={`px-2 py-0.5 inline-flex items-center text-[11px] font-semibold rounded-full ${roleColor(user.role)}`}>
                                                    {roleLabel(user.role)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                                                {formatDateOnly(user.createdAt)}
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleApprove(user)}
                                                        disabled={isBusy}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                                                    >
                                                        <Check className="h-3.5 w-3.5" /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(user)}
                                                        disabled={isBusy}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                                                    >
                                                        <X className="h-3.5 w-3.5" /> Reject
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

export default PendingApprovals;
