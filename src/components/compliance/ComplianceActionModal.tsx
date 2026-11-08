import React, { useState } from 'react';
import { X, AlertTriangle, Loader2, ShieldAlert, ShieldX, ShieldCheck, Banknote, MessageSquareWarning } from 'lucide-react';
import type { ComplianceActionType } from '../../api/complianceActions';

// Shared, reusable compliance-action confirmation modal — used by both the
// Agency Register and the Local Produce Buyer Register (and, for Agency,
// the individual Agent/Clerk rows too), so the Warning/Fine/Suspend/
// Revoke/Reinstate flow looks and behaves identically everywhere instead
// of duplicating a bespoke form per register.
//
// A staff-entered `reason` is ALWAYS required (mirrors the backend's own
// enforcement in ComplianceActionService — "A reason is required for every
// compliance action.") so validation here is just a head start on instant
// feedback, not a substitute for the server-side check.
// FINE additionally requires a positive amount.

const ACTION_PRESENTATION: Record<
    ComplianceActionType,
    { title: string; confirmLabel: string; Icon: React.ElementType; accent: string; description: string }
> = {
    WARNING: {
        title: 'Issue a Warning',
        confirmLabel: 'Issue Warning',
        Icon: MessageSquareWarning,
        accent: 'bg-amber-50 text-amber-700 border-amber-200',
        description: 'Records a formal warning against this record. Does not change its permit status.',
    },
    FINE: {
        title: 'Issue a Fine',
        confirmLabel: 'Issue Fine',
        Icon: Banknote,
        accent: 'bg-amber-50 text-amber-700 border-amber-200',
        description: 'Records a monetary fine against this record. Does not change its permit status.',
    },
    SUSPEND: {
        title: 'Suspend Permit',
        confirmLabel: 'Suspend',
        Icon: ShieldAlert,
        accent: 'bg-orange-50 text-orange-700 border-orange-200',
        description: 'Immediately suspends this permit. The public QR-verification page will show "Suspended" until reinstated.',
    },
    REVOKE: {
        title: 'Revoke Permit',
        confirmLabel: 'Revoke',
        Icon: ShieldX,
        accent: 'bg-red-50 text-red-700 border-red-200',
        description: 'Permanently revokes this permit. This action is FINAL and cannot be reversed or reinstated.',
    },
    REINSTATE: {
        title: 'Reinstate Permit',
        confirmLabel: 'Reinstate',
        Icon: ShieldCheck,
        accent: 'bg-green-50 text-green-700 border-green-200',
        description: 'Lifts the suspension and restores this permit to its normal issued status.',
    },
};

interface ComplianceActionModalProps {
    open: boolean;
    actionType: ComplianceActionType;
    subjectLabel: string;
    onClose: () => void;
    onSubmit: (payload: { reason: string; fineAmount?: number; fineCurrency?: string }) => Promise<void>;
}

const ComplianceActionModal: React.FC<ComplianceActionModalProps> = ({
    open,
    actionType,
    subjectLabel,
    onClose,
    onSubmit,
}) => {
    const [reason, setReason] = useState('');
    const [fineAmount, setFineAmount] = useState('');
    const [fineCurrency, setFineCurrency] = useState('LRD');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!open) return null;

    const presentation = ACTION_PRESENTATION[actionType];
    const { title, confirmLabel, Icon, accent, description } = presentation;
    const isFine = actionType === 'FINE';
    const isDestructive = actionType === 'REVOKE' || actionType === 'SUSPEND';

    const handleClose = () => {
        if (submitting) return;
        setReason('');
        setFineAmount('');
        setFineCurrency('LRD');
        setError(null);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedReason = reason.trim();
        if (!trimmedReason) {
            setError('Please enter a reason for this action — it will be recorded in the compliance history.');
            return;
        }
        let parsedAmount: number | undefined;
        if (isFine) {
            parsedAmount = Number(fineAmount);
            if (!fineAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
                setError('Please enter a valid fine amount greater than zero.');
                return;
            }
        }

        try {
            setSubmitting(true);
            await onSubmit({
                reason: trimmedReason,
                ...(isFine ? { fineAmount: parsedAmount, fineCurrency: fineCurrency.trim() || 'LRD' } : {}),
            });
            handleClose();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Failed to record this action. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-slate-900/50" onClick={handleClose} />
            <form
                onSubmit={handleSubmit}
                className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
            >
                <div className={`px-5 py-4 border-b flex items-start gap-3 ${accent}`}>
                    <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-bold leading-tight">{title}</h2>
                        <p className="text-xs mt-0.5 opacity-90 truncate">{subjectLabel}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex-shrink-0 text-current opacity-70 hover:opacity-100"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <p className="text-xs text-slate-500">{description}</p>

                    {isDestructive && (
                        <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                            <span>
                                {actionType === 'REVOKE'
                                    ? 'Revocation is permanent and cannot be undone or reinstated later.'
                                    : 'This will immediately mark the permit as Suspended on the public verification page.'}
                            </span>
                        </div>
                    )}

                    {isFine && (
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Fine Amount *</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={fineAmount}
                                    onChange={(e) => setFineAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
                                <input
                                    type="text"
                                    value={fineCurrency}
                                    onChange={(e) => setFineCurrency(e.target.value.toUpperCase())}
                                    maxLength={3}
                                    className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                            Reason / Comment *
                            <span className="font-normal text-slate-400"> — explain why this action is being taken</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            placeholder="e.g. Failed to report monthly collection volumes for two consecutive months."
                            className="w-full border border-slate-300 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 resize-none"
                            autoFocus={!isFine}
                        />
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 ${
                            isDestructive ? 'bg-red-600 hover:bg-red-700' : actionType === 'REINSTATE' ? 'bg-green-600 hover:bg-green-700' : 'bg-brand-green hover:bg-brand-green-hover'
                        }`}
                    >
                        {submitting && <Loader2 size={14} className="animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ComplianceActionModal;
