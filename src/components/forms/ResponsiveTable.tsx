import React from 'react';
import { Inbox } from 'lucide-react';

export interface ColumnDef<T> {
    header: string;
    render: (row: T) => React.ReactNode;
    className?: string;
}

interface ResponsiveTableProps<T> {
    columns: ColumnDef<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    actions?: (row: T) => React.ReactNode;
    emptyIcon?: React.ReactNode;
    emptyTitle: string;
    emptyDescription: string;
    // When true, renders animated skeleton rows instead of `rows` - used
    // while the initial fetch is in flight so the table never flashes an
    // empty/"0 results" state before real data arrives. Column count is
    // read from `columns` automatically, so every caller gets a skeleton
    // that already matches its own table shape with no extra wiring.
    loading?: boolean;
    skeletonRowCount?: number;
}

// Animated placeholder bar used inside a skeleton cell. Widths vary
// slightly per column index purely so the skeleton doesn't look like a
// perfectly uniform grid, which reads as more obviously "fake".
const SKELETON_WIDTHS = ['w-24', 'w-28', 'w-20', 'w-16', 'w-20', 'w-24'];

// Generic table used for every repeatable-record list (personnel,
// leadership, farmers, suppliers, owners, and every application review
// queue). On large screens it renders as a normal data table; below the
// `sm` breakpoint it automatically renders each row as a stacked
// label/value card instead, per the mobile responsiveness requirement. A
// single clear empty-state is shown when there are no records yet, and a
// skeleton-row loading state when `loading` is true.
function ResponsiveTable<T>({ columns, rows, rowKey, actions, emptyIcon, emptyTitle, emptyDescription, loading, skeletonRowCount = 5 }: ResponsiveTableProps<T>) {
    if (loading) {
        return (
            <>
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                {columns.map((col) => (
                                    <th key={col.header} className={`px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide ${col.className || ''}`}>
                                        {col.header}
                                    </th>
                                ))}
                                {actions && <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {Array.from({ length: skeletonRowCount }).map((_, rowIdx) => (
                                <tr key={rowIdx}>
                                    {columns.map((col, colIdx) => (
                                        <td key={col.header} className="px-4 py-3">
                                            <div className={`h-3.5 ${SKELETON_WIDTHS[colIdx % SKELETON_WIDTHS.length]} bg-slate-200 rounded animate-pulse`} />
                                        </td>
                                    ))}
                                    {actions && (
                                        <td className="px-4 py-3 text-right">
                                            <div className="h-3.5 w-12 bg-slate-200 rounded animate-pulse ml-auto" />
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="sm:hidden space-y-3">
                    {Array.from({ length: Math.min(skeletonRowCount, 3) }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                            {columns.map((col, colIdx) => (
                                <div key={col.header} className="flex justify-between gap-3">
                                    <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                                    <div className={`h-3 ${SKELETON_WIDTHS[colIdx % SKELETON_WIDTHS.length]} bg-slate-200 rounded animate-pulse`} />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-10 px-4 text-center">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    {emptyIcon || <Inbox size={20} />}
                </div>
                <p className="text-sm font-medium text-slate-700">{emptyTitle}</p>
                <p className="text-xs text-slate-500 max-w-xs">{emptyDescription}</p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            {columns.map((col) => (
                                <th key={col.header} className={`px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide ${col.className || ''}`}>
                                    {col.header}
                                </th>
                            ))}
                            {actions && <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {rows.map((row) => (
                            <tr key={rowKey(row)} className="hover:bg-slate-50">
                                {columns.map((col) => (
                                    <td key={col.header} className={`px-4 py-2.5 text-slate-700 ${col.className || ''}`}>
                                        {col.render(row)}
                                    </td>
                                ))}
                                {actions && <td className="px-4 py-2.5 text-right">{actions(row)}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="sm:hidden space-y-3">
                {rows.map((row) => (
                    <div key={rowKey(row)} className="rounded-xl border border-slate-200 bg-white p-4">
                        <dl className="space-y-1.5">
                            {columns.map((col) => (
                                <div key={col.header} className="flex justify-between gap-3 text-sm">
                                    <dt className="text-slate-500 flex-shrink-0">{col.header}</dt>
                                    <dd className="text-slate-800 text-right font-medium">{col.render(row)}</dd>
                                </div>
                            ))}
                        </dl>
                        {actions && <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end gap-2">{actions(row)}</div>}
                    </div>
                ))}
            </div>
        </>
    );
}

export default ResponsiveTable;
