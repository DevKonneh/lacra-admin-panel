import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { ShieldCheck, Plus } from 'lucide-react';

interface QCRecord {
    id: string;
    batch: { batchNumber: string };
    checkDate: string;
    result: string;
    inspector: { name: string };
}

const QualityControlList: React.FC = () => {
    const navigate = useNavigate();
    const [records, setRecords] = useState<QCRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQC();
    }, []);

    const fetchQC = async () => {
        try {
            const res = await apiClient.get('/quality');
            // @ts-ignore
            if (res.data.status) {
                // @ts-ignore
                setRecords(res.data.data);
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
                <h1 className="text-2xl font-bold text-gray-900">Quality Control</h1>
                <button
                    onClick={() => navigate('/quality/new')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    New QC Check
                </button>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">Loading QC records...</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch Number</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inspector</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <ShieldCheck className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                                        No quality records found
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {record.batch?.batchNumber || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(record.checkDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.result === 'PASSED' ? 'bg-green-100 text-green-800' :
                                                record.result === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {record.result}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.inspector.name}</td>
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

export default QualityControlList;
