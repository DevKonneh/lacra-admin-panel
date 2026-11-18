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
    <div className="flex items-center gap-2.5 mb-4">
        {/* Slightly larger chip with a brand-brown ring, echoing the LACRA
            seal's ink color so section headers read with more presence
            without introducing a new "loud" color per section. */}
        <span className="flex items-center justify-center h-7 w-7 rounded-md bg-brand-green/10 text-brand-green ring-1 ring-brand-brown/15 flex-shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
            {icon}
        </span>
        <h2 className="text-[11.5px] font-bold text-brand-brown/90 tracking-widest uppercase whitespace-nowrap">
            {children}
        </h2>
        {/* Hairline rule now fades from a faint gold tint into slate, a subtle
            nod to the seal's gold without using gold as text (it fails
            contrast) or as a heavy decorative block. */}
        <div className="flex-1 h-px bg-gradient-to-r from-brand-gold/40 via-slate-200 to-slate-200" />
        {action && <div className="flex-shrink-0">{action}</div>}
    </div>
);

export default SectionHeading;
