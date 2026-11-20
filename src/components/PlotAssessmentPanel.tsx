import React, { useCallback, useEffect, useState } from 'react';
import {
    Satellite, Clock, Loader2, CheckCircle2, AlertTriangle, XCircle,
    MapPinOff, RefreshCw, CalendarClock, HelpCircle, History,
} from 'lucide-react';
import Badge, { type BadgeTone } from './ui/Badge';
import {
    getFarmPlotAssessments,
    retryPlotAssessment,
    PLOT_STATUS_LABEL,
    type FarmPlotAssessmentView,
    type PlotAssessmentView,
    type PlotAssessmentStatus,
} from '../api/assessments';

interface PlotAssessmentPanelProps {
    farmId: string;
    onAssessmentQueued?: () => void;
}

/**
 * Per-plot automatic satellite (WhISP) assessment panel.
 *
 * WHY PER PLOT, NOT PER FARM
 * --------------------------
 * A farm can hold several plots, each its own parcel with its own polygon. A
 * farm-level badge could only ever be an average — or, worse, the verdict for
 * whichever plot happened to be checked last. This panel reports each plot
 * separately, because the evidence a due-diligence file needs is "this parcel
 * was checked, on this boundary, with this result".
 *
 * THE RULE THAT MATTERS
 * ---------------------
 * `riskLevel === null` means NOT ASSESSED — never "no deforestation". A plot
 * with no verified finding gets an explicit "Not assessed" state, because the
 * alternative (a green badge for an unchecked parcel) is exactly the class of
 * fabrication this audit exists to remove. `inconclusive` is treated the same
 * way: WhISP returning `more_info_needed` means it could not decide, which is
 * not a pass.
 *
 * WHY THERE IS NO RETRY BUTTON ON "BOUNDARY REVIEW"
 * -------------------------------------------------
 * A plot parked for boundary review was never sent to WhISP: its geometry is a
 * GPS point, a generated square, missing, or invalid. Re-running would park it
 * again and change nothing. The action staff need is to correct the boundary,
 * so the panel says that instead of offering a button that cannot help.
 */
const STATUS_TONE: Record<PlotAssessmentStatus, BadgeTone> = {
    queued: 'blue',
    assessing: 'indigo',
    completed: 'green',
    failed: 'red',
    boundary_review: 'orange',
    not_queued: 'slate',
};

const STATUS_ICON: Record<PlotAssessmentStatus, React.ReactNode> = {
    queued: <Clock />,
    assessing: <Loader2 className="animate-spin" />,
    completed: <CheckCircle2 />,
    failed: <XCircle />,
    boundary_review: <MapPinOff />,
    not_queued: <HelpCircle />,
};

/**
 * Completed plots are re-toned by their actual finding, so a completed check
 * that found deforestation is not shown in the same green as a clean one.
 */
const toneFor = (plot: PlotAssessmentView): BadgeTone => {
    if (plot.status !== 'completed') return STATUS_TONE[plot.status];
    if (plot.inconclusive) return 'amber';
    if (plot.riskLevel === 'High') return 'red';
    if (plot.riskLevel === 'Medium') return 'orange';
    if (plot.riskLevel === 'Low') return 'green';
    return 'slate';
};

const formatWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

/**
 * Narrows an unknown thrown value to the API's own error message.
 *
 * `catch (err: any)` is banned by this project's lint config, and rightly so:
 * anything can be thrown, including a string or undefined. These two helpers
 * read the axios error envelope defensively instead of asserting it exists.
 */
const apiErrorMessage = (err: unknown, fallback: string): string => {
    const response = (err as { response?: { data?: { message?: string } } })?.response;
    return response?.data?.message || fallback;
};

const apiErrorStatus = (err: unknown): number | undefined =>
    (err as { response?: { status?: number } })?.response?.status;

