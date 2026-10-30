import React, { useEffect, useState } from 'react';
import FormField from './FormField';
import SearchableSelect from './SearchableSelect';
import { TextInput } from './inputs';
import { getCooperatives, type Cooperative } from '../../api/cooperatives';

const OTHER_OPTION = 'Other / Not Listed';

interface CooperativeLegalNameFieldProps {
    value: string;
    onChange: (next: string) => void;
    error?: string;
    idPrefix?: string;
}

/**
 * "Cooperative's Legal Name" field for the /apply wizard's Cooperative
 * category, backed by the real CDA (Cooperative Development Agency)
 * registry (GET /api/cooperatives) - lets the applicant pick their
 * cooperative from the known list instead of free-typing it, while still
 * allowing a manual entry via "Other / Not Listed" if their cooperative
 * isn't registered yet. Mirrors components/forms/CooperativeField.tsx's
 * known-value-vs-"Other" pattern, but operates on a single plain
 * `legalName` string (CooperativeInfo's shape) rather than the
 * name/id/source triple used by the farmer-registration flow.
 */
const CooperativeLegalNameField: React.FC<CooperativeLegalNameFieldProps> = ({
    value, onChange, error, idPrefix = 'coop-legal-name',
}) => {
    const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    // Once the applicant has typed a value that doesn't match any known
    // registry name (or explicitly chose "Other"), keep showing the
    // free-text field even while they're still typing - otherwise every
    // keystroke would briefly fail to match and flicker back to the
    // dropdown.
    const [forceOther, setForceOther] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getCooperatives();
                if (!cancelled) setCooperatives(res.data.data || []);
            } catch {
                // Non-fatal: the field still works as free text below -
                // this is reference data, not something that should block
                // registration if the backend is briefly unreachable.
                if (!cancelled) setLoadError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const options = [...cooperatives.map((c) => c.name), OTHER_OPTION];
    const matchesRegistry = cooperatives.some((c) => c.name === value);
    const isOther = forceOther || (!!value && !matchesRegistry);

    const handleSelect = (val: string) => {
        if (val === OTHER_OPTION) {
            setForceOther(true);
            onChange('');
            return;
        }
        setForceOther(false);
        onChange(val);
    };

    return (
        <>
            <FormField
                label="Cooperative's Legal Name"
                required
                error={isOther ? undefined : error}
                htmlFor={`${idPrefix}-select`}
                hint={
                    loadError
                        ? 'Could not load the CDA registry - you can still enter the name manually below.'
                        : "Select your cooperative from LACRA's registry, or choose \"Other / Not Listed\" if it isn't there yet."
                }
            >
                <SearchableSelect
                    id={`${idPrefix}-select`}
                    value={isOther ? OTHER_OPTION : value}
                    onChange={handleSelect}
                    options={options}
                    placeholder={loading ? 'Loading cooperative registry...' : 'Select cooperative...'}
                    disabled={loading}
                    hasError={!isOther && !!error}
                />
            </FormField>
            {isOther && (
                <FormField label="Cooperative Name (specify)" required error={error} htmlFor={`${idPrefix}-other`}>
                    <TextInput
                        id={`${idPrefix}-other`}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Enter your cooperative's legal name"
                        hasError={!!error}
                    />
                </FormField>
            )}
        </>
    );
};

export default CooperativeLegalNameField;
