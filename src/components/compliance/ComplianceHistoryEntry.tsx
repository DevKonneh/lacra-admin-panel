import React from 'react';
import { MessageSquareWarning, Banknote, ShieldAlert, ShieldX, ShieldCheck } from 'lucide-react';
import type { ComplianceAction, ComplianceActionType } from '../../api/complianceActions';

// Shared presentation + single-entry renderer for a ComplianceAction record
// (Warning/Fine/Suspend/Revoke/Reinstate). Originally built inline in
// AgencyProfile.tsx's Compliance History panel; extracted here so the same
// badge styling and entry layout can be reused anywhere a compliance
// history list needs to be shown — e.g. AgencyProfile.tsx's own panel AND
// ComplianceHistoryModal.tsx (used by the Local Produce Buyer register,
// which has no individual profile page to host a full panel on).

export const COMPLIANCE_ACTION_PRESENTATION: Record<ComplianceActionType, { label: string; Icon: React.ElementType; className: string }> = {
    WARNING: { label: 'Warning', Icon: MessageSquareWarning, className: 'bg-amber-50 text-amber-700 border-amber-200' },
    FINE: { label: 'Fine', Icon: Banknote, className: 'bg-amber-50 text-amber-700 border-amber-200' },
    SUSPEND: { label: 'Suspended', Icon: ShieldAlert, className: 'bg-orange-50 text-orange-700 border-orange-200' },
    REVOKE: { label: 'Revoked', Icon: ShieldX, className: 'bg-red-50 text-red-700 border-red-200' },
    REINSTATE: { label: 'Reinstated', Icon: ShieldCheck, className: 'bg-green-50 text-green-700 border-green-200' },
};

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ComplianceHistoryEntry: React.FC<{ action: ComplianceAction }> = ({ action: a }) => {
    const { label, Icon, className } = COMPLIANCE_ACTION_PRESENTATION[a.actionType];
    return (
        <div className="py-3 flex items-start gap-3">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border flex-shrink-0 ${className}`}>
                <Icon size={11} />
                {label}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800">{a.subjectName || 'Unknown subject'}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</p>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{a.reason}</p>
                {a.actionType === 'FINE' && a.fineAmount != null && (
                    <p className="text-xs text-amber-700 mt-0.5 font-medium">
                        Fine: {a.fineCurrency || 'LRD'} {Number(a.fineAmount).toLocaleString()} {a.finePaid ? '(Paid)' : '(Unpaid)'}
                    </p>
                )}
                <p className="text-[11px] text-slate-400 mt-0.5">By {a.performedByName || 'Staff'}</p>
            </div>
        </div>
    );
};

export default ComplianceHistoryEntry;
