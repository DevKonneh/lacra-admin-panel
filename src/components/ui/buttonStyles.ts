/**
 * Shared class-string builder for places that need button-like styling on a
 * non-<button> element (most commonly react-router <Link>, since several
 * pages use links for navigation-actions like "+ Register Farmer"). Keeps
 * Link-based actions visually consistent with <Button> without forcing a
 * <button> element where a real navigation link is more correct semantically.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary: 'bg-brand-green text-white border border-brand-green hover:bg-brand-green-hover',
    secondary: 'bg-white text-brand-text border border-slate-300 hover:bg-slate-50',
    outline: 'bg-transparent text-brand-green border border-brand-green/40 hover:bg-brand-green/5',
    ghost: 'bg-transparent text-brand-muted border border-transparent hover:bg-slate-100',
    danger: 'bg-red-600 text-white border border-red-600 hover:bg-red-700',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-sm px-3.5 py-2',
};

export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', extra = ''): string {
    return [
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        extra,
    ].join(' ');
}
