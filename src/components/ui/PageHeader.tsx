import React from 'react';
import Breadcrumb from './Breadcrumb';
import type { BreadcrumbItem } from './Breadcrumb';

interface PageHeaderProps {
    /** Breadcrumb trail, NOT including "Dashboard" (added automatically). */
    breadcrumb?: BreadcrumbItem[];
    /** Page/module title — e.g. "Farmer Registry". Distinct from the global
     * "LACRA CMIS" app identity shown in the topbar; this is page-local. */
    title: string;
    /** One concise sentence describing the page's purpose. Keep it short —
     * longer explanatory copy belongs in in-page help text, not the header. */
    description?: string;
    /** Right-aligned action buttons/links (e.g. "+ Register Farmer"). */
    actions?: React.ReactNode;
    /** Optional small metadata line under the description (e.g. "Source: CDA · Last updated: ..."). */
    meta?: React.ReactNode;
}

/**
 * Shared page header used across every top-level page: breadcrumb, title,
 * concise description, and an actions slot. Replaces each page's previous
 * hand-rolled <h1>+<p> block and the duplicate title the Layout topbar used
 * to render for the same route (Layout now shows only the static app
 * identity, so there's exactly one place titles/descriptions live).
 *
 * Layout uses flex-wrap so long titles and multiple action buttons wrap
 * cleanly on narrow viewports instead of overlapping or being clipped.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ breadcrumb, title, description, actions, meta }) => {
    return (
        <div className="mb-6">
            {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-semibold text-brand-text leading-tight break-words">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-sm text-brand-muted mt-1 max-w-2xl">{description}</p>
                    )}
                    {meta && <div className="mt-1">{meta}</div>}
                </div>
                {actions && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PageHeader;
