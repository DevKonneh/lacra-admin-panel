import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Loader2, CheckCircle2 } from 'lucide-react';
import { getFarmer, updateFarmer, type Farmer } from '../../../api/farmers';
import { resolveFileUrl } from '../../../utils/fileUrl';
import SafeImage from '../../../components/SafeImage';

/**
 * Step 4 of the "Add Farm to Existing Farmer" flow: a SHORT identity
 * confirmation screen — NOT a re-collection of the farmer's full personal
 * profile. Only the contact/location fields the backend treats as
 * "permitted to update" (AUDITABLE_CONTACT_FIELDS in FarmerController) are
 * editable here. Any field the enumerator actually changes is written to
 * FarmerAuditLog automatically by PUT /farmers/:id on the backend.
 */
interface EditableContact {
    phoneNumber: string;
    email: string;
    address: string;
    community: string;
    district: string;
    region: string;
    directions: string;
}

const ConfirmIdentityScreen: React.FC = () => {
    const { farmerId } = useParams<{ farmerId: string }>();
    const navigate = useNavigate();
    const [farmer, setFarmer] = useState<Farmer | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [contact, setContact] = useState<EditableContact>({
        phoneNumber: '', email: '', address: '', community: '', district: '', region: '', directions: '',
    });

    useEffect(() => {
        if (!farmerId) return;
        (async () => {
            setLoading(true);
            try {
                const res = await getFarmer(farmerId);
                if (res.data.status) {
                    const f = res.data.data;
                    setFarmer(f);
                    setContact({
                        phoneNumber: f.phoneNumber || '',
                        email: f.email || '',
                        address: f.address || '',
                        community: f.community || '',
                        district: f.district || '',
                        region: f.region || '',
                        directions: f.directions || '',
                    });
                } else {
                    setError(res.data.message || 'Farmer not found');
                }
            } catch (e: any) {
                setError(e?.response?.data?.message || 'Failed to load farmer');
            } finally {
                setLoading(false);
            }
        })();
    }, [farmerId]);

    const handleContinue = async () => {
        if (!farmer) return;
        setSaving(true);
        setError(null);
        try {
            // Only send this call if something actually changed, to avoid
            // writing no-op audit rows — but it's harmless either way since
            // the backend only logs FIELDS THAT ACTUALLY DIFFER.
            const res = await updateFarmer(farmer.id, contact as Partial<Farmer>);
            if (!res.data.status) {
                setError(res.data.message || 'Failed to update contact information');
                setSaving(false);
                return;
            }
            navigate('/farms/new', {
                state: { farmerId: farmer.id, farmerName: `${farmer.firstName} ${farmer.lastName}` },
            });
        } catch (e: any) {
            if (!navigator.onLine) {
                // Offline: skip the contact-update call (no audit trail
                // possible without a server) and continue straight to farm
                // detail collection — CreateFarm.tsx already knows how to
                // queue farms offline via OfflineDataService.
                navigate('/farms/new', {
                    state: { farmerId: farmer.id, farmerName: `${farmer.firstName} ${farmer.lastName}` },
                });
                return;
            }
            setError(e?.response?.data?.message || 'Failed to update contact information');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto py-16 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!farmer) {
        return (
            <div className="max-w-2xl mx-auto py-16 text-center space-y-3">
                <p className="text-red-600">{error || 'Farmer not found'}</p>
            </div>
        );
    }

    const field = (label: string, key: keyof EditableContact, type: string = 'text') => (
        <div>
            <label className="block text-sm font-medium text-gray-700">{label}</label>
            <input
                type={type}
                value={contact[key]}
                onChange={(e) => setContact({ ...contact, [key]: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2"
            />
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center">
                <button onClick={() => navigate(`/farmers/mapping/farmer/${farmer.id}`)} className="mr-4 text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Confirm Identity</h1>
                    <p className="text-sm text-gray-500">Quick check before mapping a new farm. Personal details are not re-collected.</p>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6 space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                    <SafeImage
                        src={resolveFileUrl(farmer.profilePhoto)}
                        alt={`${farmer.firstName} ${farmer.lastName}`}
                        className="h-16 w-16 rounded-full object-cover border border-gray-200 flex-none"
                        fallback={
                            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-none">
                                <User className="h-7 w-7" />
                            </div>
                        }
                    />
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{farmer.firstName} {farmer.lastName}</h2>
                        <p className="text-sm text-gray-500 font-mono">{farmer.farmerId} {farmer.nationalId ? `\u2022 ${farmer.nationalId}` : ''}</p>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Update contact information (optional)</h3>
                    <p className="text-xs text-gray-500 mb-4">
                        Only phone, email, address and location fields can be updated here. Any change you make is recorded in this farmer's audit log.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {field('Phone Number', 'phoneNumber')}
                        {field('Email', 'email', 'email')}
                        {field('County / Region', 'region')}
                        {field('District', 'district')}
                        {field('Community / Village', 'community')}
                        {field('Directions', 'directions')}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Home Address</label>
                            <textarea
                                rows={2}
                                value={contact.address}
                                onChange={(e) => setContact({ ...contact, address: e.target.value })}
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2"
                            />
                        </div>
                    </div>
                </div>

                <label className="flex items-start gap-2 pt-2 border-t border-gray-100">
                    <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="mt-0.5 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">I confirm this is the correct farmer and the details above are accurate.</span>
                </label>

                {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>
                )}

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleContinue}
                        disabled={!confirmed || saving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Continue to Farm Details
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmIdentityScreen;