/** Human label for the deforestation finding, never implying a pass when unsure. */
const findingLabel = (plot: PlotAssessmentView): string => {
    if (plot.inconclusive) return 'Inconclusive — WhISP could not determine a result';
    if (!plot.deforestationFinding) return 'Not assessed';
    switch (plot.deforestationFinding) {
        case 'low': return 'No deforestation signal after the 2020 cut-off';
        case 'high': return 'Deforestation signal after the 2020 cut-off';
        case 'more_info_needed': return 'Inconclusive — more information needed';
        default: return plot.deforestationFinding;
    }
};

const PlotRow: React.FC<{
    plot: PlotAssessmentView;
    onRetried: () => void;
}> = ({ plot, onRetried }) => {
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    /**
     * Retry is offered only where it can actually do something.
     *
     * NOT on 'completed': the queue deduplicates on plotId + geometry hash, so
     * re-queueing the SAME polygon returns the existing job and changes
     * nothing. Offering a "Re-check" button there would look like it worked
     * while nothing happened. A completed plot is re-assessed by correcting its
     * boundary — which bumps the hash and therefore earns a new job.
     *
     * NOT on 'boundary_review': that plot was never sent to WhISP (point,
     * generated square, missing or invalid polygon), so a retry would park it
     * again. The fix is a corrected boundary, which the panel says explicitly.
     *
     * NOT on 'queued'/'assessing': already in flight; a retry would be a no-op.
     */
    const canRetry = plot.status === 'failed' || plot.status === 'not_queued';

    const retry = async () => {
        setBusy(true);
        setNotice(null);
        try {
            const res = await retryPlotAssessment(plot.plotId);
            if (res.data.status) {
                const reason = res.data.data?.boundaryReviewReason;
                setNotice(reason || res.data.message || 'Assessment queued.');
            } else {
                setNotice(res.data.message || 'This plot could not be queued.');
            }
            onRetried();
        } catch (err) {
            setNotice(apiErrorMessage(
                err,
                'Could not queue the assessment. Please try again.',
            ));
        } finally {
            setBusy(false);
        }
    };

    return (
        <li className="px-5 py-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{plot.plotName}</p>
                        {plot.isDefault && (
                            <span className="text-xs text-gray-500">whole farm</span>
                        )}
                        <Badge tone={toneFor(plot)} icon={STATUS_ICON[plot.status]}>
                            {PLOT_STATUS_LABEL[plot.status]}
                        </Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                        {plot.areaHa != null ? `${plot.areaHa.toFixed(2)} ha · ` : ''}
                        boundary v{plot.geometryVersion || 0}
                        {plot.assessedGeometryVersion != null
                            && ` · result for v${plot.assessedGeometryVersion}`}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {canRetry && (
                        <button
                            type="button"
                            onClick={retry}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                            {busy
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <RefreshCw className="h-3.5 w-3.5" />}
                            {plot.status === 'completed' ? 'Re-check' : 'Retry'}
                        </button>
                    )}
                </div>
            </div>

            {/* The finding. Absence of a finding is stated, never implied. */}
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Deforestation finding</dt>
                    <dd className={`mt-0.5 ${plot.inconclusive ? 'text-amber-700 font-medium'
                        : plot.riskLevel === null ? 'text-gray-500'
                            : plot.riskLevel === 'High' ? 'text-red-700 font-medium'
                                : 'text-gray-900'}`}>
                        {findingLabel(plot)}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Last verified result</dt>
                    <dd className="mt-0.5 text-gray-900 flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-gray-400" />
                        {plot.assessedAt ? formatWhen(plot.assessedAt) : 'Not assessed'}
                    </dd>
                </div>
            </dl>

            {plot.narrative && (
                <p className="mt-3 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-md p-3 whitespace-pre-line">
                    {plot.narrative}
                </p>
            )}

            {/* Why nothing was assessed, or why the run failed. */}
            {plot.statusReason && (
                <div className="mt-3 flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-medium">
                            {plot.status === 'boundary_review'
                                ? 'Boundary review required'
                                : 'Latest check did not complete'}
                        </p>
                        <p className="mt-0.5">{plot.statusReason}</p>
                        {plot.status === 'boundary_review' && (
                            <p className="mt-1 text-amber-700">
                                Correct the plot boundary to allow a satellite check. Nothing
                                was sent to WhISP for this plot.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* A retryable failure that is waiting out its backoff. */}
            {plot.status === 'queued' && plot.nextAttemptAt && (
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Automatic retry at {formatWhen(plot.nextAttemptAt)}
                    {plot.attempts > 0 && ` (attempt ${plot.attempts})`}
                </p>
            )}

            {/* Prior verdicts kept because the boundary has since changed. */}
            {plot.historyCount > 0 && (
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" />
                    {plot.historyCount} earlier result{plot.historyCount === 1 ? '' : 's'} retained
                    for a previous boundary (kept for due diligence).
                </p>
            )}

            {notice && (
                <p className="mt-2 text-xs text-gray-600">{notice}</p>
            )}
        </li>
    );
};

const PlotAssessmentPanel: React.FC<PlotAssessmentPanelProps> = ({ farmId, onAssessmentQueued }) => {
    const [view, setView] = useState<FarmPlotAssessmentView | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            setError(null);
            const res = await getFarmPlotAssessments(farmId);
            if (res.data.status) {
                setView(res.data.data);
            } else {
                // A farm with no plots yet is a normal state, not an error.
                setError(res.data.message || 'Assessment status is unavailable for this farm.');
            }
        } catch (err) {
            const status = apiErrorStatus(err);
            if (status === 404) {
                setView(null);
                setError(null);
            } else {
                setError('Could not load per-plot assessment status.');
            }
        } finally {
            if (!quiet) setLoading(false);
        }
    }, [farmId]);

    useEffect(() => {
        void load();
    }, [load]);

    // While any plot is queued or being assessed, refresh so staff see the
    // result arrive without reloading the page. Stops as soon as everything is
    // terminal, so an idle farm does not poll forever.
    const inFlight = (view?.plots ?? []).some(
        (p) => p.status === 'queued' || p.status === 'assessing',
    );
    useEffect(() => {
        if (!inFlight) return;
        const timer = setInterval(() => { void load(true); }, 15_000);
        return () => clearInterval(timer);
    }, [inFlight, load]);

    const refreshAfterRetry = () => {
        void load(true);
        onAssessmentQueued?.();
    };

    return (
        <div className="bg-white shadow rounded-lg mt-6">
            <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 flex items-center gap-2">
                        <Satellite className="h-5 w-5 text-gray-400" />
                        Satellite assessment by plot
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                        Checks run automatically when a plot with a surveyed boundary is saved.
                        Results are WhISP due-diligence evidence, not a compliance certificate.
                    </p>
                </div>
                {view && view.summary.total > 0 && (
                    <p className="text-xs text-gray-500 whitespace-nowrap">
                        {view.summary.withVerifiedFinding}/{view.summary.total} verified
                    </p>
                )}
            </div>

            {loading && !view && (
                <div className="flex justify-center p-8">
                    <Loader2 className="animate-spin h-6 w-6 text-green-600" />
                </div>
            )}

            {error && !loading && (
                <div className="px-6 py-4">
                    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                        {error}
                    </p>
                </div>
            )}

            {!loading && !error && view && view.plots.length === 0 && (
                <div className="px-6 py-6">
                    <p className="text-sm text-gray-500">
                        No plots are recorded for this farm yet. Assessment starts automatically
                        once a plot with a surveyed polygon is saved.
                    </p>
                </div>
            )}

            {view && view.plots.length > 0 && (
                <>
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
                        <span>{view.summary.completed} completed</span>
                        <span>{view.summary.queued} queued</span>
                        <span>{view.summary.assessing} assessing</span>
                        <span>{view.summary.failed} failed</span>
                        <span>{view.summary.boundaryReview} boundary review</span>
                    </div>
                    <ul className="divide-y divide-gray-200">
                        {view.plots.map((plot) => (
                            <PlotRow
                                key={plot.plotId}
                                plot={plot}
                                onRetried={refreshAfterRetry}
                            />
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
};

export default PlotAssessmentPanel;
