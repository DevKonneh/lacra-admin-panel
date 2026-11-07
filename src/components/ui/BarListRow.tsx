import React from 'react';

interface BarListRowProps {
    label: string;
    count: number;
    /** Highest count in the list this row belongs to — the bar's width is
     * count/maxCount, so the largest row in each list always reads as a
     * full-width bar and the rest scale relative to it. */
    maxCount: number;
    onClick?: () => void;
    colorClassName?: string; // Tailwind bg-* class for the filled bar
}

/**
 * A single labeled row with a proportional horizontal bar behind the count,
 * replacing flat "label ... number" rows that gave no sense of relative
 * scale across a breakdown list (Gender / County / Commodity). The bar
 * itself is a background layer so the row is still a full-width clickable
 * button with the same hover affordance as before.
 */
const BarListRow: React.FC<BarListRowProps> = ({ label, count, maxCount, onClick, colorClassName = 'bg-brand-green/15' }) => {
    const pct = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 4 : 0) : 0;
    const Comp = onClick ? 'button' : 'div';

    return (
        <Comp
            onClick={onClick}
            className={`relative w-full overflow-hidden rounded-lg border border-gray-100 text-left ${onClick ? 'hover:border-brand-green/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green' : ''}`}
        >
            <div
                className={`absolute inset-y-0 left-0 ${colorClassName} transition-all duration-500`}
                style={{ width: `${pct}%` }}
                aria-hidden="true"
            />
            <div className="relative flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-gray-700 truncate">{label}</span>
                <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{count}</span>
            </div>
        </Comp>
    );
};

export default BarListRow;
