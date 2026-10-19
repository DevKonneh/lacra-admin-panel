import React, { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray, type Control, type UseFormRegister, type UseFormSetValue, type UseFormWatch } from 'react-hook-form';
import { createFarmer } from '../api/farmers';
import type { CommodityFormEntry, CommodityRole, CroppingSystem, ProductionStatus } from '../api/farmers';
import PolygonMapSelector, { type PolygonResult } from '../components/PolygonMapSelector';
import CooperativeField from '../components/forms/CooperativeField';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { OfflineDataService } from '../services/OfflineDataService';
import { ArrowLeft, Plus, Trash2, Sprout, MapPin, AlertTriangle } from 'lucide-react';

// One "Add Commodity" row for a farm. Numeric-looking fields are kept as
// plain strings (native <input type="number"> via register() without
// valueAsNumber) and converted in buildFarmsPayload() below.
interface CommodityRow {
    commodityName: string;
    role: CommodityRole;
    croppingSystem: CroppingSystem;
    plantedAreaHa?: string;
    plantingYear?: string;
    numberOfTrees?: string;
    estimatedAnnualProduction?: string;
    unitOfMeasurement?: string;
    productionStatus: ProductionStatus;
    expectedHarvestPeriod?: string;
    // If true, this commodity occupies its OWN separately drawn physical
    // area of the farm (its own subplot polygon) rather than sharing the
    // farm's overall boundary. Commodities entering the SAME subplotName
    // are grouped onto one shared plot (its area counted once), so this
    // also supports two commodities occupying one shared, separately
    // drawn subplot without double-counting area.
    separateArea?: boolean;
    subplotName?: string;
    subplotBoundaryGeoJson?: string;
    subplotAreaHa?: number;
}

const DEFAULT_COMMODITY_ROW: CommodityRow = {
    commodityName: '',
    role: 'Primary',
    croppingSystem: 'Monocrop',
    productionStatus: 'Producing',
    separateArea: false,
};

interface FarmForm {
    name: string;
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
    commodities: CommodityRow[];
}

const toNum = (v: string | undefined): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
};

/**
 * Per-farm "Add Commodity" repeating group, with optional per-commodity
 * separate-subplot drawing. Extracted into its own component because
 * react-hook-form's useFieldArray must be called inside a component, and
 * each farm card needs its own independent nested `commodities` array
 * (farms.${farmIndex}.commodities).
 */
