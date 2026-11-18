import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { ClipboardCheck, Plus, AlertTriangle } from 'lucide-react';

interface Inspection {
    id: string;
    type: string;
    scheduledDate: string;
    status: string;
    result: string;
    farm?: { name: string };
    shipment?: { shipmentId: string };
    inspector: { name: string };
}

// Skeleton row shown while inspections are loading, so the table never
// flashes "0 inspections" / an empty state before the real data arrives.
const SkeletonRow: React.FC = () => (
    <tr>
        <td className="px-6 py-4"><div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-3.5 w-20 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-3.5 w-16 bg-gray-200 rounded animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-3.5 w-20 bg-gray-200 rounded animate-pulse" /></td>
    </tr>
);

const InspectionList: React.FC = () => {
    const navigate = useNavigate();
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchInspections();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchInspections = async () => {
        try {
            setLoading(true);
            setError(null);
            const res: any = await apiClient.get('/inspections');
            if (res.data.status) {
                setInspections(res.data.data);
            } else {
                setError(res.data.message || 'Failed to load inspections.');
            }
        } catch (err: any) {
            console.error('Error fetching inspections', err);
            if (err?.response?.status === 401) {
                setError('Your session has expired. Please log in again.');
            } else {
                setError('Failed to load inspections. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Inspection Management</h1>
                <button
                    onClick={() => navigate('/inspections/new')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Schedule Inspection
                </button>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {error ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">{error}</p>
                        <button
                            onClick={fetchInspections}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inspector</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <>
                                    <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
                                </>
                            ) : inspections.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                                        No inspections found
                                    </td>
                                </tr>
                            ) : (
                                inspections.map((inspection) => (
                                    <tr key={inspection.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{inspection.type}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {inspection.farm?.name || inspection.shipment?.shipmentId || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(inspection.scheduledDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${inspection.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                inspection.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {inspection.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{inspection.result}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{inspection.inspector.name}</td>
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

export default InspectionList;
