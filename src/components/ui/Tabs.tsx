import React from 'react';

export interface TabItem {
    key: string;
    label: string;
    icon?: React.ReactNode;
    /** Optional small count/alert badge rendered after the label (e.g. "3"). */
    badge?: React.ReactNode;
}

interface TabsProps {
    items: TabItem[];
    activeKey: string;
    onChange: (key: string) => void;
    className?: string;
}

/**
 * Shared, minimal segmented-tab navigation. No existing Tabs/TabNav pattern
 * was found elsewhere in the codebase (every other multi-section page —
 * ApplicationDetail, CooperativeDetailPanel — uses stacked cards instead),
 * so this is a new, generic primitive following the same flat/bordered,
 * low-decoration visual language as Badge/Card/Button/PageHeader rather
 * than introducing a one-off bespoke tab bar just for the Farmer Profile.
 *
 * Underline-style (not pill/segmented-background) so it reads clearly as
 * navigation rather than another set of filter buttons, and scrolls
 * horizontally on narrow viewports instead of wrapping awkwardly.
 */
const Tabs: React.FC<TabsProps> = ({ items, activeKey, onChange, className = '' }) => (
    <div className={`border-b border-slate-200 overflow-x-auto ${className}`} role="tablist">
        <div className="flex gap-1 min-w-max">
            {items.map((item) => {
                const isActive = item.key === activeKey;
                return (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(item.key)}
                        className={[
                            'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-1 rounded-t-sm',
                            isActive
                                ? 'border-brand-green text-brand-green'
                                : 'border-transparent text-brand-muted hover:text-brand-text hover:border-slate-300',
                        ].join(' ')}
                    >
                        {item.icon && <span className="flex-shrink-0 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>}
                        {item.label}
                        {item.badge}
                    </button>
                );
            })}
        </div>
    </div>
);

export default Tabs;
