import React from 'react';

interface SectionHeadingProps {
    /** Small icon shown in a colored chip to the left of the label — gives
     * each dashboard section a visual anchor instead of a bare line of
     * uppercase gray text floating with nothing to distinguish it from the
     * surrounding whitespace. */
    icon: React.ReactNode;
    children: React.ReactNode;
    /** Optional right-aligned slot (e.g. a count badge or a link). */
    action?: React.ReactNode;
}

/**
 * Shared section header for dashboard-style pages: icon chip + bold label +
 * a hairline rule that fills the remaining width, so every section reads as
 * a clearly separated block instead of all content running together.
 * Used by Dashboard.tsx and NeedsAttentionSection.tsx so both match.
 */
const SectionHeading: React.FC<SectionHeadingProps> = ({ icon, children, action }) => (
    <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center justify-center h-6 w-6 rounded-md bg-brand-green/10 text-brand-green flex-shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
            {icon}
        </span>
        <h2 className="text-[11px] font-bold text-slate-500 tracking-widest uppercase whitespace-nowrap">
            {children}
        </h2>
        <div className="flex-1 h-px bg-slate-200" />
        {action && <div className="flex-shrink-0">{action}</div>}
    </div>
);

export default SectionHeading;
