import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createUser, getUser, updateUser } from '../../api/users';
import { getRoles } from '../../api/roles';
import type { Role } from '../../types';

const USER_STATUSES = ['ACTIVE', 'PENDING', 'REJECTED'];
const LEGACY_ROLES = ['ADMIN', 'INSPECTOR', 'BUYER', 'EXPORTER', 'FARMER'];

const UserForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        status: 'ACTIVE',
        roleType: 'INSPECTOR', // Fallback/Legacy Role
        roleId: '' // New Dynamic Role
    });
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadRoles();
        if (isEditMode && id) {
            loadUser(id);
        }
    }, [isEditMode, id]);

    const loadRoles = async () => {
        try {
            const data = await getRoles();
            if (data.data.status) {
                setRoles(data.data.data);
            }
        } catch (err) {
            console.error('Failed to load roles');
        }
    };

    const loadUser = async (userId: string) => {
        setLoading(true);
        try {
            const data = await getUser(userId);
            if (data.data.status) {
                const user = data.data.data;
                setFormData({
                    name: user.name || '',
                    email: user.email,
                    password: '', // Don't load password
                    status: user.status,
                    roleType: user.role,
                    roleId: user.assignedRole?.id || ''
                });
            }
        } catch (err) {
            setError('Failed to load user details');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        const payload = { ...formData };
        if (isEditMode && !payload.password) {
            // @ts-ignore
            delete payload.password; // Don't send empty password on update
        }
        if (!payload.roleId) {
            // @ts-ignore
            payload.roleId = null; // Send null if no role selected
        }

        try {
            if (isEditMode && id) {
                await updateUser(id, payload);
            } else {
                await createUser(payload);
            }
            navigate('/admin/users');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save user');
            setSubmitting(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-900">{isEditMode ? 'Edit User' : 'Create New User'}</h1>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6 border border-red-200">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                        type="text"
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        type="email"
                        required
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {isEditMode ? 'Password (leave blank to keep current)' : 'Password'}
                    </label>
                    <input
                        type="password"
                        required={!isEditMode}
                        minLength={6}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                        >
                            {USER_STATUSES.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Role (Dynamic)</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            value={formData.roleId}
                            onChange={e => setFormData({ ...formData, roleId: e.target.value })}
                        >
                            <option value="">-- None --</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {!formData.roleId && (
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Legacy Role Type (Fallback)</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            value={formData.roleType}
                            onChange={e => setFormData({ ...formData, roleType: e.target.value })}
                        >
                            {LEGACY_ROLES.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-2">Used only if no dynamic role is assigned.</p>
                    </div>
                )}

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
                        className="inline-flex justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                        {submitting ? 'Saving...' : 'Save User'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default UserForm;
