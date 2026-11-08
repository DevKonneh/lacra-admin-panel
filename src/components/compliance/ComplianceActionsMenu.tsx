import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical, MessageSquareWarning, Banknote, ShieldAlert, ShieldX, ShieldCheck } from 'lucide-react';
import type { ComplianceActionType } from '../../api/complianceActions';
import ComplianceActionModal from './ComplianceActionModal';

// Shared "⋮ Actions" dropdown (Warning / Fine / Suspend / Revoke /
// Reinstate) used by both the Agency Register and Local Produce Buyer
// Register list rows. Only ADMIN users see this menu at all (gated by the
// caller passing `visible={isAdmin}`), matching the existing
// Historical-Import-tool admin gating pattern already used on both
// registers.
//
// `currentStatus` determines which actions are offered: REINSTATE only
// when currently SUSPENDED; SUSPEND/REVOKE hidden once already REVOKED
// (revocation is terminal) — mirrors ComplianceActionService's own
// server-side transition rules, so the UI never offers an action the
// backend would reject anyway.

interface ComplianceActionsMenuProps {
    visible: boolean;
    subjectLabel: string;
    // For a Certificate (Agency/Local Produce Buyer): the live permit
    // status — 'VALID' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED' | 'PENDING' |
    // 'NOT_YET_ISSUED'. For an individual Agent/Clerk (AgentPersonnel):
    // their own status — 'ACTIVE' | 'INACTIVE' | 'REPLACED'. The two
    // status vocabularies are distinguished via `statusDomain` so each
    // gets the correct SUSPEND/REVOKE/REINSTATE availability rules,
    // mirroring ComplianceActionService's own per-domain transition logic
    // on the backend (applyToCertificate vs. applyToAgentPersonnel).
    currentStatus: string;
    statusDomain?: 'CERTIFICATE' | 'PERSONNEL';
    onAction: (actionType: ComplianceActionType, payload: { reason: string; fineAmount?: number; fineCurrency?: string }) => Promise<void>;
    align?: 'left' | 'right';
}

const ComplianceActionsMenu: React.FC<ComplianceActionsMenuProps> = ({
    visible,
    subjectLabel,
    currentStatus,
    statusDomain = 'CERTIFICATE',
    onAction,
    align = 'right',
}) => {
    const [open, setOpen] = useState(false);
    const [activeAction, setActiveAction] = useState<ComplianceActionType | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    if (!visible) return null;

    const menuItems: { type: ComplianceActionType; label: string; Icon: React.ElementType; className: string }[] = [
        { type: 'WARNING', label: 'Issue Warning', Icon: MessageSquareWarning, className: 'text-amber-700' },
        { type: 'FINE', label: 'Issue Fine', Icon: Banknote, className: 'text-amber-700' },
    ];

    if (statusDomain === 'PERSONNEL') {
        // AgentPersonnel only has ACTIVE/INACTIVE/REPLACED — REVOKE is not
        // terminal here in the same database-constraint sense as a
        // Certificate's REVOKED status (both SUSPEND and REVOKE map to
        // INACTIVE server-side), so SUSPEND/REVOKE are offered only while
        // ACTIVE, and REINSTATE only while INACTIVE — exactly matching
        // applyToAgentPersonnel()'s own guard clauses.
        const isActive = currentStatus === 'ACTIVE';
        const isInactive = currentStatus === 'INACTIVE';
        if (isActive) {
            menuItems.push({ type: 'SUSPEND', label: 'Suspend', Icon: ShieldAlert, className: 'text-orange-700' });
            menuItems.push({ type: 'REVOKE', label: 'Revoke', Icon: ShieldX, className: 'text-red-700' });
        }
        if (isInactive) {
            menuItems.push({ type: 'REINSTATE', label: 'Reinstate', Icon: ShieldCheck, className: 'text-green-700' });
        }
    } else {
        const isRevoked = currentStatus === 'REVOKED';
        const isSuspended = currentStatus === 'SUSPENDED';
        if (!isRevoked && !isSuspended) {
            menuItems.push({ type: 'SUSPEND', label: 'Suspend', Icon: ShieldAlert, className: 'text-orange-700' });
        }
        if (isSuspended) {
            menuItems.push({ type: 'REINSTATE', label: 'Reinstate', Icon: ShieldCheck, className: 'text-green-700' });
        }
        if (!isRevoked) {
            menuItems.push({ type: 'REVOKE', label: 'Revoke', Icon: ShieldX, className: 'text-red-700' });
        }
    }

    return (
        <div className="relative inline-block text-left" ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                aria-label="Compliance actions"
                title="Compliance actions"
            >
                <MoreVertical size={16} />
            </button>

            {open && (
                <div
                    className={`absolute z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1 ${
                        align === 'right' ? 'right-0' : 'left-0'
                    }`}
                >
                    {menuItems.map(({ type, label, Icon, className }) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                setActiveAction(type);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50 ${className}`}
                        >
                            <Icon size={13} className="flex-shrink-0" />
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {activeAction && (
                <ComplianceActionModal
                    open={!!activeAction}
                    actionType={activeAction}
                    subjectLabel={subjectLabel}
                    onClose={() => setActiveAction(null)}
                    onSubmit={(payload) => onAction(activeAction, payload)}
                />
            )}
        </div>
    );
};

export default ComplianceActionsMenu;
