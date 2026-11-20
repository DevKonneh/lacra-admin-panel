import React, { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle, CheckCircle, Shield, Map as MapIcon, RefreshCw, AlertCircle,
    FileText, HelpCircle, Clock,
} from 'lucide-react';
import { getRiskHistory, assessRisk, type RiskAnalysisResult } from '../api/risk';

interface RiskPanelProps {
    farmId: string;
    lastAssessmentDate?: string;
    onAssessmentComplete?: () => void;
}

/**
 * Tri-state result chip.
 *
 * The previous version of this panel hard-coded all four indicator tiles
 * ("Deforestation: No recent clearing", "Legality: Documents Valid",
 * "Overlap: No Prohib. Areas", "Traceability: Chain Valid") to green
 * check-marks unconditionally — they rendered identically for a farm that
 * had never been assessed, one whose assessment failed to run, and one that
 * genuinely passed. On a regulator's screen that is a fabricated compliance
 * result, so every tile is now driven by an actual stored assessment and
 * falls back to an explicit "Not assessed" state.
 */
type Tri = { kind: 'pass' | 'fail' | 'unknown'; text: string };

const Chip: React.FC<{ value: Tri }> = ({ value }) => {
    if (value.kind === 'unknown') {
        return (
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                <HelpCircle className="h-4.5 w-4.5 text-gray-400" />
                {value.text}
            </span>
        );
    }
    const good = value.kind === 'pass';
    return (
        <span className={`inline-flex items-center gap-1.5 text-sm ${good ? 'text-gray-900' : 'text-red-700 font-medium'}`}>
            {good ? <CheckCircle className="h-4.5 w-4.5 text-green-500" /> : <AlertTriangle className="h-4.5 w-4.5 text-red-500" />}
            {value.text}
        </span>
    );
};

const RISK_BADGE: Record<string, string> = {
    High: 'bg-red-100 text-red-800 border-red-200',
    Medium: 'bg-orange-100 text-orange-800 border-orange-200',
    Low: 'bg-green-100 text-green-800 border-green-200',
};
const UNASSESSED_BADGE = 'bg-gray-100 text-gray-700 border-gray-200';

const formatWhen = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

