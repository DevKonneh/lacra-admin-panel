import React, { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { Check, X } from 'lucide-react';

interface PendingUser {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
}

const PendingApprovals: React.FC = () => {
    const [users, setUsers] = useState<PendingUser[]>([]);

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        try {
            const res = await apiClient.get('/auth/pending');
            // @ts-ignore
            if (res.data.status) {
                // @ts-ignore
                setUsers(res.data.data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleApprove = async (id: string) => {
        if (!window.confirm("Approve this user?")) return;
        try {
            await apiClient.put(`/auth/approve/${id}`);
            fetchPending();
        } catch (error) {
            alert("Error approving user");
        }
    };

    const handleReject = async (id: string) => {
        if (!window.confirm("Reject this user?")) return;
        try {
            await apiClient.put(`/auth/reject/${id}`);
            fetchPending();
        } catch (error) {
            alert("Error rejecting user");
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No pending approvals</td></tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleApprove(user.id)} className="text-green-600 hover:text-green-900 mr-4">
                                            <Check className="h-5 w-5" />
                                        </button>
                                        <button onClick={() => handleReject(user.id)} className="text-red-600 hover:text-red-900">
                                            <X className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PendingApprovals;
