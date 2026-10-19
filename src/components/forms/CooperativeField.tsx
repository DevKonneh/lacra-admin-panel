import React, { useEffect, useState } from 'react';
import FormField from './FormField';
import SearchableSelect from './SearchableSelect';
import { TextInput } from './inputs';
import { getCooperatives, type Cooperative } from '../../api/cooperatives';

const OTHER_OPTION = 'Other / Not Listed';

interface CooperativeFieldProps {
    cooperativeName: string;
    cooperativeId: string;
    cooperativeSource: string; // 'CDA_REGISTRY' | 'OTHER' | ''
    onChange: (next: { cooperativeName: string; cooperativeId: string; cooperativeSource: string }) => void;
    idPrefix?: string;
}

/**
 * "Group / Cooperative Affiliation" field, backed by the real CDA
 * (Cooperative Development Agency) registry (GET /api/cooperatives) -
 * replaces the old plain free-text Cooperative Name/ID inputs, matching
 * the mobile app's equivalent CDA-registry picker (see
 * flutter_app/lib/widgets/farmer_personal_info_step.dart) so both clients
 * tag farmers consistently. Mirrors BankNameField's
 * known-value-vs-"Other"-reveals-free-text pattern already used elsewhere
 * in this form.
 *
 * `cooperativeSource` is stamped 'CDA_REGISTRY' when a real registry entry
 * is picked, or 'OTHER' when the enumerator types a name manually (e.g.
 * the farmer's cooperative isn't in the registry yet) - the same
 * provenance tag the mobile app writes, letting LACRA/CDA reconcile
 * 'OTHER' entries against the official registry later.
 */
const CooperativeField: React.FC<CooperativeFieldProps> = ({
    cooperativeName, cooperativeId, cooperativeSource, onChange, idPrefix = 'coop',
}) => {
    const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getCooperatives();
                if (!cancelled) setCooperatives(res.data.data || []);
            } catch {
                // Non-fatal: the field still works as free text below -
                // this is reference data, not something that should block
                // farmer registration if the backend is briefly unreachable.
                if (!cancelled) setLoadError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const options = [...cooperatives.map((c) => c.name), OTHER_OPTION];

    // Reconstruct the dropdown's displayed value from the three underlying
    // fields: a known registry name, 'Other / Not Listed' once any free
    // text has been typed under OTHER, or '' for untouched.
    const isOther = cooperativeSource === 'OTHER';
    const selectValue = isOther ? OTHER_OPTION : cooperativeName;

    const handleSelect = (val: string) => {
        if (val === OTHER_OPTION) {
            onChange({ cooperativeName: '', cooperativeId: '', cooperativeSource: 'OTHER' });
            return;
        }
        const match = cooperatives.find((c) => c.name === val);
        onChange({
            cooperativeName: val,
            // The registry's internal slug/id isn't a membership number -
            // leave Cooperative ID blank for registry picks (same as the
            // mobile app, which no longer collects a separate Cooperative
            // ID at all - see FarmerPersonalInfoStep's comment on this).
            cooperativeId: '',
            cooperativeSource: match ? 'CDA_REGISTRY' : '',
        });
    };

    return (
        <>
            <FormField
                label="Cooperative"
                htmlFor={`${idPrefix}-cooperative-name`}
                hint={
                    loadError
                        ? 'Could not load the CDA registry - you can still enter a name manually below.'
                        : 'Search the CDA (Cooperative Development Agency) registry, or choose "Other / Not Listed".'
                }
            >
                <SearchableSelect
                    id={`${idPrefix}-cooperative-name`}
                    value={selectValue}
                    onChange={handleSelect}
                    options={options}
                    placeholder={loading ? 'Loading CDA registry...' : 'Select cooperative...'}
                    disabled={loading}
                />
            </FormField>
            {isOther && (
                <FormField label="Cooperative Name (specify)" htmlFor={`${idPrefix}-cooperative-other`}>
                    <TextInput
                        id={`${idPrefix}-cooperative-other`}
                        value={cooperativeName}
                        onChange={(e) => onChange({ cooperativeName: e.target.value, cooperativeId, cooperativeSource: 'OTHER' })}
                        placeholder="Enter cooperative name"
                    />
                </FormField>
            )}
        </>
    );
};

export default CooperativeField;
