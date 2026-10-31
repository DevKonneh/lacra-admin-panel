import React from 'react';
import { AlertTriangle, Search } from 'lucide-react';

interface QueueListPageProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    searchTerm: string;
    onSearchTermChange: (value: string) => void;
    searchPlaceholder: string;
    error: string;
    onRetry: () => void;
    resultCount: number;
    loading: boolean;
    tabs?: React.ReactNode;
    children: React.ReactNode;
}

// Shared shell for every application review queue page (Commercial,
// Technical, Inspector, Billing, Payment, IT, DG Approval). Previously
// each queue page duplicated its own header/search-box/error-banner
// markup, which meant the loading state was just a bare "Loading
// queue..." line and an error only ever showed as a thin red strip with
// no way to retry other than refreshing the whole page. Centralizing the
// shell here means every queue page automatically gets:
//  - a colored icon badge next to the title, matching the Dashboard's
//    visual language instead of a plain text heading;
//  - a proper error state with an icon, message, and a "Try Again" button
//    that re-runs the page's own load function (mirroring the polish
//    already applied to LicenseList.tsx);
//  - a live result count next to the search box, so staff can see at a
//    glance how many applications are in the queue without counting rows.
const QueueListPage: React.FC<QueueListPageProps> = ({
    title,
    description,
    icon,
    searchTerm,
    onSearchTermChange,
    searchPlaceholder,
    error,
    onRetry,
    resultCount,
    loading,
    tabs,
    children,
}) => {
    return (
        <div className="space-y-6">
            <div className="flex items-start gap-3">
                <div className="h-11 w-11 flex-shrink-0 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green">
                    {icon}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
            </div>

            {tabs}

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                    <button
                        onClick={onRetry}
                        className="flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                    >
                        Try Again
                    </button>
                </div>
            ) : null}

            <div className="bg-white shadow rounded-xl overflow-hidden border border-slate-100">
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => onSearchTermChange(e.target.value)}
                        />
                    </div>
                    {!loading && !error && (
                        <span className="text-xs font-medium text-slate-500 flex-shrink-0 sm:text-right">
                            {resultCount} {resultCount === 1 ? 'application' : 'applications'}
                        </span>
                    )}
                </div>

                <div className="p-4">{children}</div>
            </div>
        </div>
    );
};

export default QueueListPage;
