import React from 'react';
import ifadLogo from '../../assets/ifad_logo.png';
import efiLogo from '../../assets/efi_logo.png';

interface PartnerLogosProps {
    /**
     * 'card' - a self-contained white badge/plate, for use on dark or
     *          colored backgrounds (e.g. the Login hero panel) where the
     *          logos' own dark artwork needs a light backing to read.
     * 'inline' - no card/background of its own, just the label + logos,
     *          for use on surfaces that are already light (sidebar footer,
     *          login form card, a light page footer).
     */
    variant?: 'card' | 'inline';
    /** Visual density. 'sm' for tight spaces like a collapsed sidebar footer. */
    size?: 'sm' | 'md';
    className?: string;
}

/**
 * "Supported by" partner lockup for IFAD (International Fund for
 * Agricultural Development) and EFI (European Forest Institute), the two
 * organisations backing the LACRA CMIS platform.
 *
 * Styling follows the conventional "sponsor bar" treatment used by
 * institutional platforms: logos sit in a quiet, slightly desaturated
 * state and resolve to full color on hover/focus. This keeps the
 * attribution present everywhere without it visually competing with the
 * LACRA brand or the surrounding UI chrome, while still rewarding a closer
 * look with the organizations' real brand color (IFAD blue, EFI black).
 *
 * Kept to a single component so the lockup looks identical (and stays
 * trivial to update, e.g. if a third partner is added later) everywhere
 * it appears — the Login hero, the Login form card, and the Sidebar
 * footer.
 */
const PartnerLogos: React.FC<PartnerLogosProps> = ({ variant = 'inline', size = 'md', className = '' }) => {
    const logoHeight = size === 'sm' ? 'h-4' : 'h-6';
    const gap = size === 'sm' ? 'gap-4' : 'gap-6';
    const labelSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

    // Logos start desaturated/muted and "develop" into full color on
    // hover or keyboard focus — a deliberate, understated reveal rather
    // than flat full-color logos competing with everything else on the
    // page at all times.
    const logoBase =
        'w-auto object-contain grayscale opacity-60 transition-all duration-300 ease-out ' +
        'group-hover:grayscale-0 group-hover:opacity-100 group-focus-visible:grayscale-0 group-focus-visible:opacity-100';

    const content = (
        <div className={`flex flex-col items-center ${size === 'sm' ? 'gap-2' : 'gap-2.5'}`}>
            <span className={`${labelSize} font-bold uppercase tracking-[0.18em] ${variant === 'card' ? 'text-slate-400' : 'text-brand-muted/80'}`}>
                Supported by
            </span>
            <div className={`group flex items-center ${gap}`} tabIndex={0}>
                <img
                    src={ifadLogo}
                    alt="IFAD — International Fund for Agricultural Development"
                    title="IFAD — International Fund for Agricultural Development"
                    className={`${logoHeight} ${logoBase}`}
                />
                <span className={`w-px self-stretch ${variant === 'card' ? 'bg-slate-200' : 'bg-brand-border'}`} aria-hidden="true" />
                <img
                    src={efiLogo}
                    alt="EFI — European Forest Institute"
                    title="EFI — European Forest Institute"
                    className={`${logoHeight} ${logoBase}`}
                />
            </div>
        </div>
    );

    if (variant === 'card') {
        return (
            <div className={`inline-flex rounded-2xl bg-white/95 backdrop-blur-sm px-6 py-4 shadow-lg ring-1 ring-black/5 ${className}`}>
                {content}
            </div>
        );
    }

    return <div className={className}>{content}</div>;
};

export default PartnerLogos;
