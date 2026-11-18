import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

/**
 * Shared empty-state block: icon + title + description + optional action.
 * Flat dashed border (no shadow) consistent with the reduced-decoration
 * direction of the rest of the design system.
 */
const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-brand-green/25 rounded-lg bg-brand-green/[0.03]">
        {/* Icon chip now uses a faint brand-green tint instead of flat gray,
            so an empty list still reads as "part of this app" rather than
            a generic placeholder with no visual connection to the product. */}
        <div className="h-11 w-11 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center mb-3">
            {icon || <Inbox className="h-5 w-5" />}
        </div>
        <p className="text-sm font-semibold text-brand-brown">{title}</p>
        {description && <p className="text-xs text-brand-muted mt-1 max-w-sm">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);

export default EmptyState;
