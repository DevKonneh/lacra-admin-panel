import React from 'react';
import { useRegistration } from '../RegistrationContext';
import type { WarehouseInfo, ExporterInfo, CapacityUnit, OwnershipStatus } from '../types';
import FormField from '../../../components/forms/FormField';
import { TextInput, SelectInput, TextArea } from '../../../components/forms/inputs';
import CountyDistrictFields from '../../../components/forms/CountyDistrictFields';
import SupplierManager from '../../../components/forms/SupplierManager';
import Alert from '../../../components/forms/Alert';
import { isPositiveNumber, type FieldErrors } from '../validators';

export function validateStep4(category: string, state: ReturnType<typeof useRegistration>['state']): FieldErrors {
    // A Local Produce Buyer has no warehouse/operational requirements at
    // all - this entire step is skipped for that category by the wizard
    // (see ApplicationWizard.tsx's skipStep4), so no fields are ever
    // required here for it.
    if (category === 'LOCAL_BUYER') return {};

    const errors: FieldErrors = {};
    const w = state.warehouse;
    const req = (val: string, key: string, label: string) => { if (!val || !val.trim()) errors[key] = `${label} is required.`; };

    req(w.name, 'name', 'Warehouse name');
    req(w.county, 'county', 'Warehouse county');
    req(w.capacity, 'capacity', 'Storage capacity');
    if (w.capacity && !isPositiveNumber(w.capacity)) errors.capacity = 'Storage capacity must be a valid number.';
    req(w.capacityUnit, 'capacityUnit', 'Capacity unit');
    req(w.ownership, 'ownership', 'Ownership status');

    if (category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER') {
        req(w.gps, 'gps', 'GPS coordinates');
        const x = state.exporter;
        if (!x.exportVolume.trim()) errors.exportVolume = 'Expected annual export volume is required.';
        if (!x.destinationCountries.trim()) errors.destinationCountries = 'Destination country/countries are required.';
        if (!x.exitPoint.trim()) errors.exitPoint = 'Port or border exit point is required.';
    }
    return errors;
}

interface Step4Props {
    errors: FieldErrors;
}