const FarmRiskPanel: React.FC<RiskPanelProps> = ({ farmId, lastAssessmentDate, onAssessmentComplete }) => {
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [latest, setLatest] = useState<RiskAnalysisResult | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);

    const loadHistory = useCallback(async () => {
        try {
            setHistoryLoading(true);
            setHistoryError(null);
            const res = await getRiskHistory(farmId);
            if (res.data.status) {
                // History is returned newest-first by the backend.
                setLatest(res.data.data?.[0] ?? null);
            } else {
                setHistoryError(res.data.message || 'Could not load assessment history.');
            }
        } catch (err) {
            console.error('Failed to load risk history', err);
            setHistoryError('Could not load assessment history.');
        } finally {
            setHistoryLoading(false);
        }
    }, [farmId]);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const handleAssessRisk = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await assessRisk(farmId);
            if (res.data.status) {
                setLatest(res.data.data);
                // Re-read history so the panel and the farm header agree.
                await loadHistory();
                if (onAssessmentComplete) onAssessmentComplete();
            } else {
                setError(res.data.message || 'The assessment did not complete.');
            }
        } catch (err: any) {
            const status = err?.response?.status;
            const message = err?.response?.data?.message;
            if (status === 401 || status === 403) {
                setError("You don't have permission to run a risk assessment.");
            } else if (status === 400) {
                // Backend returns 400 with the geometry-validation detail when
                // the boundary is missing/invalid — that is the farm's own
                // problem, not an outage, and must be shown verbatim.
                setError(message || 'Assessment blocked: this farm’s boundary failed geometry validation.');
            } else if (status === 429) {
                setError('The satellite service is rate-limiting requests right now. Try again in a minute.');
            } else {
                setError(message || 'Failed to run risk assessment. No result was recorded.');
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // No completed assessment => every indicator is honestly "Not assessed",
    // never a green pass. This covers never-assessed, failed and pending runs.
    const hasAssessment = Boolean(latest);
    const riskWord = hasAssessment ? latest!.overallRisk : null;

    const deforestation: Tri = !hasAssessment
        ? { kind: 'unknown', text: 'Not assessed' }
        : latest!.deforestationRisk
            ? { kind: 'fail', text: 'Deforestation risk detected' }
            : { kind: 'pass', text: 'No deforestation risk flagged' };

    const legality: Tri = !hasAssessment
        ? { kind: 'unknown', text: 'Not assessed' }
        : latest!.legalityRisk
            ? { kind: 'fail', text: 'Legality issue (missing/invalid document)' }
            : { kind: 'pass', text: 'Documents valid' };

    const overlap: Tri = !hasAssessment
        ? { kind: 'unknown', text: 'Not assessed' }
        : latest!.overlapResult && latest!.overlapResult !== 'None'
            ? { kind: 'fail', text: `Overlap: ${latest!.overlapResult}` }
            : { kind: 'pass', text: 'No protected-area/forest overlap' };

    const traceability: Tri = !hasAssessment
        ? { kind: 'unknown', text: 'Not assessed' }
        : latest!.traceabilityRisk
            ? { kind: 'fail', text: 'Traceability issue detected' }
            : { kind: 'pass', text: 'No traceability issue' };

    const whisp: Tri = !hasAssessment
        ? { kind: 'unknown', text: 'Not assessed' }
        : latest!.whispData
            ? { kind: 'pass', text: `Whisp result ${latest!.whispData.resultId}` }
            : { kind: 'unknown', text: 'Whisp unavailable — local analysis only' };

    return (
        <div className="bg-white shadow rounded-lg p-6 mt-6">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-blue-600" />
                    LACRA Risk Analysis
                </h2>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${riskWord ? (RISK_BADGE[riskWord] || UNASSESSED_BADGE) : UNASSESSED_BADGE}`}>
                    {riskWord ? `${riskWord} Risk` : 'Not Assessed'}
                </span>
            </div>

            {/* Framing: a satellite/risk result is INPUT to EUDR due diligence,
                not a certification of compliance. */}
            <p className="text-[11.5px] text-gray-500 mb-4">
                Satellite and record checks are evidence for the EUDR due-diligence file. A low-risk result does not by itself establish EUDR compliance.
            </p>

            {historyLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Loading assessment history…
                </div>
            ) : historyError ? (
                <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-none" />
                    <span>{historyError} Indicators below are shown as Not assessed rather than assumed negative.</span>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <Tile label="Deforestation" icon={<MapIcon className="h-4 w-4 text-gray-400" />} value={deforestation} />
                        <Tile label="Legality" icon={<FileText className="h-4 w-4 text-gray-400" />} value={legality} />
                        <Tile label="Overlap" icon={<AlertTriangle className="h-4 w-4 text-gray-400" />} value={overlap} />
                        <Tile label="Traceability" icon={<Shield className="h-4 w-4 text-gray-400" />} value={traceability} />
                    </div>

                    <div className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" /> Satellite source: <Chip value={whisp} />
                    </div>

                    {latest?.details?.narrative && (
                        <details className="mb-4 text-sm">
                            <summary className="cursor-pointer text-gray-700 font-medium">Why this verdict? (satellite evidence)</summary>
                            <p className="mt-2 text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3 whitespace-pre-line">
                                {latest.details.narrative}
                            </p>
                        </details>
                    )}
                </>
            )}

            <div className="flex items-center justify-between border-t pt-4 flex-wrap gap-2">
                <div className="text-sm text-gray-500 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Last assessed: {lastAssessmentDate || latest?.details?.assessedAt
                        ? formatWhen(lastAssessmentDate || latest?.details?.assessedAt)
                        : 'Never'}
                    {lastAssessmentDate && (
                        <span className="text-gray-400">
                            ({Math.floor((Date.now() - new Date(lastAssessmentDate).getTime()) / 86_400_000)} days ago)
                        </span>
                    )}
                </div>
                <button
                    onClick={handleAssessRisk}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Analyzing…
                        </>
                    ) : (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Run New Assessment
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-none" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

const Tile: React.FC<{ label: string; icon: React.ReactNode; value: Tri }> = ({ label, icon, value }) => (
    <div className="p-4 border rounded-lg bg-gray-50">
        <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">{label}</span>
            {icon}
        </div>
        <Chip value={value} />
    </div>
);

export default FarmRiskPanel;
