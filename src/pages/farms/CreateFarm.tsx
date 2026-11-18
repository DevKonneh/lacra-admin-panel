import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { createFarm } from '../../api/farms';
import { OfflineDataService } from '../../services/OfflineDataService';
import PolygonMapSelector, { type PolygonResult } from '../../components/PolygonMapSelector';
import type { CommodityFormEntry, CommodityRole, CroppingSystem, ProductionStatus } from '../../api/farmers';
import { ArrowLeft, Plus, Trash2, Sprout, MapPin, AlertTriangle } from 'lucide-react';

// One "Add Commodity" row in the form. Numeric-looking fields are kept as
// plain strings here because that's what native <input type="number">
// actually hands back via react-hook-form's default register() (no
// valueAsNumber) — they're converted to real numbers (or dropped if blank)
// in buildCommoditiesPayload() below via toNum().
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
    /**
     * '' = this commodity shares the farm's own boundary/polygon (the
     * "intercropped / mixed on the same land" case — no separate subplot,
     * no double-counted area). Otherwise it's the `key` of one of the
     * `subplots` below (a separately drawn physical area).
     */
    plotGroup: string;
}

// A separately-drawn physical subplot, with its own name + polygon + area.
// Managed as plain component state (not react-hook-form fields) since each
// one embeds its own <PolygonMapSelector> map instance.
interface SubplotGroup {
    key: string;
    name: string;
    boundaryGeoJson?: string;
    areaHa?: number;
}

const DEFAULT_COMMODITY: CommodityRow = {
    commodityName: '',
    role: 'Primary',
    croppingSystem: 'Monocrop',
    productionStatus: 'Producing',
    plotGroup: '',
};

interface NewFarmForm {
    name: string;
    lat: number;
    lng: number;
    totalAreaHa?: number;
    boundaryGeoJson?: string;
    documentType?: string;
    documentUrl?: string;
    // Full farm-detail field set — same fields collected per-farm during
    // brand-new farmer registration (RegisterFarmer.tsx), so a farm added
    // to an existing farmer via this same screen captures identical detail.
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
    farmPhotos?: FileList;
    commodities: CommodityRow[];
}

const toNum = (v: string | undefined): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
};

