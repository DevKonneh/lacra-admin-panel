import React from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    icon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
    primary: 'bg-brand-green text-white border border-brand-green hover:bg-brand-green-hover disabled:opacity-60',
    secondary: 'bg-white text-brand-text border border-slate-300 hover:bg-slate-50 disabled:opacity-60',
    outline: 'bg-transparent text-brand-green border border-brand-green/40 hover:bg-brand-green/5 disabled:opacity-60',
    ghost: 'bg-transparent text-brand-muted border border-transparent hover:bg-slate-100 disabled:opacity-60',
    danger: 'bg-red-600 text-white border border-red-600 hover:bg-red-700 disabled:opacity-60',
};

const SIZE_CLASSES: Record<Size, string> = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-sm px-3.5 py-2',
};

/**
 * Shared button primitive. Flat (no shadow), moderate rounding, and a
 * visible focus ring on every variant so keyboard focus is never invisible
 * (the single most commonly-missed accessibility requirement found during
 * the page-by-page audit).
 */
const Button: React.FC<ButtonProps> = ({
    variant = 'secondary',
    size = 'md',
    icon,
    className = '',
    children,
    ...rest
}) => (
    <button
        type="button"
        className={[
            'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1',
            VARIANT_CLASSES[variant],
            SIZE_CLASSES[size],
            className,
        ].join(' ')}
        {...rest}
    >
        {icon && <span className="flex-shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        {children}
    </button>
);

export default Button;
