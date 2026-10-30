import React from 'react';

// Shared Tailwind classes for text-like inputs/selects/textareas, applied
// consistently across the entire registration form. `hasError` swaps the
// border/ring to red so invalid fields are visually obvious immediately
// next to their inline error message (rendered by FormField). The
// slightly taller padding, subtle hover state and smooth multi-property
// transition are deliberate - this is what reads as a polished,
// production-grade form rather than a bare default-styled one.
export function inputClasses(hasError?: boolean) {
    return [
        'block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition-all duration-150',
        'placeholder:text-slate-400',
        'focus:outline-none focus:ring-4 focus:ring-offset-0',
        hasError
            ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
            : 'border-slate-300 hover:border-slate-400 focus:border-brand-green focus:ring-brand-green/15',
    ].join(' ');
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean };
export const TextInput: React.FC<InputProps> = ({ hasError, className, ...props }) => (
    <input className={`${inputClasses(hasError)} ${className || ''}`} {...props} />
);

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean };
export const SelectInput: React.FC<SelectProps> = ({ hasError, className, children, ...props }) => (
    <select className={`${inputClasses(hasError)} bg-white ${className || ''}`} {...props}>
        {children}
    </select>
);

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean };
export const TextArea: React.FC<TextAreaProps> = ({ hasError, className, ...props }) => (
    <textarea className={`${inputClasses(hasError)} resize-y ${className || ''}`} {...props} />
);

export const Checkbox: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }> = ({
    label,
    className,
    id,
    ...props
}) => (
    <label htmlFor={id} className="inline-flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
        <input
            id={id}
            type="checkbox"
            className={`mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-green focus:ring-brand-green/40 ${className || ''}`}
            {...props}
        />
        <span>{label}</span>
    </label>
);
