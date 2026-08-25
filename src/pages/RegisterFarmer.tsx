import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { createFarmer } from '../api/farmers';
import PolygonMapSelector, { type PolygonResult } from '../components/PolygonMapSelector';
import { useNavigate } from 'react-router-dom';

interface FarmForm {
    name: string;
    cropType: string;
    // Real GPS boundary, captured via polygon drawing on the map (GeoJSON Polygon, stringified)
    boundaryGeoJson?: string;
    // Fallback single point (used only if no polygon has been drawn yet)
    lat: number;
    lng: number;
    totalAreaHa?: number;
    ownershipType?: string;
    farmRegistrationStatus?: string;
    numberOfTrees?: number;
    yearsInCultivation?: number;
    harvestSeason?: string;
    averageYield?: string;
    buyers?: string;
    useChemicals?: boolean;
    extensionServices?: boolean;
    farmAddress?: string;
}

interface FarmerForm {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    gender: string;
    dob: string;
    nationality: string;
    nationalId: string;
    otherId: string;
    address: string;
    community: string;
    district: string;
    region: string;
    cooperativeName: string;
    cooperativeId: string;
    enumeratorName: string;
    enumeratorId: string;
    consent: boolean;
    profilePhoto: FileList;
    idPhoto: FileList;
    signature: FileList;
    farmSelfie: FileList;
    farmPhotos: FileList;
    farms: FarmForm[];
}

