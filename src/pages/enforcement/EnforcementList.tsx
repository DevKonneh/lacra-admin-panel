import React, { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { Gavel, Plus } from 'lucide-react';

interface Enforcement {
    id: string;
    type: string;
    status: string;
    description: string;
    officer: { name: string };
    createdAt: string;
}

const EnforcementList: React.FC = () => {
    const [actions, setActions] = useState<Enforcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEnforcement();
    }, []);

    const fetchEnforcement = async () => {
        try {
            const res = await apiClient.get('/enforcement');
            // @ts-ignore
            if (res.data.status) {
                // @ts-ignore
                setActions(res.data.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Enforcement Actions</h1>
                <button
                    onClick={() => alert("New Enforcement Action form coming soon")}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Record Action
                </button>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">Loading enforcement actions...</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Officer</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {actions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <Gavel className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                                        No enforcement actions found
                                    </td>
                                </tr>
                            ) : (
                                actions.map((action) => (
                                    <tr key={action.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{action.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(action.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{action.description}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${action.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                                                    action.status === 'OPEN' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {action.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{action.officer.name}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default EnforcementList;
