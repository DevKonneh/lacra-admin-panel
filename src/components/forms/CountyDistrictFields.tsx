import React from 'react';
import FormField from './FormField';
import SearchableSelect from './SearchableSelect';
import { COUNTY_NAMES, getDistrictsForCounty } from '../../data/liberiaCounties';

interface CountyDistrictFieldsProps {
    county: string;
    district: string;
    // Single combined callback (instead of separate onCountyChange /
    // onDistrictChange) so that each selection results in exactly ONE
    // state update in the consuming component. Two separate callbacks
    // fired back-to-back in the same synchronous handler both trace back
    // through a shared `{ ...stale, patch }` closure, so the second call
    // silently discards the first (the county-not-selecting bug). A
    // single onChange(county, district) call avoids that entirely.
    onChange: (county: string, district: string) => void;
    countyError?: string;
    districtError?: string;
    countyRequired?: boolean;
    districtRequired?: boolean;
    idPrefix?: string;
}

// Cascading County -> District picker: changing the county resets the
// district selection and repopulates the district list from the lookup
// table, so applicants can never end up with a mismatched county/district
// pair. Used identically across every category's location section.
const CountyDistrictFields: React.FC<CountyDistrictFieldsProps> = ({
    county, district, onChange,
    countyError, districtError, countyRequired = true, districtRequired = false, idPrefix = 'loc',
}) => {
    const districts = getDistrictsForCounty(county);

    return (
        <>
            <FormField label="County" required={countyRequired} error={countyError} htmlFor={`${idPrefix}-county`}>
                <SearchableSelect
                    id={`${idPrefix}-county`}
                    value={county}
                    onChange={(val) => onChange(val, '')} // reset dependent field, single atomic update
                    options={COUNTY_NAMES}
                    placeholder="Select county..."
                    hasError={!!countyError}
                />
            </FormField>
            <FormField label="District" required={districtRequired} error={districtError} htmlFor={`${idPrefix}-district`}>
                <SearchableSelect
                    id={`${idPrefix}-district`}
                    value={district}
                    onChange={(val) => onChange(county, val)}
                    options={districts}
                    placeholder={county ? 'Select district...' : 'Select a county first'}
                    hasError={!!districtError}
                    disabled={!county}
                />
            </FormField>
        </>
    );
};

export default CountyDistrictFields;
