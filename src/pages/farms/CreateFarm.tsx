import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { createFarm } from '../../api/farms';
import { OfflineDataService } from '../../services/OfflineDataService';
import PolygonMapSelector, { type PolygonResult } from '../../components/PolygonMapSelector';
import { ArrowLeft } from 'lucide-react';

interface NewFarmForm {
    name: string;
    cropType: string;
    lat: number;
    lng: number;
    totalAreaHa?: number;
    boundaryGeoJson?: string;
    documentType?: string;
    documentUrl?: string;
}

const CreateFarm: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { farmerId, farmerName } = location.state || {};
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<NewFarmForm>();
    const [loading, setLoading] = useState(false);
    const boundaryGeoJson = watch('boundaryGeoJson');
    const totalAreaHa = watch('totalAreaHa');

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

    const onSubmit = async (data: NewFarmForm) => {
        setLoading(true);
        try {
            const geoLocation = buildLocation(data);

            if (!navigator.onLine) {
                if (!farmerId) {
                    alert('Cannot save farm offline without selecting a farmer. Please connect and try again.');
                } else {
                    OfflineDataService.saveFarmLocally({
                        farmerId,
                        name: data.name,
                        cropType: data.cropType,
                        location: geoLocation,
                        totalAreaHa: data.totalAreaHa,
                        polygonGeoJSON: geoLocation
                    });
                    alert('You are offline. Farm data saved locally. Sync when back online.');
                    navigate('/farms');
                }
                setLoading(false);
                return;
            }

            const { boundaryGeoJson: _bgj, ...rest } = data;
            const res = await createFarm({ ...rest, location: geoLocation, farmerId });
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
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Farm Name</label>
                        <input
                            {...register("name", { required: true })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            placeholder="e.g. Cocoa Plot 1"
                        />
                        {errors.name && <span className="text-red-500 text-xs">This field is required</span>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Crop Type</label>
                        <select
                            {...register("cropType")}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        >
                            <option value="Cocoa">Cocoa</option>
                            <option value="Coffee">Coffee</option>
                            <option value="Palm">Palm</option>
                            <option value="Rubber">Rubber</option>
                            <option value="Cassava">Cassava</option>
                            <option value="Vegetables">Vegetables</option>
                            <option value="Other">Other</option>
                        </select>
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
