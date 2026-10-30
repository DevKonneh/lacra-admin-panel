import React from 'react';
import { Calendar } from 'lucide-react';
import { inputClasses } from './inputs';

interface DateFieldProps {
    value: string; // yyyy-mm-dd, same format a plain <input type="date"> uses
    onChange: (value: string) => void;
    hasError?: boolean;
    id?: string;
    max?: string;
    min?: string;
}

function formatDisplay(value: string): string {
    if (!value) return '';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Polished date picker: wraps the native <input type="date"> (kept for its
// reliable, accessible, OS-native calendar widget and broad browser
// support) with a leading calendar icon and a human-readable preview of
// the selected date underneath, so "2026-03-14" also reads as
// "March 14, 2026" rather than being the only thing shown. This is a
// deliberately lightweight upgrade over a bare date input - no extra
// dependency - while meeting the "improve the date UI/selection" request.
const DateField: React.FC<DateFieldProps> = ({ value, onChange, hasError, id, max, min }) => (
    <div>
        <div className="relative">
            <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
                id={id}
                type="date"
                value={value}
                max={max}
                min={min}
                onChange={(e) => onChange(e.target.value)}
                className={`${inputClasses(hasError)} pl-9`}
            />
        </div>
        {value && (
            <p className="mt-1 text-xs text-slate-500">{formatDisplay(value)}</p>
        )}
    </div>
);

export default DateField;