const CreateFarm: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { farmerId, farmerName } = location.state || {};
    const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<NewFarmForm>({
        defaultValues: { commodities: [{ ...DEFAULT_COMMODITY }] },
    });
    const { fields, append, remove } = useFieldArray({ control, name: 'commodities' });
    const [loading, setLoading] = useState(false);
    const [subplots, setSubplots] = useState<SubplotGroup[]>([]);
    const boundaryGeoJson = watch('boundaryGeoJson');
    const totalAreaHa = watch('totalAreaHa');

    const addSubplot = () => {
        const key = `plot-${Date.now()}`;
        setSubplots((prev) => [...prev, { key, name: `Subplot ${prev.length + 1}` }]);
    };
    const removeSubplot = (key: string) => {
        setSubplots((prev) => prev.filter((s) => s.key !== key));
        // Any commodity rows pointing at the removed subplot fall back to
        // the shared farm boundary rather than referencing a dangling key.
        fields.forEach((_, idx) => {
            if (watch(`commodities.${idx}.plotGroup`) === key) {
                setValue(`commodities.${idx}.plotGroup`, '');
            }
        });
    };
    const updateSubplot = (key: string, patch: Partial<SubplotGroup>) => {
        setSubplots((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    };

    // Client-side mirror of the backend's computeAreaWarning() logic — the
    // shared/default plot always mirrors the farm's own totalAreaHa, so it
    // is deliberately excluded from this sum to avoid falsely warning.
    const separateSubplotAreaHa = useMemo(
        () => subplots.reduce((sum, s) => sum + (s.areaHa || 0), 0),
        [subplots]
    );
    const areaExceedsWarning =
        !!totalAreaHa && separateSubplotAreaHa > totalAreaHa + 0.0001
            ? `Total subplot area (${separateSubplotAreaHa.toFixed(2)} ha) exceeds the farm's calculated total area (${totalAreaHa.toFixed(2)} ha). Please review the drawn subplot boundaries.`
            : null;

    // Build a real polygon geometry from the drawn boundary, falling back to a
    // small synthetic square around the point only if nothing was drawn.
    const buildLocation = (data: NewFarmForm) => {
        if (data.boundaryGeoJson) {
            try {
                const parsed = JSON.parse(data.boundaryGeoJson);
                return parsed.geometry ? parsed.geometry : parsed;
            } catch (e) {
                console.error('Failed to parse drawn boundary, falling back to point square', e);
            }
        }
        return {
            type: "Polygon",
            coordinates: [[
                [data.lng - 0.001, data.lat - 0.001],
                [data.lng + 0.001, data.lat - 0.001],
                [data.lng + 0.001, data.lat + 0.001],
                [data.lng - 0.001, data.lat + 0.001],
                [data.lng - 0.001, data.lat - 0.001]
            ]]
        };
    };

    // Converts the per-commodity form rows + subplot state into the
    // CommodityFormEntry[] shape FarmController.parseCommodities() expects.
    const buildCommoditiesPayload = (data: NewFarmForm): CommodityFormEntry[] => {
        return (data.commodities || [])
            .filter((c) => c.commodityName && c.commodityName.trim())
            .map((c) => {
                const group = c.plotGroup ? subplots.find((s) => s.key === c.plotGroup) : undefined;
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
                if (group) {
                    entry.plotGroup = group.key;
                    entry.plotName = group.name;
                    entry.plotAreaHa = group.areaHa;
                    if (group.boundaryGeoJson) {
                        try {
                            const parsed = JSON.parse(group.boundaryGeoJson);
                            entry.plotBoundary = parsed.geometry ? parsed.geometry : parsed;
                        } catch (e) {
                            console.error('Failed to parse subplot boundary', e);
                        }
                    }
                }
                return entry;
            });
    };

    const onSubmit = async (data: NewFarmForm) => {
        setLoading(true);
        try {
            const geoLocation = buildLocation(data);
            const commoditiesPayload = buildCommoditiesPayload(data);
            if (commoditiesPayload.length === 0) {
                alert('Please add at least one commodity for this farm.');
                setLoading(false);
                return;
            }

            if (!navigator.onLine) {
                if (!farmerId) {
                    alert('Cannot save farm offline without selecting a farmer. Please connect and try again.');
                } else {
                    const { farmPhotos: _fp, boundaryGeoJson: _bgj, commodities: _c, ...rest } = data;
                    OfflineDataService.saveFarmLocally({
                        farmerId,
                        ...rest,
                        commodities: commoditiesPayload,
                        // Legacy single-crop fallback for any offline-sync code
                        // path that still only reads cropType directly.
                        cropType: commoditiesPayload[0]?.commodityName,
                        location: geoLocation,
                        polygonGeoJSON: geoLocation
                    } as any);
                    alert('You are offline. Farm data saved locally. Sync when back online.');
                    navigate('/farms');
                }
                setLoading(false);
                return;
            }

            const { boundaryGeoJson: _bgj, farmPhotos, commodities: _c, ...rest } = data;
            const res = await createFarm({ ...rest, commodities: commoditiesPayload, location: geoLocation, farmerId, farmPhotos });
            if (res.data.status) {
                navigate('/farms');
            } else {
                alert('Failed to create farm: ' + res.data.message);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to create farm");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center">
                <button onClick={() => navigate('/farms')} className="mr-4 text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">
                    Add New Farm
                    {farmerName && <span className="ml-2 text-sm font-normal text-gray-500">for {farmerName}</span>}
                </h1>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Farm Name *</label>
                            <input
                                {...register("name", { required: true })}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                placeholder="e.g. Cocoa Plot 1"
                            />
                            {errors.name && <span className="text-red-500 text-xs">This field is required</span>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Ownership Type</label>
                            <select
                                {...register("ownershipType")}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            >
                                <option value="Owned">Owned</option>
                                <option value="Rented">Rented</option>
                                <option value="Family Inherited">Family Inherited</option>
                                <option value="Communal">Communal</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Registration Status</label>
                            <select
                                {...register("farmRegistrationStatus")}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            >
                                <option value="Registered">Registered</option>
                                <option value="Not Registered">Not Registered</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Years in Cultivation</label>
                            <input {...register("yearsInCultivation")} type="number" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Harvest Season</label>
                            <input {...register("harvestSeason")} type="text" placeholder="e.g. Sept-Dec" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Average Yield</label>
                            <input {...register("averageYield")} type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Buyers</label>
                            <input {...register("buyers")} type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700">Farm Address / Location Description</label>
                            <input {...register("farmAddress")} type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                        </div>

                        <div className="md:col-span-3">
                            <div className="flex gap-6 mt-2">
                                <label className="flex items-center">
                                    <input {...register("useChemicals")} type="checkbox" className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                                    <span className="ml-2 text-sm text-gray-700">Uses Fertilizers / Chemicals?</span>
                                </label>
                                <label className="flex items-center">
                                    <input {...register("extensionServices")} type="checkbox" className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                                    <span className="ml-2 text-sm text-gray-700">Access to Extension Services?</span>
                                </label>
                            </div>
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700">Farm Photos (Upload Multiple)</label>
                            <input {...register("farmPhotos")} type="file" multiple accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                        </div>
                    </div>

                    {/* Commodities — replaces the old single "Crop Type" field. Each row
                        captures the full spec'd attribute set for one commodity on this
                        farm, and can be pinned to either the shared farm boundary
                        (intercropped/mixed) or a separately drawn subplot below. */}
                    <div className="bg-gray-50 rounded-md border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                                <Sprout className="h-5 w-5 text-green-600" /> Commodities *
                            </h3>
                            <button
                                type="button"
                                onClick={() => append({ ...DEFAULT_COMMODITY })}
                                className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800"
                            >
                                <Plus className="h-4 w-4" /> Add Commodity
                            </button>
                        </div>

                        <div className="space-y-4">
                            {fields.map((field, index) => (
                                <div key={field.id} className="relative bg-white border border-gray-200 rounded-md p-4">
                                    {fields.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
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
                                                {...register(`commodities.${index}.commodityName`, { required: true })}
                                                list="commodity-suggestions"
                                                placeholder="e.g. Cocoa"
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                            />
                                            {errors.commodities?.[index]?.commodityName && (
                                                <span className="text-red-500 text-xs">Required</span>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Primary / Secondary</label>
                                            <select
                                                {...register(`commodities.${index}.role`)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                            >
                                                <option value="Primary">Primary</option>
                                                <option value="Secondary">Secondary</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Cropping System</label>
                                            <select
                                                {...register(`commodities.${index}.croppingSystem`)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                            >
                                                <option value="Monocrop">Monocrop</option>
                                                <option value="Mixed">Mixed</option>
                                                <option value="Intercropped">Intercropped</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Planted Area (ha)</label>
                                            <input type="number" step="0.01" {...register(`commodities.${index}.plantedAreaHa`)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Planting Year</label>
                                            <input type="number" {...register(`commodities.${index}.plantingYear`)} placeholder="e.g. 2018" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">No. of Trees (if applicable)</label>
                                            <input type="number" {...register(`commodities.${index}.numberOfTrees`)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Est. Annual Production</label>
                                            <input type="number" step="0.01" {...register(`commodities.${index}.estimatedAnnualProduction`)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Unit of Measurement</label>
                                            <input {...register(`commodities.${index}.unitOfMeasurement`)} list="unit-suggestions" placeholder="e.g. kg, MT, bags" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Production Status</label>
                                            <select
                                                {...register(`commodities.${index}.productionStatus`)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                            >
                                                <option value="Not Yet Productive">Not Yet Productive</option>
                                                <option value="Producing">Producing</option>
                                                <option value="Declining">Declining</option>
                                                <option value="Dormant / Off-season">Dormant / Off-season</option>
                                                <option value="Abandoned">Abandoned</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700">Expected Harvest Period</label>
                                            <input {...register(`commodities.${index}.expectedHarvestPeriod`)} placeholder="e.g. Sept - Dec" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium text-gray-700 flex items-center gap-1">
                                                <MapPin className="h-3.5 w-3.5 text-gray-400" /> Growing Area
                                            </label>
                                            <select
                                                {...register(`commodities.${index}.plotGroup`)}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                            >
                                                <option value="">Shared farm boundary (intercropped / mixed on same land)</option>
                                                {subplots.map((s) => (
                                                    <option key={s.key} value={s.key}>
                                                        {s.name}{s.areaHa ? ` — ${s.areaHa.toFixed(2)} ha` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-[11px] text-gray-500 mt-1">
                                                Choose "Shared farm boundary" if this commodity is intercropped or mixed on the same
                                                land as others (its area won't be double-counted). Choose a separate subplot below only
                                                if it grows on its own distinct physical area of the farm.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
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

                    {/* Separate Subplots — only needed when commodities occupy distinct
                        physical areas of the farm. Each subplot gets its own name +
                        polygon + area, independent from the farm's own boundary below. */}
                    <div className="bg-gray-50 rounded-md border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-2 gap-3">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">Separate Subplots (optional)</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Only needed when different commodities occupy separate physical areas of the farm.
                                    Leave this empty if all commodities are intercropped/mixed on the same shared
                                    land — they'll automatically use the farm's own boundary below, with no
                                    double-counted area.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={addSubplot}
                                className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800 whitespace-nowrap"
                            >
                                <Plus className="h-4 w-4" /> Add Separate Subplot
                            </button>
                        </div>

                        {subplots.length > 0 && (
                            <div className="space-y-4 mt-3">
                                {subplots.map((s) => (
                                    <div key={s.key} className="bg-white border border-gray-200 rounded-md p-4">
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                            <input
                                                value={s.name}
                                                onChange={(e) => updateSubplot(s.key, { name: e.target.value })}
                                                className="flex-1 border border-gray-300 rounded-md shadow-sm py-1.5 px-3 text-sm focus:ring-green-500 focus:border-green-500"
                                                placeholder="Subplot name, e.g. Coffee Block"
                                            />
                                            <button type="button" onClick={() => removeSubplot(s.key)} className="text-red-500 hover:text-red-700">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="rounded-md overflow-hidden border border-gray-300">
                                            <PolygonMapSelector
                                                height="260px"
                                                onPolygonChange={(result: PolygonResult | null) => {
                                                    if (result) {
                                                        updateSubplot(s.key, {
                                                            boundaryGeoJson: JSON.stringify(result.geojson),
                                                            areaHa: result.areaHa,
                                                        });
                                                    } else {
                                                        updateSubplot(s.key, { boundaryGeoJson: undefined, areaHa: undefined });
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="mt-2 text-sm">
                                            {s.boundaryGeoJson ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    ✓ Boundary Captured{s.areaHa ? ` — ${s.areaHa.toFixed(2)} ha` : ''}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                    No boundary drawn yet
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <div className="flex items-center justify-between text-sm bg-white border border-gray-200 rounded-md px-3 py-2">
                                    <span className="text-gray-600">Total separate subplot area:</span>
                                    <span className="font-semibold text-gray-900">{separateSubplotAreaHa.toFixed(2)} ha</span>
                                </div>

                                {areaExceedsWarning && (
                                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-700">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span>{areaExceedsWarning}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance Documents</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Document Type</label>
                                <select
                                    {...register("documentType")}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                >
                                    <option value="Land Title">Land Title</option>
                                    <option value="Consent">Consent</option>
                                    <option value="Registration">Registration</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Document URL (Mock)</label>
                                <input
                                    {...register("documentUrl")}
                                    type="text"
                                    placeholder="https://example.com/doc.pdf"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Farm Boundary</label>
                        <div className="rounded-md overflow-hidden border border-gray-300">
                            <PolygonMapSelector
                                height="420px"
                                onPolygonChange={(result: PolygonResult | null) => {
                                    if (result) {
                                        setValue('boundaryGeoJson', JSON.stringify(result.geojson));
                                        setValue('totalAreaHa', result.areaHa);
                                        try {
                                            const coords = (result.geojson as any).geometry
                                                ? (result.geojson as any).geometry.coordinates[0]
                                                : (result.geojson as any).coordinates[0];
                                            const lats = coords.map((c: number[]) => c[1]);
                                            const lngs = coords.map((c: number[]) => c[0]);
                                            const centerLat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length;
                                            const centerLng = lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length;
                                            setValue('lat', centerLat);
                                            setValue('lng', centerLng);
                                        } catch (e) {
                                            console.error('Failed to compute centroid from drawn boundary', e);
                                        }
                                    } else {
                                        setValue('boundaryGeoJson', '');
                                        setValue('totalAreaHa', undefined);
                                    }
                                }}
                            />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                            {boundaryGeoJson ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ✓ Boundary Captured{totalAreaHa ? ` — ${totalAreaHa.toFixed(2)} ha` : ''}
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    No boundary drawn yet
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Draw the farm boundary on the map, or use the locate button to find your position, then draw around it.</p>
                        <input type="hidden" {...register("lat", { required: true })} />
                        <input type="hidden" {...register("lng", { required: true })} />
                        <input type="hidden" {...register("boundaryGeoJson")} />
                        <input type="hidden" {...register("totalAreaHa")} />
                        {(errors.lat || errors.lng) && <span className="text-red-500 text-xs">Please draw the farm boundary on the map</span>}
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="button"
                            onClick={() => navigate('/farms')}
                            className="mr-3 inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:text-sm"
                        >
                            {loading ? 'Creating...' : 'Create Farm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateFarm;