const FarmCommoditiesSection: React.FC<{
    control: Control<FarmerForm>;
    register: UseFormRegister<FarmerForm>;
    setValue: UseFormSetValue<FarmerForm>;
    watch: UseFormWatch<FarmerForm>;
    farmIndex: number;
}> = ({ control, register, setValue, watch, farmIndex }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `farms.${farmIndex}.commodities` as const,
    });

    return (
        <div className="md:col-span-3 bg-white rounded-md border border-gray-200 p-4 mt-2">
            <div className="flex items-center justify-between mb-4">
                <h6 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Sprout className="h-4 w-4 text-green-600" /> Commodities *
                </h6>
                <button
                    type="button"
                    onClick={() => append({ ...DEFAULT_COMMODITY_ROW })}
                    className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800"
                >
                    <Plus className="h-4 w-4" /> Add Commodity
                </button>
            </div>

            <div className="space-y-4">
                {fields.map((field, cIndex) => {
                    const separateArea = watch(`farms.${farmIndex}.commodities.${cIndex}.separateArea`);
                    const subplotBoundary = watch(`farms.${farmIndex}.commodities.${cIndex}.subplotBoundaryGeoJson`);
                    const subplotAreaHa = watch(`farms.${farmIndex}.commodities.${cIndex}.subplotAreaHa`);
                    return (
                        <div key={field.id} className="relative bg-gray-50 border border-gray-200 rounded-md p-4">
                            {fields.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => remove(cIndex)}
                                    className="absolute top-3 right-3 text-red-500 hover:text-red-700"
                                    title="Remove commodity"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700">Commodity Name *</label>
                                    <input
                                        {...register(`farms.${farmIndex}.commodities.${cIndex}.commodityName` as const, { required: true })}
                                        list="commodity-suggestions"
                                        placeholder="e.g. Cocoa"
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Primary / Secondary</label>
                                    <select {...register(`farms.${farmIndex}.commodities.${cIndex}.role` as const)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2">
                                        <option value="Primary">Primary</option>
                                        <option value="Secondary">Secondary</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Cropping System</label>
                                    <select {...register(`farms.${farmIndex}.commodities.${cIndex}.croppingSystem` as const)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2">
                                        <option value="Monocrop">Monocrop</option>
                                        <option value="Mixed">Mixed</option>
                                        <option value="Intercropped">Intercropped</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Planted Area (ha)</label>
                                    <input type="number" step="0.01" {...register(`farms.${farmIndex}.commodities.${cIndex}.plantedAreaHa` as const)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Planting Year</label>
                                    <input type="number" {...register(`farms.${farmIndex}.commodities.${cIndex}.plantingYear` as const)} placeholder="e.g. 2018" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">No. of Trees (if applicable)</label>
                                    <input type="number" {...register(`farms.${farmIndex}.commodities.${cIndex}.numberOfTrees` as const)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Est. Annual Production</label>
                                    <input type="number" step="0.01" {...register(`farms.${farmIndex}.commodities.${cIndex}.estimatedAnnualProduction` as const)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Unit of Measurement</label>
                                    <input {...register(`farms.${farmIndex}.commodities.${cIndex}.unitOfMeasurement` as const)} list="unit-suggestions" placeholder="e.g. kg, MT, bags" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Production Status</label>
                                    <select {...register(`farms.${farmIndex}.commodities.${cIndex}.productionStatus` as const)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2">
                                        <option value="Not Yet Productive">Not Yet Productive</option>
                                        <option value="Producing">Producing</option>
                                        <option value="Declining">Declining</option>
                                        <option value="Dormant / Off-season">Dormant / Off-season</option>
                                        <option value="Abandoned">Abandoned</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700">Expected Harvest Period</label>
                                    <input {...register(`farms.${farmIndex}.commodities.${cIndex}.expectedHarvestPeriod` as const)} placeholder="e.g. Sept - Dec" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2" />
                                </div>

                                <div className="md:col-span-4">
                                    <label className="flex items-center gap-2">
                                        <input type="checkbox" {...register(`farms.${farmIndex}.commodities.${cIndex}.separateArea` as const)} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                                        <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5 text-gray-400" /> This commodity occupies its own separate physical area (draw a subplot)
                                        </span>
                                    </label>
                                    <p className="text-[11px] text-gray-500 mt-1 ml-6">
                                        Leave unchecked if this commodity is intercropped or mixed on the same land as
                                        others — it will use the farm's shared boundary below with no double-counted area.
                                    </p>
                                </div>

                                {separateArea && (
                                    <div className="md:col-span-4 bg-white border border-gray-200 rounded-md p-3">
                                        <label className="block text-xs font-medium text-gray-700">Subplot Name</label>
                                        <input
                                            {...register(`farms.${farmIndex}.commodities.${cIndex}.subplotName` as const)}
                                            placeholder="e.g. Coffee Block (commodities sharing the same name share one subplot)"
                                            className="mt-1 mb-3 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm border p-2"
                                        />
                                        <div className="rounded-md overflow-hidden border">
                                            <PolygonMapSelector
                                                height="260px"
                                                onPolygonChange={(result: PolygonResult | null) => {
                                                    if (result) {
                                                        setValue(`farms.${farmIndex}.commodities.${cIndex}.subplotBoundaryGeoJson`, JSON.stringify(result.geojson));
                                                        setValue(`farms.${farmIndex}.commodities.${cIndex}.subplotAreaHa`, result.areaHa);
                                                    } else {
                                                        setValue(`farms.${farmIndex}.commodities.${cIndex}.subplotBoundaryGeoJson`, undefined);
                                                        setValue(`farms.${farmIndex}.commodities.${cIndex}.subplotAreaHa`, undefined);
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="mt-2 text-xs">
                                            {subplotBoundary ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
                                                    ✓ Boundary Captured{subplotAreaHa ? ` — ${subplotAreaHa.toFixed(2)} ha` : ''}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-800">
                                                    No boundary drawn yet
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <datalist id="commodity-suggestions">
                <option value="Cocoa" />
                <option value="Coffee" />
                <option value="Oil Palm" />
                <option value="Rubber" />
                <option value="Cassava" />
                <option value="Plantain" />
                <option value="Vegetables" />
            </datalist>
            <datalist id="unit-suggestions">
                <option value="kg" />
                <option value="Metric Tons (MT)" />
                <option value="Bags" />
                <option value="Liters" />
            </datalist>
        </div>
    );
};

/**
 * Shows a live total of separately-drawn subplot areas for one farm, and a
 * warning if that total exceeds the farm's own calculated/declared total
 * area — a client-side mirror of the backend's computeAreaWarning() logic,
 * which deliberately excludes the shared/default plot (it always mirrors
 * the farm's own totalAreaHa) from this sum.
 */
const FarmAreaWarning: React.FC<{ watch: UseFormWatch<FarmerForm>; farmIndex: number }> = ({ watch, farmIndex }) => {
    const commodities = watch(`farms.${farmIndex}.commodities`) || [];
    const totalAreaHa = watch(`farms.${farmIndex}.totalAreaHa`);
    const seen = new Map<string, number>();
    commodities.forEach((c) => {
        if (c.separateArea && c.subplotName && c.subplotAreaHa) {
            seen.set(c.subplotName.trim(), c.subplotAreaHa);
        }
    });
    const separateSubplotAreaHa = Array.from(seen.values()).reduce((a, b) => a + b, 0);
    if (!totalAreaHa || separateSubplotAreaHa <= totalAreaHa + 0.0001) return null;
    return (
        <div className="md:col-span-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
                Total subplot area ({separateSubplotAreaHa.toFixed(2)} ha) exceeds the farm's calculated total area
                ({totalAreaHa.toFixed(2)} ha). Please review the drawn subplot boundaries.
            </span>
        </div>
    );
};

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
    cooperativeSource: string;
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

// Fields that are safe to persist to a local "incomplete mapping" draft.
// File inputs (profilePhoto, idPhoto, signature, farmSelfie, farmPhotos)
// are deliberately excluded — browsers do not allow re-hydrating a file
// input's value programmatically for security reasons, so a resumed draft
// will always need those re-attached; everything else resumes exactly as
// it was left.
const DRAFT_FIELDS: (keyof FarmerForm)[] = [
    'firstName', 'lastName', 'email', 'phoneNumber', 'gender', 'dob', 'nationality',
    'nationalId', 'otherId', 'address', 'community', 'district', 'region',
    'cooperativeName', 'cooperativeId', 'cooperativeSource', 'enumeratorName', 'enumeratorId', 'consent', 'farms',
];

const RegisterFarmer: React.FC = () => {
    const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FarmerForm>({
        defaultValues: {
            farms: [{ name: '', lat: 0, lng: 0, commodities: [{ ...DEFAULT_COMMODITY_ROW }] }],
            consent: false
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "farms"
    });

    const navigate = useNavigate();
    const routerLocation = useLocation();
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [qrCode, setQrCode] = useState('');

    // "Continue Incomplete Mapping": if we were routed here with a draftId,
    // load the saved (non-file) field values back into the form once.
    const draftIdRef = useRef<string | undefined>((routerLocation.state as any)?.draftId);
    const [draftLoaded, setDraftLoaded] = useState(false);
    useEffect(() => {
        const draftId = draftIdRef.current;
        if (draftId && !draftLoaded) {
            const draft = OfflineDataService.getDraft(draftId);
            if (draft?.formData) {
                Object.entries(draft.formData).forEach(([key, value]) => {
                    setValue(key as any, value as any);
                });
            }
            setDraftLoaded(true);
        }
    }, [draftLoaded, setValue]);

    // Auto-save a draft of the in-progress form every few seconds so an
    // enumerator who gets interrupted (or loses connectivity mid-form) can
    // resume via "Continue Incomplete Mapping" without re-entering
    // everything already typed. Debounced to avoid hammering localStorage
    // on every keystroke.
    const allValues = watch();
    useEffect(() => {
        const hasAnyInput = !!(allValues.firstName || allValues.lastName || allValues.phoneNumber);
        if (!hasAnyInput) return;
        const timer = setTimeout(() => {
            const formData: any = {};
            DRAFT_FIELDS.forEach((f) => { formData[f] = (allValues as any)[f]; });
            const label = [allValues.firstName, allValues.lastName].filter(Boolean).join(' ') || 'New farmer (unnamed)';
            const saved = OfflineDataService.saveDraft({
                id: draftIdRef.current,
                type: 'new_farmer',
                label,
                formData,
                step: 'personal_info',
            });
            draftIdRef.current = saved.id;
        }, 1500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(allValues)]);

    // Watch for file inputs to show previews if needed (omitted for brevity)

    const onSubmit = async (data: FarmerForm) => {
        setLoading(true);
        try {
            // Prefer the REAL drawn polygon boundary (boundaryGeoJson) captured on
            // the map. Only fall back to a small synthetic square around a point
            // if the enumerator has not drawn a boundary yet. Computed up front
            // since both the online (multipart) and offline (localStorage) paths
            // below need the same farms payload shape.
            const farmsPayload = data.farms.map(f => {
                let location: any;
                if (f.boundaryGeoJson) {
                    try {
                        const parsed = JSON.parse(f.boundaryGeoJson);
                        location = parsed.geometry ? parsed.geometry : parsed;
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
                // Convert this farm's "Add Commodity" rows into the
                // CommodityFormEntry[] shape FarmerController.create() /
                // buildPlotsForFarm() expects. Commodities with
                // separateArea checked and a matching subplotName are
                // grouped onto the SAME plotGroup key, so two commodities
                // sharing one separately-drawn subplot correctly count
                // that subplot's area only once (not per-commodity).
                const commodities: CommodityFormEntry[] = (f.commodities || [])
                    .filter((c) => c.commodityName && c.commodityName.trim())
                    .map((c) => {
                        const entry: CommodityFormEntry = {
                            commodityName: c.commodityName.trim(),
                            role: c.role,
                            croppingSystem: c.croppingSystem,
                            plantedAreaHa: toNum(c.plantedAreaHa),
                            plantingYear: toNum(c.plantingYear),
                            numberOfTrees: toNum(c.numberOfTrees),
                            estimatedAnnualProduction: toNum(c.estimatedAnnualProduction),
                            unitOfMeasurement: c.unitOfMeasurement,
                            productionStatus: c.productionStatus,
                            expectedHarvestPeriod: c.expectedHarvestPeriod,
                        };
                        if (c.separateArea && c.subplotName && c.subplotName.trim()) {
                            const groupKey = c.subplotName.trim();
                            entry.plotGroup = groupKey;
                            entry.plotName = groupKey;
                            entry.plotAreaHa = c.subplotAreaHa;
                            if (c.subplotBoundaryGeoJson) {
                                try {
                                    const parsed = JSON.parse(c.subplotBoundaryGeoJson);
                                    entry.plotBoundary = parsed.geometry ? parsed.geometry : parsed;
                                } catch (e) {
                                    console.error('Failed to parse subplot boundary', e);
                                }
                            }
                        }
                        return entry;
                    });
                const { boundaryGeoJson, commodities: _rawCommodities, ...rest } = f;
                return { ...rest, location, commodities, cropType: commodities[0]?.commodityName };
            });

            // Offline creation: queue the full farmer+farms record locally and
            // sync later via OfflineBanner's "sync now" action (which posts to
            // /farmers/offline-sync). File attachments cannot be queued this
            // way (browsers don't persist File objects across page loads), so
            // they're simply omitted for offline submissions.
            if (!navigator.onLine) {
                OfflineDataService.saveFarmerLocally({
                    firstName: data.firstName, lastName: data.lastName, email: data.email,
                    phoneNumber: data.phoneNumber, gender: data.gender, dob: data.dob,
                    nationality: data.nationality, nationalId: data.nationalId, otherId: data.otherId,
                    address: data.address, community: data.community, district: data.district,
                    region: data.region, cooperativeName: data.cooperativeName, cooperativeId: data.cooperativeId,
                    cooperativeSource: data.cooperativeSource,
                    enumeratorName: data.enumeratorName, enumeratorId: data.enumeratorId, consent: data.consent,
                    farms: farmsPayload,
                });
                if (draftIdRef.current) OfflineDataService.deleteDraft(draftIdRef.current);
                alert('You are offline. Farmer & farm data saved locally. It will sync automatically when you are back online.');
                navigate('/farmers');
                setLoading(false);
                return;
            }

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
            formData.append('cooperativeSource', data.cooperativeSource || '');
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

            // Append Farms (payload already computed above, shared with the offline path)
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
                // Registration succeeded — this draft (if any) is now obsolete.
                if (draftIdRef.current) OfflineDataService.deleteDraft(draftIdRef.current);
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
            <div className="max-w-4xl mx-auto">
                <Link to="/farmers/mapping/start" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
                    <ArrowLeft className="h-4 w-4" /> Back to start
                </Link>
            </div>
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
                                <CooperativeField
                                    idPrefix="register-farmer"
                                    cooperativeName={watch('cooperativeName') || ''}
                                    cooperativeId={watch('cooperativeId') || ''}
                                    cooperativeSource={watch('cooperativeSource') || ''}
                                    onChange={(next) => {
                                        setValue('cooperativeName', next.cooperativeName);
                                        setValue('cooperativeId', next.cooperativeId);
                                        setValue('cooperativeSource', next.cooperativeSource);
                                    }}
                                />
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

                                            <FarmCommoditiesSection
                                                control={control}
                                                register={register}
                                                setValue={setValue}
                                                watch={watch}
                                                farmIndex={index}
                                            />
                                            <FarmAreaWarning watch={watch} farmIndex={index} />
                                        </div>
                                    </div>
                                ))}

                                <button type="button" onClick={() => append({ name: '', lat: 0, lng: 0, commodities: [{ ...DEFAULT_COMMODITY_ROW }] })} className="w-full flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none">
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
