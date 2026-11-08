import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ShieldOff, ShieldX, ShieldAlert, HelpCircle, Calendar, MapPin, User, Loader2 } from 'lucide-react';
import { verifyAgencyToken, type PublicAgencyVerificationResult } from '../api/agencies';

// Public, no-auth QR-verification landing page for Agency permits — the
// mobile-friendly counterpart to LocalProduceBuyerVerify.tsx (left
// untouched), reached via GET /api/public/agencies/verify/:token
// (PermitVerificationController.verifyAgencyToken), which requires no
// authentication and returns only the approved public field whitelist
// (permitNumber, buyerName [the Agency's legal name], county, issueDate,
// expiryDate, status) — see PermitVerificationService.toPublicPermitView()
// on the backend, the single source of truth for what's ever exposed here.
//
// A held/blocked Agency record and a genuinely nonexistent token return
// the EXACT SAME 404 response from the backend (deliberately — a held
// record's existence must not be revealed), so this page renders the same
// generic "Not Verified" result for both, exactly like
// LocalProduceBuyerVerify.tsx.
const AgencyVerify: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [result, setResult] = useState<PublicAgencyVerificationResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!token) return;
        verifyAgencyToken(token)
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

    const formatDate = (value: string | null) => {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
                <div className="flex flex-col items-center gap-3 text-slate-500 text-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-green" />
                    Verifying agency permit…
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
                                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">LACRA Agency Verification</p>
                                <h1 className="text-lg font-bold leading-tight">Not Verified</h1>
                            </div>
                        </div>
                        <div className="p-5 text-center space-y-2">
                            <p className="text-sm text-slate-600">
                                This Agency permit could not be verified. The QR code may be invalid, or the record is
                                not currently available for public verification.
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
        PublicAgencyVerificationResult['status'],
        { label: string; headerClass: string; badgeClass: string; Icon: React.ElementType }
    > = {
        VALID: { label: 'Valid Agency Permit', headerClass: 'bg-green-600', badgeClass: 'bg-green-50 text-green-800 border border-green-200', Icon: ShieldCheck },
        EXPIRED: { label: 'Expired', headerClass: 'bg-slate-500', badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200', Icon: ShieldOff },
        SUSPENDED: { label: 'Suspended', headerClass: 'bg-orange-600', badgeClass: 'bg-orange-50 text-orange-800 border border-orange-200', Icon: ShieldAlert },
        REVOKED: { label: 'Revoked', headerClass: 'bg-red-600', badgeClass: 'bg-red-50 text-red-800 border border-red-200', Icon: ShieldX },
        PENDING: { label: 'Pending', headerClass: 'bg-blue-600', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200', Icon: HelpCircle },
        NOT_YET_ISSUED: { label: 'Pending', headerClass: 'bg-blue-600', badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200', Icon: HelpCircle },
    };

    const presentation = STATUS_PRESENTATION[result.status] || STATUS_PRESENTATION.PENDING;
    const { label, headerClass, badgeClass, Icon } = presentation;

    return (
        <div className="min-h-screen bg-brand-bg py-6 px-4 flex items-start sm:items-center justify-center">
            <div className="max-w-sm w-full space-y-3">
                <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
                    <div className={`px-5 py-5 ${headerClass} text-white`}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">LACRA Agency Verification</p>
                        <div className="flex items-center gap-2.5 mt-1">
                            <Icon className="h-8 w-8 flex-shrink-0" aria-hidden="true" />
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

                        <dl className="space-y-3 text-sm border-t border-slate-100 pt-4">
                            <div className="flex justify-between gap-3">
                                <dt className="text-slate-500 flex items-center gap-1.5"><User size={14} /> Agency Name</dt>
                                <dd className="text-slate-900 font-medium text-right">{result.buyerName || '—'}</dd>
                            </div>
                            {result.county && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-slate-500 flex items-center gap-1.5"><MapPin size={14} /> County</dt>
                                    <dd className="text-slate-900 font-medium text-right">{result.county}</dd>
                                </div>
                            )}
                            {result.issueDate && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-slate-500 flex items-center gap-1.5"><Calendar size={14} /> Issue Date</dt>
                                    <dd className="text-slate-900 font-medium text-right">{formatDate(result.issueDate)}</dd>
                                </div>
                            )}
                            {result.expiryDate && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-slate-500 flex items-center gap-1.5"><Calendar size={14} /> Expiry Date</dt>
                                    <dd className="text-slate-900 font-medium text-right">{formatDate(result.expiryDate)}</dd>
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

export default AgencyVerify;
