import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Calendar, FileText, Building2, Wheat } from 'lucide-react';
import { verifyCertificate, type CertificateVerificationResult } from '../api/applications';
import { statusColor, statusLabel, categoryLabel, apiErrorMessage } from './applications/statusHelpers';

// Public, no-auth QR-verification landing page. Anyone scanning the QR
// code printed on a LACRA permit/licence certificate lands here (see the
// backend's GET /api/applications/verify/:certificateNumber route, which
// intentionally requires no authentication and returns only a minimal,
// safe projection of the underlying application).
const CertificateVerify: React.FC = () => {
    const { certificateNumber } = useParams<{ certificateNumber: string }>();
    const [result, setResult] = useState<CertificateVerificationResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!certificateNumber) return;
        verifyCertificate(certificateNumber)
            .then((res) => setResult(res.data.data))
            .catch((err) => setError(apiErrorMessage(err, 'This certificate could not be verified.')))
            .finally(() => setLoading(false));
    }, [certificateNumber]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">Verifying certificate...</div>;
    }

    if (error || !result) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-white shadow rounded-lg p-8 text-center space-y-3">
                    <ShieldAlert className="h-14 w-14 text-red-500 mx-auto" />
                    <h1 className="text-lg font-bold text-gray-900">Certificate Not Verified</h1>
                    <p className="text-sm text-gray-500">{error || 'This certificate number could not be found. It may be invalid or has not yet been issued.'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className={`px-6 py-5 flex items-center gap-3 ${result.valid ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                        {result.valid ? <ShieldCheck className="h-9 w-9" /> : <ShieldAlert className="h-9 w-9" />}
                        <div>
                            <h1 className="text-xl font-bold">{result.valid ? 'Valid Certificate' : 'Certificate Not Valid'}</h1>
                            <p className="text-sm opacity-90 font-mono">{result.certificateNumber}</p>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">Status</span>
                            <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${statusColor(result.status)}`}>
                                {statusLabel(result.status)}
                            </span>
                        </div>

                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm border-t border-gray-100 pt-4">
                            <div className="flex justify-between gap-3">
                                <dt className="text-gray-500 flex items-center gap-1"><FileText size={14} /> Application No.</dt>
                                <dd className="text-gray-900 font-medium text-right">{result.applicationNumber}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-gray-500 flex items-center gap-1"><Building2 size={14} /> Category</dt>
                                <dd className="text-gray-900 font-medium text-right">{categoryLabel(result.category)}</dd>
                            </div>
                            {result.permitOrLicenceType && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-gray-500">Permit / Licence Type</dt>
                                    <dd className="text-gray-900 font-medium text-right">{result.permitOrLicenceType}</dd>
                                </div>
                            )}
                            {result.commodity && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-gray-500 flex items-center gap-1"><Wheat size={14} /> Commodity</dt>
                                    <dd className="text-gray-900 font-medium text-right">{result.commodity}</dd>
                                </div>
                            )}
                            {result.applicantName && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-gray-500">Applicant</dt>
                                    <dd className="text-gray-900 font-medium text-right">{result.applicantName}</dd>
                                </div>
                            )}
                            {result.issueDate && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-gray-500 flex items-center gap-1"><Calendar size={14} /> Issue Date</dt>
                                    <dd className="text-gray-900 font-medium text-right">{new Date(result.issueDate).toLocaleDateString()}</dd>
                                </div>
                            )}
                            {result.expiryDate && (
                                <div className="flex justify-between gap-3">
                                    <dt className="text-gray-500 flex items-center gap-1"><Calendar size={14} /> Expiry Date</dt>
                                    <dd className="text-gray-900 font-medium text-right">{new Date(result.expiryDate).toLocaleDateString()}</dd>
                                </div>
                            )}
                        </dl>
                    </div>
                </div>

                <div className="text-center pt-4">
                    <p className="text-xs text-gray-400">
                        Official Certificate Verification • Liberia Agricultural Commodity Regulatory Authority (LACRA) <br />
                        Verified on {new Date().toLocaleDateString()}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CertificateVerify;
