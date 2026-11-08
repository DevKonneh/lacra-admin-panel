import React, { useEffect, useState } from 'react';
import { X, History, Loader2, AlertTriangle } from 'lucide-react';
import ComplianceHistoryEntry from './ComplianceHistoryEntry';
import type { ComplianceAction } from '../../api/complianceActions';

// Lightweight read-only compliance history viewer, shown as a modal rather
// than a full page panel — used by registers that have no individual
// detail/profile page of their own to host a panel on (e.g. the Local
// Produce Buyer register, unlike Agency which has AgencyProfile.tsx).
//
// Fetches lazily on open via the `onLoad` callback (so the parent decides
// which list*ComplianceActions() call to use — Buyer or, in principle,
// any other Certificate-backed subject) and re-fetches every time it is
// re-opened, so a freshly recorded action is always reflected.

interface ComplianceHistoryModalProps {
    open: boolean;
    subjectLabel: string;
    onClose: () => void;
    onLoad: () => Promise<ComplianceAction[]>;
}

const ComplianceHistoryModal: React.FC<ComplianceHistoryModalProps> = ({ open, subjectLabel, onClose, onLoad }) => {
    const [actions, setActions] = useState<ComplianceAction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError('');
                const result = await onLoad();
                if (!cancelled) setActions(result);
            } catch (err: any) {
                if (!cancelled) setError(err?.response?.data?.message || 'Failed to load compliance history.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 flex-shrink-0">
                    <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 min-w-0">
                        <History size={15} className="flex-shrink-0" />
                        <span className="truncate">Compliance History — {subjectLabel}</span>
                    </h3>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="overflow-y-auto px-4 py-2 flex-1">
                    {error ? (
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 my-2">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin text-brand-green" />
                        </div>
                    ) : actions.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-10">No compliance actions recorded yet.</p>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {actions.map((a) => (
                                <ComplianceHistoryEntry key={a.id} action={a} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-4 py-3 border-t border-slate-200 flex justify-end flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComplianceHistoryModal;
