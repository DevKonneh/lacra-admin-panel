import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { createUser, getUser, updateUser, getUserAuditLog } from '../../api/users';
import { getRoles } from '../../api/roles';
import type { Role, UserAuditLogEntry } from '../../types';
import { UserRole, UserStatus } from '../../types';
import { apiErrorMessage } from '../applications/statusHelpers';
import { roleLabel, statusLabel, auditActionSummary, formatDateTime, initials } from './userHelpers';
import { ArrowLeft, AlertTriangle, History, Loader2 } from 'lucide-react';

// The access-control role — this is what authMiddleware actually checks on
// every protected route (req.user.role), so it's the field that genuinely
// determines what a staff member can see and do in the app. Ordered
// admin/leadership first, field roles after, matching the User Directory
// filter dropdown.
const ROLE_OPTIONS: string[] = [
    UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DG,
    UserRole.COMMERCIAL, UserRole.TECHNICAL, UserRole.FINANCE, UserRole.IT,
    UserRole.INSPECTOR, UserRole.BUYER, UserRole.EXPORTER, UserRole.FARMER,
];

const STATUS_OPTIONS: { value: string; hint: string }[] = [
    { value: UserStatus.ACTIVE, hint: 'Can sign in and use the system normally.' },
    { value: UserStatus.PENDING, hint: 'Awaiting admin approval before first sign-in.' },
    { value: UserStatus.SUSPENDED, hint: 'Access temporarily revoked; can be reactivated later.' },
    { value: UserStatus.REJECTED, hint: 'Self-registration declined; cannot sign in.' },
];

const inputClass = 'appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm';
const selectClass = 'block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm bg-white';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const UserForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        status: UserStatus.ACTIVE as string,
        roleType: UserRole.INSPECTOR as string, // Access-control role (actually enforced).
        roleId: '', // Optional permission-group assignment (see note below).
    });
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [auditLog, setAuditLog] = useState<UserAuditLogEntry[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState('');

    useEffect(() => {
        loadRoles();
        if (isEditMode && id) {
            loadUser(id);
            loadAuditLog(id);
        }
    }, [isEditMode, id]);

    const loadRoles = async () => {
        try {
            const data = await getRoles();
            if (data.data.status) {
                setRoles(data.data.data);
            }
        } catch {
            // Non-fatal: the permission-group dropdown will just be empty.
        }
    };

    const loadUser = async (userId: string) => {
        setLoading(true);
        setError('');
        try {
            const data = await getUser(userId);
            if (data.data.status) {
                const user = data.data.data;
                setFormData({
                    name: user.name || '',
                    email: user.email,
                    phone: user.phone || '',
                    password: '', // Don't load password
                    status: user.status,
                    roleType: user.role,
                    roleId: user.assignedRole?.id || '',
                });
            } else {
                setError(data.data.message || 'Failed to load user details.');
            }
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to load user details.'));
        } finally {
            setLoading(false);
        }
    };

    const loadAuditLog = async (userId: string) => {
        setAuditLoading(true);
        setAuditError('');
        try {
            const res = await getUserAuditLog(userId);
            if (res.data.status) {
                setAuditLog(res.data.data);
            } else {
                setAuditError(res.data.message || 'Failed to load activity history.');
            }
        } catch (err) {
            setAuditError(apiErrorMessage(err, 'Failed to load activity history.'));
        } finally {
            setAuditLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        const payload: Record<string, unknown> = { ...formData };
        if (isEditMode && !formData.password) {
            delete payload.password; // Don't send empty password on update
        }
        if (!formData.roleId) {
            payload.roleId = null; // Explicitly clear if no permission group selected
        }

        try {
            if (isEditMode && id) {
                await updateUser(id, payload);
            } else {
                await createUser(payload);
            }
            navigate('/admin/users');
        } catch (err: unknown) {
            setError(apiErrorMessage(err, 'Failed to save user.'));
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-0 max-w-3xl mx-auto space-y-5">
            <div className="flex items-center gap-3">
                <Link
                    to="/admin/users"
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                    title="Back to User Management"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="flex items-center gap-3 min-w-0">
                    {isEditMode && (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-green to-emerald-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm">
                            {initials(formData.name, formData.email)}
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-brand-text leading-tight truncate">
                            {isEditMode ? (formData.name || formData.email || 'Edit User') : 'Create New User'}
                        </h1>
                        <p className="text-sm text-brand-muted mt-0.5">
                            {isEditMode ? 'Update account details, role, and access.' : 'Add a new staff account.'}
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="grid grid-cols-1 gap-y-5 gap-x-4 sm:grid-cols-2">
                    <div>
                        <label className={labelClass}>Full Name</label>
                        <input
                            type="text"
                            className={inputClass}
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Phone</label>
                        <input
                            type="tel"
                            className={inputClass}
                            placeholder="Optional"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>Email</label>
                    <input
                        type="email"
                        required
                        className={inputClass}
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                </div>

                <div>
                    <label className={labelClass}>
                        {isEditMode ? 'Password (leave blank to keep current)' : 'Password'}
                    </label>
                    <input
                        type="password"
                        required={!isEditMode}
                        minLength={6}
                        className={inputClass}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-1 gap-y-5 gap-x-4 sm:grid-cols-2">
                    <div>
                        <label className={labelClass}>Status</label>
                        <select
                            className={selectClass}
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                        >
                            {STATUS_OPTIONS.map(s => (
                                <option key={s.value} value={s.value}>{statusLabel(s.value)}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1.5">
                            {STATUS_OPTIONS.find(s => s.value === formData.status)?.hint}
                        </p>
                    </div>

                    <div>
                        <label className={labelClass}>Role (Access Level)</label>
                        <select
                            className={selectClass}
                            value={formData.roleType}
                            onChange={e => setFormData({ ...formData, roleType: e.target.value })}
                        >
                            {ROLE_OPTIONS.map(r => (
                                <option key={r} value={r}>{roleLabel(r)}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1.5">
                            Determines which pages and review queues this account can access.
                        </p>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    <label className={labelClass}>Permission Group (Optional)</label>
                    <select
                        className={selectClass}
                        value={formData.roleId}
                        onChange={e => setFormData({ ...formData, roleId: e.target.value })}
                    >
                        <option value="">-- None --</option>
                        {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                        For record-keeping / future fine-grained permissions. The "Role (Access Level)"
                        field above is what currently controls what this account can see and do.
                    </p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/users')}
                        className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-green hover:bg-brand-green-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                        {submitting ? 'Saving...' : 'Save User'}
                    </button>
                </div>
            </form>

            {isEditMode && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                        <History className="h-4 w-4 text-gray-400" />
                        <h2 className="text-sm font-semibold text-gray-800">Activity History</h2>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                        {auditLoading ? (
                            <div className="px-5 py-8 flex justify-center text-gray-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : auditError ? (
                            <div className="px-5 py-6 text-sm text-red-600 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {auditError}
                            </div>
                        ) : auditLog.length === 0 ? (
                            <div className="px-5 py-8 text-center text-sm text-gray-400">
                                No activity recorded yet.
                            </div>
                        ) : (
                            auditLog.map(entry => (
                                <div key={entry.id} className="px-5 py-3 flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-sm text-gray-800">{auditActionSummary(entry)}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {entry.performedByName ? `By ${entry.performedByName}` : 'System'} · {formatDateTime(entry.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserForm;
