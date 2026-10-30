import React from 'react';
import { CheckCircle2, Download, Printer, Home, UserRound, IdCard } from 'lucide-react';
import jsPDF from 'jspdf';
import type { ApplicationState, UploadedFile } from './types';
import { CATEGORY_LABELS, COMMODITY_LABELS } from './types';

interface ConfirmationPageProps {
    state: ApplicationState;
    onStartNew: () => void;
}

function getApplicantName(state: ApplicationState): string {
    const category = state.step1.category;
    if (category === 'LOCAL_BUYER') return state.buyer.fullName;
    if (category === 'AGENCY') return state.agency.legalName;
    if (category === 'COOPERATIVE') return state.cooperative.legalName;
    if (category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER') return state.exporter.legalName;
    return state.declaration.fullName;
}

// The primary applicant/business photo used for identification on the
// confirmation page - the applicant's own passport photo (Local Buyer) or
// the authorized signatory/representative's photo (Agency/Cooperative/
// Exporter), matching whichever record represents the person LACRA staff
// would meet in person to verify identity.
function getApplicantPhoto(state: ApplicationState): UploadedFile | null {
    const category = state.step1.category;
    if (category === 'LOCAL_BUYER') return state.buyer.photo;
    if (category === 'AGENCY') return state.agency.signatoryPhoto;
    if (category === 'COOPERATIVE') return state.cooperative.repPhoto;
    if (category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER') return state.exporter.signatoryPhoto;
    return null;
}

interface RosterEntry {
    name: string;
    role: string;
    idNumber: string;
    photo: UploadedFile | null;
}

// Every registered personnel/leadership/owner record across the whole
// application, gathered into one flat list so their photos and ID numbers
// can be displayed for identification purposes on the confirmation page.
function getPersonnelRoster(state: ApplicationState): RosterEntry[] {
    const roster: RosterEntry[] = [];
    state.personnel.forEach((p) => roster.push({ name: p.fullName, role: p.role || 'Personnel', idNumber: p.nationalId, photo: p.photo }));
    state.leadership.forEach((l) => roster.push({ name: l.fullName, role: l.role || 'Leadership', idNumber: l.nationalId, photo: l.photo }));
    state.owners.forEach((o) => roster.push({ name: o.fullName, role: 'Owner/Shareholder', idNumber: o.idNumber, photo: o.citizenshipProof }));
    return roster.filter((r) => r.name.trim() !== '');
}

// Professional submission confirmation page shown after a successful
// applicant submission. Generates a downloadable PDF summary using the
// same jsPDF pattern already established elsewhere in this app
// (ExportManager's DDS PDF generation), and supports browser print for
// applicants who want a physical copy for their records.
const ConfirmationPage: React.FC<ConfirmationPageProps> = ({ state, onStartNew }) => {
    const applicantName = getApplicantName(state);
    const categoryLabel = state.step1.category ? CATEGORY_LABELS[state.step1.category] : '—';
    const commodity = state.step1.commodity ? COMMODITY_LABELS[state.step1.commodity] : '';
    const submittedDate = state.submittedAt ? new Date(state.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const applicantPhoto = getApplicantPhoto(state);
    const roster = getPersonnelRoster(state);

    const handleDownloadSummary = () => {
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        let y = 20;
        const lineHeight = 7;

        const addText = (text: string, opts?: { bold?: boolean; size?: number }) => {
            pdf.setFontSize(opts?.size ?? 11);
            pdf.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
            const lines = pdf.splitTextToSize(text, pageWidth - 40);
            lines.forEach((line: string) => {
                pdf.text(line, 20, y);
                y += lineHeight;
            });
        };

        addText('LACRA - Supply Chain Actor Online Registration', { bold: true, size: 15 });
        addText('Application Summary', { size: 12 });
        y += 4;
        addText(`Application Number: ${state.applicationNumber || '—'}`, { bold: true, size: 13 });
        y += 4;
        addText(`Applicant / Business Name: ${applicantName || '—'}`);
        addText(`Application Category: ${categoryLabel}`);
        addText(`Commodity: ${commodity || '—'}`);
        addText(`Submission Date: ${submittedDate}`);
        y += 4;
        addText('This document confirms that the application above was successfully submitted to the', { size: 10 });
        addText('Liberia Agricultural Commodity Regulatory Authority (LACRA) and is pending internal review.', { size: 10 });

        pdf.save(`LACRA-Application-${state.applicationNumber || 'summary'}.pdf`);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-card border border-brand-border p-6 sm:p-10 text-center print:shadow-none print:border-none">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 size={36} className="text-brand-green" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">Application Submitted Successfully</h1>
                <p className="text-sm text-slate-500 mb-6">
                    Your application has been received by LACRA and is now pending internal review. You will be notified of any updates using the
                    contact details you provided.
                </p>

                <div className="rounded-xl border-2 border-dashed border-brand-green/40 bg-brand-green/5 py-4 mb-6">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Application Number</p>
                    <p className="text-2xl sm:text-3xl font-bold text-brand-green tracking-wide">{state.applicationNumber}</p>
                </div>

                {applicantPhoto?.previewUrl && (
                    <div className="mb-6 flex flex-col items-center">
                        <img
                            src={applicantPhoto.previewUrl}
                            alt="Applicant"
                            className="h-24 w-24 rounded-full object-cover border-2 border-brand-green/40 shadow-sm"
                        />
                        <p className="text-xs text-slate-500 mt-2">Applicant photo on file — used for identification purposes.</p>
                    </div>
                )}

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left text-sm mb-8">
                    <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Applicant / Business Name</dt>
                        <dd className="font-medium text-slate-800">{applicantName || '—'}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Application Category</dt>
                        <dd className="font-medium text-slate-800">{categoryLabel}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Commodity</dt>
                        <dd className="font-medium text-slate-800">{commodity || '—'}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Submission Date</dt>
                        <dd className="font-medium text-slate-800">{submittedDate}</dd>
                    </div>
                </dl>

                {roster.length > 0 && (
                    <div className="text-left mb-8">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <IdCard size={14} /> IDs for All Registered Personnel
                        </p>
                        <div className="space-y-2">
                            {roster.map((r, i) => (
                                <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 p-2.5">
                                    {r.photo?.previewUrl ? (
                                        <img src={r.photo.previewUrl} alt={r.name} className="h-10 w-10 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                                    ) : (
                                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                            <UserRound size={16} className="text-slate-400" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{r.role}{r.idNumber ? ` · ID: ${r.idNumber}` : ''}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center print:hidden">
                    <button
                        type="button"
                        onClick={handleDownloadSummary}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-brand-green text-white hover:bg-brand-green-hover"
                    >
                        <Download size={16} /> Download Application Summary
                    </button>
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                        <Printer size={16} /> Print Application
                    </button>
                </div>

                <button
                    type="button"
                    onClick={onStartNew}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-green print:hidden"
                >
                    <Home size={14} /> Start a New Application
                </button>

                <p className="mt-6 text-xs text-slate-400 print:hidden">
                    If backend notification services are available, a confirmation email or SMS will also be sent to the contact details provided.
                </p>
            </div>
        </div>
    );
};

export default ConfirmationPage;
