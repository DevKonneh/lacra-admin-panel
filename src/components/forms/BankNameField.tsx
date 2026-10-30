import React from 'react';
import { LIBERIA_BANKS } from '../../data/liberiaBanks';
import FormField from './FormField';
import SearchableSelect from './SearchableSelect';
import { TextInput } from './inputs';

interface BankNameFieldProps {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    idPrefix?: string;
}

// Bank Name is selected from a dropdown of the 9 commercial banks
// currently licensed by the Central Bank of Liberia, instead of being
// free-typed - this avoids inconsistent/misspelled bank names in
// submitted applications. "Other" reveals a free-text field for the
// rare case of a bank not on the list (e.g. a foreign bank for a
// Foreign Exporter's overseas account).
const BankNameField: React.FC<BankNameFieldProps> = ({ value, onChange, error, idPrefix = 'bank' }) => {
    const isKnownBank = LIBERIA_BANKS.includes(value) && value !== 'Other';
    const isOther = value === 'Other' || (!!value && !isKnownBank);

    return (
        <>
            <FormField label="Bank Name" required error={error} htmlFor={`${idPrefix}-bank-name`}>
                <SearchableSelect
                    id={`${idPrefix}-bank-name`}
                    value={isOther ? 'Other' : value}
                    onChange={(val) => onChange(val === 'Other' ? 'Other' : val)}
                    options={LIBERIA_BANKS}
                    placeholder="Select bank..."
                    hasError={!!error}
                />
            </FormField>
            {isOther && (
                <FormField label="Bank Name (specify)" required error={error} htmlFor={`${idPrefix}-bank-name-other`}>
                    <TextInput
                        id={`${idPrefix}-bank-name-other`}
                        value={value === 'Other' ? '' : value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Enter bank name"
                    />
                </FormField>
            )}
        </>
    );
};

export default BankNameField;
