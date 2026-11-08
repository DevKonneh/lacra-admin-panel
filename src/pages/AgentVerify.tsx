import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ShieldOff, ShieldX, ShieldAlert, HelpCircle, UserX, MapPin, Building2, User, Loader2 } from 'lucide-react';
import { verifyAgentToken, type PublicAgentVerificationResult } from '../api/agencies';

// Public, no-auth QR-verification landing page for an INDIVIDUAL Agent (or
// Clerk) permit token — the per-person counterpart to AgencyVerify.tsx,
// reached via GET /api/public/agents/verify/:token
// (PermitVerificationController.verifyAgentToken). Requires no
// authentication and returns only the approved public field whitelist
// (permitNumber, agentName, role, county, agencyName, agencyStatus,
// status) — see PermitVerificationService.toPublicAgentView() on the
// backend, the single source of truth for what's ever exposed here.
//
// IMPORTANT: `status` here is a PublicAgentStatus, which is the parent
// Agency's AgencyPermitStatus PLUS an extra 'AGENT_NOT_ACTIVE' value that
// the Agency-level page never needs to handle. A deactivated/replaced
// Agent's QR will show AGENT_NOT_ACTIVE even while the parent Agency
// itself remains VALID — this is the public-facing surface that proves a
// removed Agent's QR no longer verifies them as currently authorized,
// even though the shared permit number (and the Agency itself) is
// unaffected.
//
// A held/blocked Agent record and a genuinely nonexistent token return the
// EXACT SAME 404 response from the backend (deliberately — a held
// record's existence must not be revealed), so this page renders the same
// generic "Not Verified" result for both, exactly like AgencyVerify.tsx /
// LocalProduceBuyerVerify.tsx.
const AgentVerify: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [result, setResult] = useState<PublicAgentVerificationResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!token) return;
        verifyAgentToken(token)
            .then((res) => {
                if (res.data.success && res.data.data) {
                    setResult(res.data.data);
                } else {
                    setNotFound(true);
                }
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [token]);

    const formatDate = (value: string) => {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
                <div className="flex flex-col items-center gap-3 text-slate-500 text-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
                    Verifying agent credential…
                </div>
            </div>
        );
    }

    if (notFound || !result) {
        return (
            <div className="min-h-screen bg-brand-bg flex items-start sm:items-center justify-center px-4 py-8">
                <div className="max-w-sm w-full space-y-3">
                    <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-5 flex items-center gap-3 bg-slate-600 text-white">
                            <HelpCircle className="h-9 w-9 flex-shrink-0" aria-hidden="true" />
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">LACRA Agent Verification</p>
                                <h1 className="text-lg font-bold leading-tight">Not Verified</h1>
                            </div>
                        </div>
                        <div className="p-5 text-center space-y-2">
                            <p className="text-sm text-slate-600">
                                This Agent credential could not be verified. The QR code may be invalid, or the record
                                is not currently available for public verification.
                            </p>
                        </div>
                    </div>
                    <p className="text-center text-xs text-slate-400 px-4">
                        Liberia Agricultural Commodity Regulatory Authority (LACRA)
                    </p>
                </div>
            </div>
        );
    }

    const STATUS_PRESENTATION: Record<
        PublicAgentVerificationResult['status'],
        { label: string; headerClass: string; badgeClass: string; Icon: React.ElementType; note?: string }
    > = {
        VALID: { label: 'Valid Agent Credential', headerClass: 'bg-green-600', badgeClass: 'bg-green-50 text-green-800 border border-green-200', Icon: ShieldCheck },
        // A deactivated/replaced individual — the Agency's own permit may
        // still be VALID, which is why this gets its own distinct status
        // and icon rather than falling back to the Agency's status.
        AGENT_NOT_ACTIVE: {
            label: 'Not an Active Agent',
            headerClass: 'bg-red-600',
            badgeClass: 'bg-red-50 text-red-800 border border-red-200',
            Icon: UserX,
            note: 'This individual is no longer an active Agent or Clerk with this Agency. Their credential has been deactivated or replaced.',
        },
        EXPIRED: { label: 'Agency Permit Expired', headerClass: 'bg-slate-500', badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200', Icon: ShieldOff },
        SUSPENDED: { label: 'Agency Permit Suspended', headerClass: 'bg-orange-600', badgeClass: 'bg-orange-50 text-orange-800 border border-orange-200', Icon: ShieldAlert },
        REVOKED: { label: 'Agency Permit Revoked', headerClass: 'bg-red-600', badgeClass: 'bg-red-50 text-red-800 border border-red-200', Icon: ShieldX },
        PENDING: { label: 'Pending', headerClass: 'bg-blue-600', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200', Icon: HelpCircle },
        NOT_YET_ISSUED: { label: 'Pending', headerClass: 'bg-blue-600', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200', Icon: HelpCircle },
    };

    const presentation = STATUS_PRESENTATION[result.status] || STATUS_PRESENTATION.PENDING;
    const { label, headerClass, badgeClass, Icon, note } = presentation;

    return (
        <div className="min-h-screen bg-brand-bg py-6 px-4 flex items-start sm:items-center justify-center">
            <div className="max-w-sm w-full space-y-3">
                <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
                    <div className={`px-5 py-5 ${headerClass} text-white`}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">LACRA Agent Verification</p>
                        <div className="flex items-center gap-2.5 mt-1">
                            {result.photoUrl ? (
                                <img
                                    src={result.photoUrl}
                                    alt={result.agentName}
                                    className="h-10 w-10 rounded-full object-cover flex-shrink-0 border-2 border-white/40 bg-white"
                                />
                            ) : (
                                <Icon className="h-8 w-8 flex-shrink-0" aria-hidden="true" />
                            )}
                            <div className="min-w-0">
                                <h1 className="text-xl font-bold leading-tight">{label}</h1>
                                <p className="text-sm opacity-90 font-mono truncate">{result.permitNumber}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500">Status</span>
                            <span className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full ${badgeClass}`}>
                                <Icon size={13} />
                                {label}
                            </span>
                        </div>

                        {note && (
                            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                {note}
                            </p>
                        )}

                        <dl className="space-y-3 text-sm border-t border-slate-100 pt-4">
                            <div className="flex justify-between gap-3">
                                <dt className="text-slate-500 flex items-center gap-1.5"><User size={14} /> Name</dt>
                                <dd className="text-slate-900 font-medium text-right">{result.agentName || '—'}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-slate-500 flex items-center gap-1.5"><ShieldCheck size={14} /> Role</dt>
                                <dd className="text-slate-900 font-medium text-right">Agent</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-slate-500 flex items-center gap-1.5"><Building2 size={14} /> Agency</dt>
                                <dd className="text-slate-900 font-medium text-right">{result.agencyName || '—'}</dd>
                            </div>
                            {result.county && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-slate-500 flex items-center gap-1.5"><MapPin size={14} /> County</dt>
                                    <dd className="text-slate-900 font-medium text-right">{result.county}</dd>
                                </div>
                            )}
                        </dl>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-400 px-4">
                    Liberia Agricultural Commodity Regulatory Authority (LACRA) <br />
                    Verified on {formatDate(new Date().toISOString())}
                </p>
            </div>
        </div>
    );
};

export default AgentVerify;
