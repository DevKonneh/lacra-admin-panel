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
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
        <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            {icon || <Inbox className="h-5 w-5" />}
        </div>
        <p className="text-sm font-medium text-brand-text">{title}</p>
        {description && <p className="text-xs text-brand-muted mt-1 max-w-sm">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);

export default EmptyState;
