import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Search,
    X,
    AlertTriangle,
    QrCode,
    Lock,
    Loader2,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    Users,
    FileWarning,
    Inbox,
} from 'lucide-react';
import {
    getLocalProduceBuyers,
    getLocalProduceBuyerCounties,
    downloadLocalProduceBuyerQrCode,
    type LocalProduceBuyerRecord,
    type LocalProduceBuyerStatus,
} from '../../api/localProduceBuyers';
import PageHeader from '../../components/ui/PageHeader';

// Local Produce Buyers register — sits alongside (NOT inside) the existing
// Permit Management page/api module, per the standing instruction to never
// touch src/pages/permits/PermitList.tsx or src/api/permits.ts in this
// phase. This page is the admin-facing view of the backend's
// GET /api/local-produce-buyers listing (see LocalProduceBuyerController),
// which already computes live status (VALID/EXPIRED/SUSPENDED/REVOKED/
// PENDING) server-side per Africa/Monrovia civil-date rules.
//
// The register is small (83 historical records total, growing slowly from
// here), so the whole set is fetched in one page-sized call and all
// filtering (search, county, status, and the "Held" view) happens
// client-side. This is a deliberate simplification over a server-paginated
// table: it guarantees held/blocked records are never dropped by a page
// boundary, and the "Held" filter has no server-side equivalent anyway
// (isPubliclyBlocked can accompany ANY underlying computed status).
const PAGE_FETCH_SIZE = 200;

// A held record carries "Held for review" as its own, higher-priority
// status, display-only — it is never sent to the backend's `status` query
// param (which only ever understands VALID/EXPIRED/SUSPENDED/REVOKED/
// PENDING). isPubliclyBlocked can co-occur with ANY computed status
// underneath (e.g. a held record can still be within its validity window),
// which is exactly the bug the register must never hide: a permit must
// show "Held for review" as primary even while technically VALID/not yet
// expired, because the hold is what actually governs public visibility.
type DisplayStatus = LocalProduceBuyerStatus | 'HELD';
type StatusFilter = 'ALL' | DisplayStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'All statuses' },
    { value: 'VALID', label: 'Valid' },
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'HELD', label: 'Held for review' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'REVOKED', label: 'Revoked' },
    { value: 'PENDING', label: 'Pending' },
];

function displayStatus(r: LocalProduceBuyerRecord): DisplayStatus {
    // A hold always takes visual/semantic priority over the underlying
    // computed status — see the type comment above.
    return r.isPubliclyBlocked ? 'HELD' : r.status;
}

// Text + color together (never color alone), per the requirement that the
// status must be clear at a glance without relying on hue perception.
const STATUS_BADGE: Record<DisplayStatus, { label: string; className: string; Icon: React.ElementType }> = {
    VALID: { label: 'Valid', className: 'bg-green-50 text-green-800 border border-green-200', Icon: CheckCircle2 },
    EXPIRED: { label: 'Expired', className: 'bg-slate-100 text-slate-600 border border-slate-200', Icon: XCircle },
    HELD: { label: 'Held for review', className: 'bg-amber-100 text-amber-900 border border-amber-300', Icon: ShieldAlert },
    SUSPENDED: { label: 'Suspended', className: 'bg-orange-50 text-orange-800 border border-orange-200', Icon: AlertTriangle },
    REVOKED: { label: 'Revoked', className: 'bg-red-50 text-red-800 border border-red-200', Icon: XCircle },
    PENDING: { label: 'Pending', className: 'bg-blue-50 text-blue-700 border border-blue-200', Icon: FileWarning },
    NOT_YET_ISSUED: { label: 'Not Yet Issued', className: 'bg-slate-100 text-slate-600 border border-slate-200', Icon: FileWarning },
};

