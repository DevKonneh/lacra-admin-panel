import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface FormFieldProps {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    tooltip?: string;
    full?: boolean;
    children: React.ReactNode;
    htmlFor?: string;
}

// Shared label + error + tooltip wrapper used by every field in the
// registration form, so spacing/typography/error styling stays perfectly
// consistent across all five application categories without repeating
// markup in every step component.
const FormField: React.FC<FormFieldProps> = ({ label, required, error, hint, tooltip, full, children, htmlFor }) => {
    const [showTip, setShowTip] = useState(false);

    return (
        <div className={full ? 'sm:col-span-2' : ''}>
            <div className="flex items-center gap-1.5 mb-1">
                <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
                    {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
                </label>
                {tooltip && (
                    <span className="relative inline-flex">
                        <button
                            type="button"
                            aria-label={`More information about ${label}`}
                            className="text-slate-400 hover:text-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/40 rounded-full"
                            onMouseEnter={() => setShowTip(true)}
                            onMouseLeave={() => setShowTip(false)}
                            onFocus={() => setShowTip(true)}
                            onBlur={() => setShowTip(false)}
                            onClick={() => setShowTip((s) => !s)}
                        >
                            <HelpCircle size={14} />
                        </button>
                        {showTip && (
                            <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 rounded-lg bg-slate-800 text-white text-xs px-3 py-2 shadow-lg leading-snug">
                                {tooltip}
                            </span>
                        )}
                    </span>
                )}
            </div>
            {children}
            {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
            {error && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
};

export default FormField;
