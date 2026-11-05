import React from 'react';

/** Single shimmering placeholder bar. */
export const SkeletonBar: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
    <div className={`animate-pulse rounded bg-slate-200 ${className}`} />
);

/** Shared loading state for stat/summary card grids. */
export const SkeletonCardGrid: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="status" aria-label="Loading">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-lg p-4">
                <SkeletonBar className="h-9 w-9 rounded-md mb-3" />
                <SkeletonBar className="h-3 w-20 mb-2" />
                <SkeletonBar className="h-5 w-14" />
            </div>
        ))}
    </div>
);

/** Shared loading state for table rows. */
export const SkeletonTableRows: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 5 }) => (
    <>
        {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
                {Array.from({ length: columns }).map((_, c) => (
                    <td key={c} className="px-4 py-3">
                        <SkeletonBar className={`h-3.5 ${c === 0 ? 'w-32' : 'w-20'}`} />
                    </td>
                ))}
            </tr>
        ))}
    </>
);