// "18 May 2027" — day, full month name, year. Used everywhere a permit
// date is shown (register table, cards, and the public verify page) so
// dates read identically across the whole feature.
function formatDate(value: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const StatusBadge: React.FC<{ status: DisplayStatus; className?: string }> = ({ status, className = '' }) => {
    const { label, className: cls, Icon } = STATUS_BADGE[status];
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cls} ${className}`}>
            <Icon size={12} className="flex-shrink-0" />
            {label}
        </span>
    );
};

const SummaryCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    accent: string;
    onClick?: () => void;
    active?: boolean;
}> = ({ icon, label, value, accent, onClick, active }) => {
    const Comp: any = onClick ? 'button' : 'div';
    return (
        <Comp
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`bg-white rounded-xl border p-4 flex items-center gap-3 text-left transition-colors ${
                onClick ? 'hover:border-brand-green/50 hover:bg-brand-green/[0.03] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green' : ''
            } ${active ? 'border-brand-green ring-1 ring-brand-green/30' : 'border-slate-200'}`}
        >
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>{icon}</div>
            <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
                <p className="text-xl font-bold text-brand-text leading-tight tabular-nums">{value}</p>
            </div>
        </Comp>
    );
};

const TableSkeleton: React.FC = () => (
    <>
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
                <tbody className="divide-y divide-slate-100 bg-white">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                            {Array.from({ length: 6 }).map((__, j) => (
                                <td key={j} className="px-4 py-4">
                                    <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse" />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <div className="md:hidden space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3.5 w-full bg-slate-200 rounded animate-pulse" />
                </div>
            ))}
        </div>
    </>
);

const LocalProduceBuyerRegister: React.FC = () => {
    const [records, setRecords] = useState<LocalProduceBuyerRecord[]>([]);
    const [counties, setCounties] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [countyFilter, setCountyFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);

    useEffect(() => {
        load();
        getLocalProduceBuyerCounties()
            .then((res) => setCounties(res.data.data || []))
            .catch(() => {
                /* Non-fatal — the county dropdown simply stays empty. */
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const load = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getLocalProduceBuyers({ page: 1, pageSize: PAGE_FETCH_SIZE });
            setRecords(res.data.data?.records || []);
        } catch (err: any) {
            if (err?.response?.status === 401) {
                setError('Your session has expired. Please log in again.');
            } else {
                setError('Failed to load the Local Produce Buyer register. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Summary counts over the FULL register (not the filtered view) — held
    // records are counted separately and excluded from Valid, per the
    // requirement that a held permit must never be counted as Valid even
    // while it is technically within its validity window.
    const summary = useMemo(() => {
        let valid = 0, expired = 0, held = 0;
        for (const r of records) {
            if (r.isPubliclyBlocked) { held++; continue; }
            if (r.status === 'VALID') valid++;
            else if (r.status === 'EXPIRED') expired++;
        }
        return { total: records.length, valid, expired, held };
    }, [records]);

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return records.filter((r) => {
            if (term) {
                const haystack = [r.buyerName, r.permitNumber, r.stagedPermitNumber]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(term)) return false;
            }
            if (countyFilter !== 'ALL' && r.county !== countyFilter) return false;
            if (statusFilter !== 'ALL' && displayStatus(r) !== statusFilter) return false;
            return true;
        });
    }, [records, searchTerm, countyFilter, statusFilter]);

    const hasActiveFilters = !!searchTerm || countyFilter !== 'ALL' || statusFilter !== 'ALL';
    const clearFilters = () => {
        setSearchTerm('');
        setCountyFilter('ALL');
        setStatusFilter('ALL');
    };

    const handleDownloadQr = async (record: LocalProduceBuyerRecord) => {
        if (record.isPubliclyBlocked || !record.hasVerificationToken) return;
        try {
            setDownloadError(null);
            setDownloadSuccessId(null);
            setDownloadingId(record.id);
            const res = await downloadLocalProduceBuyerQrCode(record.id);
            const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'image/png' }));
            const link = document.createElement('a');
            const safeName = (record.buyerName || 'permit').replace(/[^a-zA-Z0-9]+/g, '_');
            link.href = blobUrl;
            link.download = `${safeName}_Permit_${record.permitNumber}_QR.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
            setDownloadSuccessId(record.id);
            window.setTimeout(() => setDownloadSuccessId((cur) => (cur === record.id ? null : cur)), 3000);
        } catch (err: any) {
            setDownloadError(
                err?.response?.data?.message || 'Failed to download the QR code for this permit. Please try again.'
            );
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <div className="space-y-5">
            <PageHeader
                breadcrumb={[{ label: 'Licensing & Permits' }, { label: 'Local Produce Buyers' }]}
                title="Local Produce Buyers"
                description="Issued Local Produce Buyer permit register — historical imports and live issuances, with public QR verification."
            />

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryCard
                    icon={<Users className="h-5 w-5 text-brand-green" />}
                    label="Total Buyers"
                    value={loading ? '—' : summary.total}
                    accent="bg-brand-green/10"
                />
                <SummaryCard
                    icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
                    label="Valid"
                    value={loading ? '—' : summary.valid}
                    accent="bg-green-50"
                    onClick={() => setStatusFilter('VALID')}
                    active={statusFilter === 'VALID'}
                />
                <SummaryCard
                    icon={<XCircle className="h-5 w-5 text-slate-500" />}
                    label="Expired"
                    value={loading ? '—' : summary.expired}
                    accent="bg-slate-100"
                    onClick={() => setStatusFilter('EXPIRED')}
                    active={statusFilter === 'EXPIRED'}
                />
                <SummaryCard
                    icon={<ShieldAlert className="h-5 w-5 text-amber-600" />}
                    label="Held for Review"
                    value={loading ? '—' : summary.held}
                    accent="bg-amber-100"
                    onClick={() => setStatusFilter('HELD')}
                    active={statusFilter === 'HELD'}
                />
            </div>
            <p className="text-[11px] text-slate-500 -mt-2.5">
                Held records are counted separately and excluded from Valid, even if their dates are still within range.
            </p>

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                    <button
                        onClick={load}
                        className="flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                    >
                        Try Again
                    </button>
                </div>
            ) : null}

            <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
                {/* Toolbar: search + county + status in one row */}
                <div className="p-3 border-b border-slate-200 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                        <div className="relative flex-1 min-w-[200px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-9 pr-8 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 text-sm"
                                placeholder="Search by buyer name or permit number"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    aria-label="Clear search"
                                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                                >
                                    <X size={15} />
                                </button>
                            )}
                        </div>
                        <select
                            className="border border-slate-300 rounded-md py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                            value={countyFilter}
                            onChange={(e) => setCountyFilter(e.target.value)}
                        >
                            <option value="ALL">All counties</option>
                            {counties.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <select
                            className="border border-slate-300 rounded-md py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                        >
                            {STATUS_FILTERS.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        {!loading && !error && (
                            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Users size={14} /> Showing {filtered.length} of {records.length} buyers
                            </span>
                        )}
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2"
                            >
                                <X size={12} /> Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {downloadError && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 flex items-center justify-between gap-2">
                        <span>{downloadError}</span>
                        <button onClick={() => setDownloadError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={14} /></button>
                    </div>
                )}

                <div className="p-2.5">
                    {loading ? (
                        <TableSkeleton />
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-10 px-4 text-center">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <Inbox size={20} />
                            </div>
                            <p className="text-sm font-medium text-slate-700">
                                {records.length === 0 ? 'No Local Produce Buyer records yet' : 'No records match your search or filters'}
                            </p>
                            {records.length > 0 && hasActiveFilters && (
                                <button onClick={clearFilters} className="mt-1 text-xs font-medium text-brand-green hover:underline">
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Buyer / Permit No.</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">County</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Issuance</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Expiration</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                                            <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-600 uppercase tracking-wide">QR Code</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {filtered.map((r) => (
                                            <RegisterRow
                                                key={r.id}
                                                record={r}
                                                downloading={downloadingId === r.id}
                                                justDownloaded={downloadSuccessId === r.id}
                                                onDownload={() => handleDownloadQr(r)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="md:hidden space-y-2.5">
                                {filtered.map((r) => (
                                    <RegisterCard
                                        key={r.id}
                                        record={r}
                                        downloading={downloadingId === r.id}
                                        justDownloaded={downloadSuccessId === r.id}
                                        onDownload={() => handleDownloadQr(r)}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <p className="text-xs text-slate-400">
                Need to manage issued permits for Local Buyers, Agencies, or Cooperatives generally? Use{' '}
                <Link to="/permits" className="text-brand-green hover:underline">Permit Management</Link>.
            </p>
        </div>
    );
};

const QrAction: React.FC<{
    record: LocalProduceBuyerRecord;
    downloading: boolean;
    justDownloaded: boolean;
    onDownload: () => void;
    align?: 'left' | 'right';
}> = ({ record, downloading, justDownloaded, onDownload, align = 'right' }) => {
    if (record.isPubliclyBlocked) {
        return (
            <span
                className={`inline-flex items-center gap-1 text-xs font-medium text-amber-700 ${align === 'right' ? 'justify-end' : ''}`}
                title="Permit numbers are shared/disputed while this record is held for review — resolve the hold before issuing a scannable QR."
            >
                <Lock size={13} /> Unavailable while held
            </span>
        );
    }
    if (!record.hasVerificationToken) {
        return (
            <span className={`inline-flex items-center gap-1 text-xs text-slate-400 ${align === 'right' ? 'justify-end' : ''}`}>
                <Lock size={13} /> No QR issued
            </span>
        );
    }
    if (justDownloaded) {
        return (
            <span className={`inline-flex items-center gap-1 text-xs font-medium text-green-700 ${align === 'right' ? 'justify-end' : ''}`}>
                <CheckCircle2 size={13} /> Downloaded
            </span>
        );
    }
    return (
        <button
            onClick={onDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 text-brand-green hover:text-brand-green-hover text-sm font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded px-1 -mx-1"
        >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
            Download QR
        </button>
    );
};

const RegisterRow: React.FC<{
    record: LocalProduceBuyerRecord;
    downloading: boolean;
    justDownloaded: boolean;
    onDownload: () => void;
}> = ({ record: r, downloading, justDownloaded, onDownload }) => {
    const held = r.isPubliclyBlocked;
    return (
        <tr className={held ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-slate-50'}>
            <td className="px-4 py-3.5 align-top">
                {/* Buyer name + permit number get visual priority: name is
                    the largest/boldest text in the row, permit number is
                    monospaced directly beneath it (not buried in its own
                    column), so both are readable together at a glance. */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-brand-text">{r.buyerName}</span>
                    {r.isAgent && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-100 text-indigo-700">AGENT</span>}
                    {r.isRenewal && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-700">RENEWAL</span>}
                </div>
                <div className="text-sm font-mono text-slate-600 mt-0.5">
                    {r.permitNumber || <span className="text-slate-400 italic font-sans">Staged: {r.stagedPermitNumber}</span>}
                </div>
                {held && r.publicBlockReason && (
                    <div className="mt-1.5 flex items-start gap-1 text-xs text-amber-800 max-w-sm">
                        <Lock size={12} className="flex-shrink-0 mt-0.5" />
                        <span>{r.publicBlockReason}</span>
                    </div>
                )}
            </td>
            <td className="px-4 py-3.5 align-top text-sm text-slate-600 whitespace-nowrap">
                {r.county || '—'}
                {r.locality ? <span className="text-slate-400"> / {r.locality}</span> : null}
            </td>
            <td className="px-4 py-3.5 align-top text-sm text-slate-500 whitespace-nowrap">{formatDate(r.issuanceDate)}</td>
            <td className="px-4 py-3.5 align-top text-sm text-slate-500 whitespace-nowrap">{formatDate(r.expirationDate)}</td>
            <td className="px-4 py-3.5 align-top whitespace-nowrap">
                <StatusBadge status={displayStatus(r)} />
            </td>
            <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                <QrAction record={r} downloading={downloading} justDownloaded={justDownloaded} onDownload={onDownload} />
            </td>
        </tr>
    );
};

const RegisterCard: React.FC<{
    record: LocalProduceBuyerRecord;
    downloading: boolean;
    justDownloaded: boolean;
    onDownload: () => void;
}> = ({ record: r, downloading, justDownloaded, onDownload }) => {
    const held = r.isPubliclyBlocked;
    return (
        <div className={`rounded-xl border p-3 space-y-2 ${held ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200 bg-white'}`}>
            {/* Name, permit number, status, and QR action are kept together
                in the same top block so all four are visible at once on a
                phone without scrolling the card — county/dates follow
                below in a compact two-column strip. */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-brand-text">{r.buyerName}</span>
                        {r.isAgent && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-100 text-indigo-700">AGENT</span>}
                        {r.isRenewal && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-700">RENEWAL</span>}
                    </div>
                    <div className="text-sm font-mono text-slate-600">
                        {r.permitNumber || <span className="text-slate-400 italic font-sans">Staged: {r.stagedPermitNumber}</span>}
                    </div>
                </div>
                <StatusBadge status={displayStatus(r)} className="flex-shrink-0" />
            </div>

            {held && r.publicBlockReason && (
                <div className="flex items-start gap-1 text-xs text-amber-800 bg-amber-100/70 rounded-md px-2 py-1.5">
                    <Lock size={12} className="flex-shrink-0 mt-0.5" />
                    <span>{r.publicBlockReason}</span>
                </div>
            )}

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-1 border-t border-slate-100">
                <div>
                    <dt className="text-slate-400">County</dt>
                    <dd className="text-slate-700">{r.county || '—'}{r.locality ? ` / ${r.locality}` : ''}</dd>
                </div>
                <div>
                    <dt className="text-slate-400">Issuance</dt>
                    <dd className="text-slate-700">{formatDate(r.issuanceDate)}</dd>
                </div>
                <div className="col-span-2">
                    <dt className="text-slate-400">Expiration</dt>
                    <dd className="text-slate-700">{formatDate(r.expirationDate)}</dd>
                </div>
            </dl>

            <div className="pt-1.5 border-t border-slate-100 flex justify-end">
                <QrAction record={r} downloading={downloading} justDownloaded={justDownloaded} onDownload={onDownload} align="left" />
            </div>
        </div>
    );
};

export default LocalProduceBuyerRegister;