const RegisterFarmer: React.FC = () => {
    const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FarmerForm>({
        defaultValues: {
            farms: [{ name: '', cropType: 'Cocoa', lat: 0, lng: 0 }],
            consent: false
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "farms"
    });

    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [qrCode, setQrCode] = useState('');

    // Watch for file inputs to show previews if needed (omitted for brevity)

    const onSubmit = async (data: FarmerForm) => {
        setLoading(true);
        try {
            const formData = new FormData();

            // Append simple fields
            formData.append('firstName', data.firstName);
            formData.append('lastName', data.lastName);
            formData.append('email', data.email || '');
            formData.append('phoneNumber', data.phoneNumber);
            formData.append('gender', data.gender);
            formData.append('dob', data.dob);
            formData.append('nationality', data.nationality);
            formData.append('nationalId', data.nationalId);
            formData.append('otherId', data.otherId || '');
            formData.append('address', data.address);
            formData.append('community', data.community);
            formData.append('district', data.district);
            formData.append('region', data.region);
            formData.append('cooperativeName', data.cooperativeName || '');
            formData.append('cooperativeId', data.cooperativeId || '');
            formData.append('enumeratorName', data.enumeratorName);
            formData.append('enumeratorId', data.enumeratorId);
            formData.append('consent', String(data.consent));

            // Append files with keys expected by backend
            if (data.profilePhoto && data.profilePhoto[0]) formData.append('farmerPhoto', data.profilePhoto[0]);
            if (data.idPhoto && data.idPhoto[0]) formData.append('nationalId', data.idPhoto[0]);
            if (data.farmSelfie && data.farmSelfie[0]) formData.append('farmSelfie', data.farmSelfie[0]);
            if (data.signature && data.signature[0]) formData.append('signature', data.signature[0]);

            if (data.farmPhotos && data.farmPhotos.length > 0) {
                for (let i = 0; i < data.farmPhotos.length; i++) {
                    formData.append('farmPhotos', data.farmPhotos[i]);
                }
            }

            // Append Farms
            // Prefer the REAL drawn polygon boundary (boundaryGeoJson) captured on the map.
            // Only fall back to a small synthetic square around a point if the inspector
            // has not drawn a boundary yet (e.g. lat/lng captured but polygon skipped).
            const farmsPayload = data.farms.map(f => {
                let location: any;
                if (f.boundaryGeoJson) {
                    try {
                        const parsed = JSON.parse(f.boundaryGeoJson);
                        location = parsed.geometry ? parsed.geometry : parsed; // support Feature or bare geometry
                    } catch (e) {
                        console.error('Failed to parse drawn boundary, falling back to point square', e);
                    }
                }
                if (!location) {
                    location = {
                        type: "Polygon",
                        coordinates: [[
                            [f.lng - 0.001, f.lat - 0.001],
                            [f.lng + 0.001, f.lat - 0.001],
                            [f.lng + 0.001, f.lat + 0.001],
                            [f.lng - 0.001, f.lat + 0.001],
                            [f.lng - 0.001, f.lat - 0.001]
                        ]]
                    };
                }
                const { boundaryGeoJson, ...rest } = f;
                return { ...rest, location };
            });
            formData.append('farms', JSON.stringify(farmsPayload));

            // Note: Our API client might default to JSON, so we need to make sure we send Multipart
            // The createFarmer function in api/farmers.ts uses apiClient.post('/farmers', data).
            // Axios automatically handles FormData and sets the correct Content-Type header.

            const response = await createFarmer(formData);

            if (response.data.status) {
                setSuccessMsg('Farmer Registered Successfully! Redirecting...');
                const farmerData = response.data.data;
                if (farmerData && farmerData.qrCode) {
                    setQrCode(farmerData.qrCode);
                }
                window.scrollTo(0, 0);

                setTimeout(() => {
                    navigate('/farmers');
                }, 2000);
            } else {
                alert('Farmer registration failed: ' + response.data.message);
            }
        } catch (error) {
            console.error(error);
            alert('Error registering farmer. Please check logs.');
            setSuccessMsg('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen py-8">
            <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
                <div className="bg-green-700 px-6 py-4">
                    <h3 className="text-xl font-bold text-white">Farmer Registration Form</h3>
                    <p className="text-green-100 text-sm">Complete all sections to register a new farmer.</p>
                </div>

                <div className="p-6">
                    {successMsg && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg text-center">
                            <h4 className="text-lg font-bold">Success!</h4>
                            <p>{successMsg}</p>
                        </div>
                    )}

                    {qrCode && (
                        <div className="mb-6 p-6 bg-white border-2 border-dashed border-gray-300 rounded-lg text-center flex flex-col items-center">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Farmer Identity Card</h3>
                            <img src={qrCode} alt="Farmer QR Code" className="w-48 h-48 border border-gray-200 mb-2" />
                            <p className="text-sm text-gray-500 mb-4">Scan to verify farmer identity</p>
                            <button onClick={() => window.print()} className="text-blue-600 hover:text-blue-800 underline font-medium">
                                Print Identity Card
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                        {/* Section 1: Personal Information */}
                        <section>
                            <h4 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">1. Personal Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">First Name *</label>
                                    <input {...register("firstName", { required: "Required" })} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                    {errors.firstName && <span className="text-red-500 text-xs">{errors.firstName.message}</span>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                                    <input {...register("lastName", { required: "Required" })} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                    {errors.lastName && <span className="text-red-500 text-xs">{errors.lastName.message}</span>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Gender</label>
                                    <select {...register("gender")} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2">
                                        <option value="">Select...</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                                    <input {...register("dob")} type="date" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nationality</label>
                                    <input {...register("nationality")} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">National ID No.</label>
                                    <input {...register("nationalId")} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Phone Number *</label>
                                    <input {...register("phoneNumber", { required: "Required" })} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                    {errors.phoneNumber && <span className="text-red-500 text-xs">{errors.phoneNumber.message}</span>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email (Optional)</label>
                                    <input {...register("email")} type="email" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Other ID (e.g. LASSRA)</label>
                                    <input {...register("otherId")} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                            </div>
                        </section>

                        {/* Section 2: Address & Location */}
                        <section>
                            <h4 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">2. Address & Location</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Home Address</label>
                                    <textarea {...register("address")} rows={2} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Community / Village</label>
                                    <input {...register("community")} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">District</label>
                                    <input {...register("district")} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Region / Zone</label>
                                    <input {...register("region")} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                            </div>
                        </section>

                        {/* Section 3: Cooperative Info */}
                        <section>
                            <h4 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">3. Group / Cooperative Affiliation</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Cooperative Name</label>
                                    <input {...register("cooperativeName")} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Cooperative ID</label>
                                    <input {...register("cooperativeId")} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                            </div>
                        </section>

                        {/* Section 4: Farm Details */}
                        <section>
                            <h4 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">4. Farm Information</h4>
                            <div className="space-y-6">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="p-6 bg-gray-100 rounded-lg relative border border-gray-200">
                                        <button type="button" onClick={() => remove(index)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">
                                            <span className="sr-only">Remove</span>
                                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                        <h5 className="font-medium text-gray-700 mb-4">Farm #{index + 1}</h5>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Farm Name *</label>
                                                <input {...register(`farms.${index}.name` as const, { required: "Required" })} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Crop Type</label>
                                                <select {...register(`farms.${index}.cropType` as const)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2">
                                                    <option value="Cocoa">Cocoa</option>
                                                    <option value="Coffee">Coffee</option>
                                                    <option value="Palm">Oil Palm</option>
                                                    <option value="Rubber">Rubber</option>
                                                    <option value="Cassava">Cassava</option>
                                                    <option value="Vegetables">Vegetables</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Total Area (Ha)</label>
                                                <input {...register(`farms.${index}.totalAreaHa` as const)} type="number" step="0.1" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Ownership Type</label>
                                                <select {...register(`farms.${index}.ownershipType` as const)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2">
                                                    <option value="Owned">Owned</option>
                                                    <option value="Rented">Rented</option>
                                                    <option value="Family Inherited">Family Inherited</option>
                                                    <option value="Communal">Communal</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Registration Status</label>
                                                <select {...register(`farms.${index}.farmRegistrationStatus` as const)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2">
                                                    <option value="Registered">Registered</option>
                                                    <option value="Not Registered">Not Registered</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Number of Trees</label>
                                                <input {...register(`farms.${index}.numberOfTrees` as const)} type="number" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Years in Cultivation</label>
                                                <input {...register(`farms.${index}.yearsInCultivation` as const)} type="number" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Harvest Season</label>
                                                <input {...register(`farms.${index}.harvestSeason` as const)} type="text" placeholder="e.g. Sept-Dec" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Average Yield</label>
                                                <input {...register(`farms.${index}.averageYield` as const)} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                            </div>
                                            <div className="col-span-1 md:col-span-3">
                                                <label className="block text-sm font-medium text-gray-700">Farm Address / Location Description</label>
                                                <input {...register(`farms.${index}.farmAddress` as const)} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                            </div>

                                            <div className="md:col-span-3">
                                                <div className="flex gap-6 mt-2">
                                                    <label className="flex items-center">
                                                        <input {...register(`farms.${index}.useChemicals` as const)} type="checkbox" className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                                                        <span className="ml-2 text-sm text-gray-700">Uses Fertilizers / Chemicals?</span>
                                                    </label>
                                                    <label className="flex items-center">
                                                        <input {...register(`farms.${index}.extensionServices` as const)} type="checkbox" className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                                                        <span className="ml-2 text-sm text-gray-700">Access to Extension Services?</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="col-span-1 md:col-span-3 mt-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Farm Boundary — Draw the polygon on the map (EUDR geolocation requirement)
                                                </label>
                                                <div className="rounded-md overflow-hidden border">
                                                    <PolygonMapSelector
                                                        height="420px"
                                                        onPolygonChange={(result: PolygonResult | null) => {
                                                            if (result) {
                                                                setValue(`farms.${index}.boundaryGeoJson`, JSON.stringify(result.geojson));
                                                                setValue(`farms.${index}.totalAreaHa`, result.areaHa);
                                                                // Keep a fallback center point in sync too (centroid)
                                                                try {
                                                                    const coords = result.geojson.geometry.coordinates[0];
                                                                    const lats = coords.map((c: number[]) => c[1]);
                                                                    const lngs = coords.map((c: number[]) => c[0]);
                                                                    const centerLat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length;
                                                                    const centerLng = lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length;
                                                                    setValue(`farms.${index}.lat`, centerLat);
                                                                    setValue(`farms.${index}.lng`, centerLng);
                                                                } catch { /* ignore */ }
                                                            } else {
                                                                setValue(`farms.${index}.boundaryGeoJson`, '');
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-3 items-center text-xs">
                                                    <span className={`px-2 py-1 rounded-full font-medium ${watch(`farms.${index}.boundaryGeoJson`) ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {watch(`farms.${index}.boundaryGeoJson`) ? '✓ Boundary Captured' : 'No boundary drawn yet'}
                                                    </span>
                                                    <span className="text-gray-500">
                                                        Area: <b>{watch(`farms.${index}.totalAreaHa`) || 0} ha</b>
                                                    </span>
                                                    <span className="text-gray-500">
                                                        Center: {watch(`farms.${index}.lat`)?.toFixed?.(5) ?? watch(`farms.${index}.lat`)}, {watch(`farms.${index}.lng`)?.toFixed?.(5) ?? watch(`farms.${index}.lng`)}
                                                    </span>
                                                </div>
                                                <input type="hidden" {...register(`farms.${index}.boundaryGeoJson` as const)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button type="button" onClick={() => append({ name: '', cropType: 'Cocoa', lat: 0, lng: 0 })} className="w-full flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none">
                                    + Add Another Farm
                                </button>
                            </div>
                        </section>

                        {/* Section 5: Verification Files */}
                        <section>
                            <h4 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">5. Verification & Documents</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Farmer Photo (Profile)</label>
                                    <input {...register("profilePhoto")} type="file" accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">National ID Photo</label>
                                    <input {...register("idPhoto")} type="file" accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Farm Selfie (Farmer at Farm)</label>
                                    <input {...register("farmSelfie")} type="file" accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Farm Photos (Upload Multiple)</label>
                                    <input {...register("farmPhotos")} type="file" multiple accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Signature Image</label>
                                    <input {...register("signature")} type="file" accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                                </div>
                            </div>
                        </section>

                        {/* Section 6: Enumerator Info & Consent */}
                        <section>
                            <h4 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">6. Submission Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Enumerator Name</label>
                                    <input {...register("enumeratorName")} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Enumerator ID</label>
                                    <input {...register("enumeratorId")} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div className="md:col-span-2 mt-4">
                                    <label className="flex items-center">
                                        <input {...register("consent", { required: "Consent is required" })} type="checkbox" className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                                        <span className="ml-3 text-sm text-gray-700 font-medium">Farmer agrees to data usage and verification by LACRA</span>
                                    </label>
                                    {errors.consent && <p className="text-red-500 text-xs mt-1">{errors.consent.message}</p>}
                                </div>
                            </div>
                        </section>

                        <div className="pt-6 border-t border-gray-200 flex justify-end">
                            <button type="submit" disabled={loading} className="inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50">
                                {loading ? 'Processing...' : 'Register Farmer'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RegisterFarmer;
