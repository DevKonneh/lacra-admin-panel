import React from 'react';

export type BadgeTone = 'green' | 'red' | 'amber' | 'blue' | 'slate' | 'indigo' | 'orange';

const TONE_CLASSES: Record<BadgeTone, string> = {
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
};

interface BadgeProps {
    tone: BadgeTone;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

/**
 * Shared status badge: always pairs an icon + text label with color so
 * status is never conveyed by color alone. Uses a moderate `rounded-md`
 * (not `rounded-full`) and a 1px border instead of a shadow, per the
 * "reduce excessive rounded containers / decorative color" guidance —
 * color here is purposeful (semantic status), not decorative.
 */
const Badge: React.FC<BadgeProps> = ({ tone, icon, children, className = '' }) => (
    <span
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
        {icon && <span className="flex-shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
        {children}
    </span>
);

export default Badge;
