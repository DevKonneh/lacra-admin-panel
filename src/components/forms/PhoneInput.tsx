import React from 'react';
import { inputClasses } from './inputs';

const COUNTRY_CODE = '+231';
const MAX_LOCAL_DIGITS = 9; // Liberian mobile numbers: 8-9 digits after the country code.

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    hasError?: boolean;
    disabled?: boolean;
    id?: string;
    placeholder?: string;
}

// Strips any existing country code / leading trunk "0" so we always work
// with just the bare local digits, regardless of how the value was
// previously stored (e.g. "+231770123456", "0770123456", "770123456").
function toLocalDigits(value: string): string {
    let v = (value || '').replace(/[\s-()]/g, '');
    if (v.startsWith(COUNTRY_CODE)) v = v.slice(COUNTRY_CODE.length);
    else if (v.startsWith('231')) v = v.slice(3);
    if (v.startsWith('0')) v = v.slice(1);
    return v.replace(/\D/g, '').slice(0, MAX_LOCAL_DIGITS);
}

// Phone number field permanently prefixed with Liberia's country code
// (+231) - the applicant only ever types the local digits, so every
// phone number captured across the form is stored/displayed in a
// consistent international format. Input is capped at
// MAX_LOCAL_DIGITS digits so the number can never exceed a valid
// Liberian mobile length.
const PhoneInput: React.FC<PhoneInputProps> = ({ value, onChange, hasError, disabled, id, placeholder = '77 012 3456' }) => {
    const localDigits = toLocalDigits(value);

    return (
        <div className={`flex ${inputClasses(hasError)} !p-0 overflow-hidden items-stretch focus-within:ring-4`}>
            <span className="flex items-center px-3.5 bg-slate-50 text-slate-600 text-sm font-semibold border-r border-slate-300 select-none flex-shrink-0 tracking-wide">
                {COUNTRY_CODE}
            </span>
            <input
                id={id}
                type="tel"
                inputMode="numeric"
                disabled={disabled}
                value={localDigits}
                onChange={(e) => onChange(`${COUNTRY_CODE}${e.target.value.replace(/\D/g, '').slice(0, MAX_LOCAL_DIGITS)}`)}
                placeholder={placeholder}
                maxLength={MAX_LOCAL_DIGITS}
                className="flex-1 min-w-0 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
        </div>
    );
};

export default PhoneInput;
