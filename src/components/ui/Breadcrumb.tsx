import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
    label: string;
    to?: string;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
}

/**
 * Shared breadcrumb trail used at the top of every standardized page header.
 * Always starts from Home ("/") so users have a consistent anchor back to
 * the dashboard regardless of how deep the current page sits in navigation.
 */
const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
    return (
        <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-brand-muted">
                <li className="flex items-center gap-1">
                    <Link
                        to="/"
                        className="flex items-center gap-1 hover:text-brand-green focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50 rounded px-0.5"
                        aria-label="Go to Dashboard"
                    >
                        <Home className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Dashboard</span>
                    </Link>
                </li>
                {items.map((item, idx) => {
                    const isLast = idx === items.length - 1;
                    return (
                        <li key={`${item.label}-${idx}`} className="flex items-center gap-1">
                            <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
                            {item.to && !isLast ? (
                                <Link
                                    to={item.to}
                                    className="hover:text-brand-green focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50 rounded px-0.5"
                                >
                                    {item.label}
                                </Link>
                            ) : (
                                <span
                                    className={isLast ? 'font-medium text-brand-text' : ''}
                                    aria-current={isLast ? 'page' : undefined}
                                >
                                    {item.label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Breadcrumb;
