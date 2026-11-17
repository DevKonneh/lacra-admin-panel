import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createRole, getRole, updateRole } from '../../api/roles';

// Security hardening (2033): this catalog mirrors the backend's
// authoritative PERMISSIONS catalog (gh-backend-clone/src/config/
// permissions.ts) exactly. As of that change, these strings are no longer
// just a client-side nav-narrowing hint (Sidebar.tsx's hasPermission()) —
// requirePermission(...) middleware now genuinely ENFORCES them on the
// backend for every route listed below. Assigning a Permission Group to an
// account now REPLACES that account's default role-based access with
// EXACTLY the permissions checked here (see getEffectivePermissions() on
// the backend) — it is a narrowing/override, not an addition.
//
// Kept as a grouped, categorized list (rather than one flat array) purely
// for UI readability — grouping has no effect on what's sent to the API.
const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
    {
        label: 'User Management',
        permissions: [
            'user.view', 'user.create', 'user.edit', 'user.suspend',
            'user.delete', 'user.revoke_sessions',
        ],
    },
    {
        label: 'Roles & Permissions',
        permissions: ['role.view', 'role.create', 'role.edit', 'role.delete'],
    },
    // "business.view" is now genuinely enforced by
    // requirePermission(BUSINESS_VIEW) on GET /api/business, layered on
    // top of the existing authMiddleware([ADMIN, COMMERCIAL, DG]) gate.
    // "business.create" is reserved (not yet wired to any route — business
    // registration is currently a self-service action, see
    // business.routes.ts's doc comment on /register) but is a valid,
    // catalog-backed permission string, unlike the previous
    // "business.create" entry here (same string, but it did not exist in
    // the backend's PERMISSIONS catalog until this change).
    {
        label: 'Business Registry',
        permissions: ['business.view', 'business.create'],
    },
    {
        label: 'Licensing',
        permissions: [
            'license.view', 'license.create', 'license.review',
            'license.approve', 'license.suspend', 'license.issue',
        ],
    },
    {
        label: 'Permits',
        permissions: [
            'permit.view', 'permit.create', 'permit.review',
            'permit.approve', 'permit.issue',
        ],
    },
    {
        label: 'Farmer Registry',
        permissions: [
            'farmer.view', 'farmer.create', 'farmer.edit',
            'farmer.delete', 'farmer.verify',
        ],
    },
    {
        label: 'Farm Registry',
        permissions: ['farm.view', 'farm.create', 'farm.edit', 'farm.delete'],
    },
    {
        label: 'Batches, Transfers & Shipments',
        permissions: [
            'batch.view', 'batch.create', 'batch.edit',
            'transfer.view', 'transfer.create',
            'shipment.view', 'shipment.create', 'shipment.approve',
        ],
    },
    {
        label: 'Bulk Data Export',
        permissions: ['export.farmers_farms'],
    },
];



const RoleForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        permissions: [] as string[]
    });
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isEditMode && id) {
            loadRole(id);
        }
    }, [isEditMode, id]);

    const loadRole = async (roleId: string) => {
        setLoading(true);
        try {
            const data = await getRole(roleId);
            if (data.data.status) {
                const role = data.data.data;
                setFormData({
                    name: role.name,
                    description: role.description || '',
                    permissions: role.permissions || []
                });
            }
        } catch (err) {
            setError('Failed to load role details');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            if (isEditMode && id) {
                await updateRole(id, formData);
            } else {
                await createRole(formData);
            }
            navigate('/admin/roles');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save role');
            setSubmitting(false);
        }
    };

    const togglePermission = (permission: string) => {
        setFormData(prev => {
            if (prev.permissions.includes(permission)) {
                return { ...prev, permissions: prev.permissions.filter(p => p !== permission) };
            } else {
                return { ...prev, permissions: [...prev.permissions, permission] };
            }
        });
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-900">{isEditMode ? 'Edit Role' : 'Create New Role'}</h1>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6 border border-red-200">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                    <input
                        type="text"
                        required
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        rows={3}
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Permissions</label>
                    <p className="text-xs text-gray-500 mb-3">
                        These permissions are <strong>enforced on the backend</strong> for every
                        matching action (view, create, edit, approve, suspend, delete, export) — not
                        just used to hide buttons. Assigning this Permission Group to an account
                        <strong> replaces</strong> that account's default role-based access with
                        exactly the permissions checked below. An account with no Permission Group
                        assigned keeps its normal role-based default access, unaffected by this form.
                        You cannot grant a permission here that your own account does not already have.
                    </p>
                    <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 p-4 rounded-md bg-gray-50">
                        {PERMISSION_GROUPS.map(group => (
                            <div key={group.label}>
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group.label}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {group.permissions.map(perm => {
                                        const isSelected = formData.permissions.includes(perm);
                                        return (
                                            <label key={perm} className={`flex items-start space-x-3 p-3 rounded border cursor-pointer transition-colors ${isSelected ? 'bg-white border-green-500 ring-1 ring-green-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                                <div className="flex items-center h-5">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => togglePermission(perm)}
                                                        className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div className="text-sm">
                                                    <span className="font-medium text-gray-900">{perm}</span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/roles')}
                        className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                        {submitting ? 'Saving...' : 'Save Role'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RoleForm;
