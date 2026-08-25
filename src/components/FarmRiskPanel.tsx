import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Shield, FileText, Map as MapIcon, RefreshCw, AlertCircle } from 'lucide-react';
import apiClient from '../api/client';

interface RiskPanelProps {
    farmId: string;
    riskLevel?: 'Low' | 'Medium' | 'High';
    lastAssessmentDate?: string;
    onAssessmentComplete?: () => void;
}

const FarmRiskPanel: React.FC<RiskPanelProps> = ({ farmId, riskLevel = 'Low', lastAssessmentDate, onAssessmentComplete }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAssessRisk = async () => {
        setLoading(true);
        setError(null);
        try {
            await apiClient.post(`/risk/assess/${farmId}`);
            if (onAssessmentComplete) onAssessmentComplete();
        } catch (err: any) {
            if (err?.response?.status === 401 || err?.response?.status === 403) {
                setError("You don't have permission to run a risk assessment.");
            } else {
                setError("Failed to run risk assessment");
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'High': return 'bg-red-100 text-red-800 border-red-200';
            case 'Medium': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'Low': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="bg-white shadow rounded-lg p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-blue-600" />
                    LACRA Risk Analysis
                </h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRiskColor(typeof riskLevel === 'string' ? riskLevel : 'Medium')}`}>
                    {typeof riskLevel === 'object' ? JSON.stringify(riskLevel) : riskLevel} Risk
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Deforestation</span>
                        <MapIcon className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        <span className="text-sm text-gray-900">No recent clearing</span>
                    </div>
                </div>

                <div className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Legality</span>
                        <FileText className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        <span className="text-sm text-gray-900">Documents Valid</span>
                    </div>
                </div>

                <div className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Overlap</span>
                        <AlertTriangle className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        <span className="text-sm text-gray-900">No Prohib. Areas</span>
                    </div>
                </div>
                <div className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Traceability</span>
                        <Shield className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex items-center">
                        {riskLevel === 'High' ? (
                            <>
                                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                                <span className="text-sm text-gray-900">Issues Detected</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                                <span className="text-sm text-gray-900">Chain Valid</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm text-gray-500">
                    Last assessed: {lastAssessmentDate ? new Date(lastAssessmentDate).toLocaleDateString() : 'Never'}
                </div>
                <button
                    onClick={handleAssessRisk}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Run New Assessment
                        </>
                    )}
                </button>
            </div>
            {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        </div>
    );
};

export default FarmRiskPanel;
