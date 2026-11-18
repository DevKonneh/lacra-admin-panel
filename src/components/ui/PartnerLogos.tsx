import React from 'react';
import ifadLogo from '../../assets/ifad_logo.png';
import efiLogo from '../../assets/efi_logo.png';

interface PartnerLogosProps {
    /**
     * 'card' - a self-contained white badge/plate, for use on dark or
     *          colored backgrounds where the logos' own dark artwork needs
     *          a light backing to read. Currently unused (both placements
     *          now live on light surfaces) but kept available.
     * 'inline' - no card/background of its own, just the label + logos,
     *          for use on surfaces that are already light (the Login
     *          card, the Sidebar footer).
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
 * institutional platforms: each logo sits in a quiet, desaturated state at
 * rest and independently lights up to full brand color (plus a subtle
 * lift/scale) on hover or keyboard focus — the other logo stays muted, so
 * the highlight reads as a deliberate per-logo interaction rather than the
 * whole row flashing at once.
 *
 * Kept to a single component so the lockup looks identical (and stays
 * trivial to update, e.g. if a third partner is added later) everywhere
 * it appears — the Login card and the Sidebar footer.
 */
const PartnerLogos: React.FC<PartnerLogosProps> = ({ variant = 'inline', size = 'md', className = '' }) => {
    const logoHeight = size === 'sm' ? 'h-4' : 'h-6';
    const gap = size === 'sm' ? 'gap-4' : 'gap-6';
    const labelSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

    // Each logo gets its own named hover/focus group (`ifad` / `efi`) so
    // hovering one lights up only that logo — full color, a touch larger,
    // and a soft drop-shadow "glow" — while its neighbor stays muted.
    const logoBase =
        'w-auto object-contain grayscale opacity-55 scale-100 ' +
        'transition-all duration-300 ease-out cursor-default';

    const ifadHover =
        'group-hover/ifad:grayscale-0 group-hover/ifad:opacity-100 group-hover/ifad:scale-110 ' +
        'group-focus-visible/ifad:grayscale-0 group-focus-visible/ifad:opacity-100 group-focus-visible/ifad:scale-110 ' +
        'group-hover/ifad:drop-shadow-[0_2px_8px_rgba(37,99,235,0.35)]';

    const efiHover =
        'group-hover/efi:grayscale-0 group-hover/efi:opacity-100 group-hover/efi:scale-110 ' +
        'group-focus-visible/efi:grayscale-0 group-focus-visible/efi:opacity-100 group-focus-visible/efi:scale-110 ' +
        'group-hover/efi:drop-shadow-[0_2px_8px_rgba(15,23,42,0.35)]';

    const content = (
        <div className={`flex flex-col items-center ${size === 'sm' ? 'gap-2' : 'gap-2.5'}`}>
            <span className={`${labelSize} font-bold uppercase tracking-[0.18em] ${variant === 'card' ? 'text-slate-400' : 'text-brand-muted/80'}`}>
                Supported by
            </span>
            <div className={`flex items-center ${gap}`}>
                <span className="group/ifad inline-flex" tabIndex={0}>
                    <img
                        src={ifadLogo}
                        alt="IFAD — International Fund for Agricultural Development"
                        title="IFAD — International Fund for Agricultural Development"
                        className={`${logoHeight} ${logoBase} ${ifadHover}`}
                    />
                </span>
                <span className={`w-px self-stretch ${variant === 'card' ? 'bg-slate-200' : 'bg-brand-border'}`} aria-hidden="true" />
                <span className="group/efi inline-flex" tabIndex={0}>
                    <img
                        src={efiLogo}
                        alt="EFI — European Forest Institute"
                        title="EFI — European Forest Institute"
                        className={`${logoHeight} ${logoBase} ${efiHover}`}
                    />
                </span>
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
