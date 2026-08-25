import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getCustodyHistory, getReconciliation } from '../../api/transfers';
import type { CustodyHistoryData } from '../../api/transfers';
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';

const CustodyHistory: React.FC = () => {
    const { batchId } = useParams<{ batchId: string }>();
    const [history, setHistory] = useState<CustodyHistoryData | null>(null);
    const [recon, setRecon] = useState<{ batchId: string; batchWeightKg: number; sumReceivedKg: number; sumTransferredKg: number; varianceKg: number; reconciled: boolean } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!batchId) return;
        setLoading(true);
        getCustodyHistory(batchId).then(r => {
            if (r.data.status && r.data.data) setHistory(r.data.data);
        }).finally(() => setLoading(false));
        getReconciliation(batchId).then(r => {
            if (r.data.status && r.data.data) setRecon(r.data.data);
        });
    }, [batchId]);

    if (loading || !batchId) return <div className="p-8">Loading...</div>;
    if (!history) return <div className="p-8 text-gray-500">Batch or custody history not found</div>;

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Custody History: {history.batch.batchId}</h1>

            <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">Current Holder</h3>
                <p className="text-xl font-semibold text-green-600">{history.currentHolder}</p>
                <p className="text-sm text-gray-500 mt-1">{history.batch.cropType} | {history.batch.weightKg} kg</p>
            </div>

            {recon && (
                <div className={`rounded-lg p-4 mb-6 flex items-center gap-3 ${recon.reconciled ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                    {recon.reconciled ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-amber-600" />}
                    <div>
                        <p className="font-medium">{recon.reconciled ? 'Reconciled' : 'Variance detected'}</p>
                        <p className="text-sm text-gray-600">
                            Batch: {recon.batchWeightKg} kg | Received: {recon.sumReceivedKg} kg | Transferred: {recon.sumTransferredKg} kg
                            {!recon.reconciled && ` | Variance: ${recon.varianceKg} kg`}
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <h3 className="px-4 py-3 font-medium text-gray-900 border-b">Custody Chain</h3>
                <ul className="divide-y">
                    {history.custodyChain.map((step: { id: string; from: string; to: string; date: string; quantityKg: number; type: string }, i: number) => (
                        <li key={step.id} className="px-4 py-4 flex items-center gap-4">
                            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">{i + 1}</span>
                            <div className="flex-1">
                                <span className="font-medium text-gray-900">{step.from}</span>
                                <ArrowRight className="inline w-4 h-4 mx-2 text-gray-400" />
                                <span className="font-medium text-gray-900">{step.to}</span>
                            </div>
                            <span className="text-sm text-gray-500">{new Date(step.date).toLocaleDateString()}</span>
                            <span className="text-sm font-medium">{step.quantityKg} kg</span>
                            <span className="px-2 py-1 rounded text-xs bg-gray-100">{step.type}</span>
                        </li>
                    ))}
                    {history.custodyChain.length === 0 && (
                        <li className="px-4 py-8 text-center text-gray-500">No transfers recorded for this batch</li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default CustodyHistory;
