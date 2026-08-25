import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createRole, getRole, updateRole } from '../../api/roles';

// Example permissions list - in a real app this might come from backend
const AVAILABLE_PERMISSIONS = [
    'user.create', 'user.read', 'user.update', 'user.delete',
    'role.create', 'role.read', 'role.update', 'role.delete',
    'farmer.create', 'farmer.read', 'farmer.update', 'farmer.delete',
    'farm.create', 'farm.read', 'farm.update', 'farm.delete',
    'report.view', 'dashboard.view'
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
                    <label className="block text-sm font-medium text-gray-700 mb-3">Permissions</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto border border-gray-200 p-4 rounded-md bg-gray-50">
                        {AVAILABLE_PERMISSIONS.map(perm => {
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