// Step 4: Operations and Warehouse. The Warehouse section is shared
// across every category (same shape), but Export Operations fields and
// the repeatable Supplier list only appear for Local/Foreign Exporter, as
// per the spec's distinct "Export Operations" + "Export Warehouse"
// sub-sections (quality-control/fumigation notes only shown for
// exporters, and GPS is mandatory only for exporter warehouses).
const Step4Warehouse: React.FC<Step4Props> = ({ errors }) => {
    const { state, setWarehouse, setSuppliers } = useRegistration();
    const category = state.step1.category;
    const isExporter = category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER';
    const w = state.warehouse;
    const update = (patch: Partial<WarehouseInfo>) => setWarehouse({ ...w, ...patch });

    return (
        <div className="space-y-8">
            {isExporter && (
                <section>
                    <h2 className="text-base font-semibold text-slate-800 mb-4">Export Operations</h2>
                    <ExportOperationsFields errors={errors} />
                </section>
            )}

            <section>
                <h2 className="text-base font-semibold text-slate-800 mb-4">{isExporter ? 'Export Warehouse' : 'Warehouse Information'}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Warehouse Name" required error={errors.name}>
                        <TextInput value={w.name} onChange={(e) => update({ name: e.target.value })} />
                    </FormField>
                    <FormField label="Warehouse Code" hint="Where applicable">
                        <TextInput value={w.code} onChange={(e) => update({ code: e.target.value })} />
                    </FormField>
                    <FormField label="Warehouse Type">
                        <TextInput value={w.type} onChange={(e) => update({ type: e.target.value })} placeholder="e.g. Dry storage, Cold storage" />
                    </FormField>
                    <CountyDistrictFields
                        county={w.county} district={w.district}
                        onChange={(county, district) => update({ county, district })}
                        countyError={errors.county}
                        idPrefix="warehouse"
                    />
                    <FormField label="Community">
                        <TextInput value={w.community} onChange={(e) => update({ community: e.target.value })} />
                    </FormField>
                    <FormField label="Complete Physical Address" full>
                        <TextArea rows={2} value={w.address} onChange={(e) => update({ address: e.target.value })} />
                    </FormField>
                    <FormField
                        label="GPS Coordinates"
                        required={isExporter}
                        error={errors.gps}
                        hint={isExporter ? undefined : 'Where available'}
                        tooltip="Format: latitude, longitude (e.g. 6.3005, -10.7969)"
                    >
                        <TextInput value={w.gps} onChange={(e) => update({ gps: e.target.value })} placeholder="e.g. 6.3005, -10.7969" />
                    </FormField>
                    <FormField label="Storage Capacity" required error={errors.capacity}>
                        <TextInput type="number" min={0} value={w.capacity} onChange={(e) => update({ capacity: e.target.value })} />
                    </FormField>
                    <FormField label="Capacity Unit" required error={errors.capacityUnit}>
                        <SelectInput value={w.capacityUnit} onChange={(e) => update({ capacityUnit: e.target.value as CapacityUnit })}>
                            <option value="">Select...</option>
                            <option value="KG">Kilogram</option>
                            <option value="TON">Ton</option>
                            <option value="METRIC_TON">Metric Ton</option>
                        </SelectInput>
                    </FormField>
                    <FormField label="Distance Between Office and Warehouse" hint="e.g. in kilometers">
                        <TextInput value={w.distanceToOffice} onChange={(e) => update({ distanceToOffice: e.target.value })} />
                    </FormField>
                    <FormField label="Type of Weighing Scale">
                        <TextInput value={w.scaleType} onChange={(e) => update({ scaleType: e.target.value })} />
                    </FormField>
                    <FormField label="Ownership Status" required error={errors.ownership}>
                        <SelectInput value={w.ownership} onChange={(e) => update({ ownership: e.target.value as OwnershipStatus })}>
                            <option value="">Select...</option>
                            <option value="OWNED">Owned</option>
                            <option value="RENTED">Rented</option>
                            <option value="LEASED">Leased</option>
                        </SelectInput>
                    </FormField>
                    {isExporter && (
                        <>
                            <FormField label="Quality-Control Information" full>
                                <TextArea rows={2} value={w.qualityControlNotes} onChange={(e) => update({ qualityControlNotes: e.target.value })} />
                            </FormField>
                            <FormField label="Fumigation Information" full hint="Where applicable">
                                <TextArea rows={2} value={w.fumigationNotes} onChange={(e) => update({ fumigationNotes: e.target.value })} />
                            </FormField>
                        </>
                    )}
                </div>
            </section>

            {isExporter && (
                <section>
                    <SupplierManager records={state.suppliers} onChange={setSuppliers} />
                </section>
            )}
        </div>
    );
};

const ExportOperationsFields: React.FC<{ errors: FieldErrors }> = ({ errors }) => {
    const { state, setExporter } = useRegistration();
    const x = state.exporter;
    const update = (patch: Partial<ExporterInfo>) => setExporter({ ...x, ...patch });

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Expected Annual Export Volume" required error={errors.exportVolume}>
                    <TextInput type="number" min={0} value={x.exportVolume} onChange={(e) => update({ exportVolume: e.target.value })} />
                </FormField>
                <FormField label="Unit of Measurement">
                    <TextInput value={x.exportUnit} onChange={(e) => update({ exportUnit: e.target.value })} />
                </FormField>
                <FormField label="Country/Countries of Destination" required error={errors.destinationCountries} full>
                    <TextInput value={x.destinationCountries} onChange={(e) => update({ destinationCountries: e.target.value })} placeholder="e.g. Netherlands, Germany, USA" />
                </FormField>
                <FormField label="Port or Border Exit Point" required error={errors.exitPoint}>
                    <TextInput value={x.exitPoint} onChange={(e) => update({ exitPoint: e.target.value })} placeholder="e.g. Freeport of Monrovia" />
                </FormField>
                <FormField label="Source of Commodities">
                    <TextInput value={x.sourceOfCommodities} onChange={(e) => update({ sourceOfCommodities: e.target.value })} />
                </FormField>
                <FormField label="Source-Farm Geolocation Information" full hint="General description or coordinates of source farms">
                    <TextArea rows={2} value={x.sourceFarmGeo} onChange={(e) => update({ sourceFarmGeo: e.target.value })} />
                </FormField>
                <FormField label="Description of Traceability Arrangements" full>
                    <TextArea rows={3} value={x.traceabilityNotes} onChange={(e) => update({ traceabilityNotes: e.target.value })} />
                </FormField>
            </div>
            <Alert variant="info" title="Names of supplying agents, agencies or cooperatives">
                Add each registered agent, agency or cooperative supplying you in the "Commodity Suppliers" section below.
            </Alert>
        </div>
    );
};

export default Step4Warehouse;
