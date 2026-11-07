import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, RotateCcw, LayoutPanelTop } from 'lucide-react';

// ---------------------------------------------------------------------
// Dashboard "Customize" control — lets a signed-in user show/hide any of
// the dashboard's optional content blocks (sections, breakdown cards,
// individual charts) without touching any filter or data-fetching logic.
// Hidden sections are persisted to localStorage (per-browser, not
// per-user-account) via the key passed in from Dashboard.tsx, so the
// layout choice survives a refresh. The trigger button itself always
// lives in the PageHeader — never inside a toggleable section — so it's
// never possible to hide every section and lose the ability to bring
// them back.
// ---------------------------------------------------------------------

export interface VisibilitySectionDef {
    key: string;
    label: string;
}
export interface VisibilityGroupDef {
    group: string;
    items: VisibilitySectionDef[];
}

interface Props {
    groups: VisibilityGroupDef[];
    isVisible: (key: string) => boolean;
    onToggle: (key: string) => void;
    onReset: () => void;
}

const DashboardVisibilityMenu: React.FC<Props> = ({ groups, isVisible, onToggle, onReset }) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click / Escape — standard popover behavior, no
    // shared dropdown primitive exists elsewhere in the app to reuse.
    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    const hiddenCount = groups.reduce(
        (sum, g) => sum + g.items.filter((item) => !isVisible(item.key)).length,
        0
    );

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className={`inline-flex items-center gap-1.5 text-xs font-medium rounded px-2 py-1.5 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                    hiddenCount > 0
                        ? 'text-brand-green border-brand-green/30 bg-brand-green/5'
                        : 'text-gray-600 border-gray-300 hover:border-brand-green/40 hover:text-brand-green'
                }`}
            >
                <LayoutPanelTop className="h-3.5 w-3.5" />
                Customize
                {hiddenCount > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-brand-green text-white text-[10px] font-bold">
                        {hiddenCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-lg z-30 py-1.5 max-h-[26rem] overflow-y-auto">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 mb-1 sticky top-0 bg-white">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Show / Hide Content</span>
                        <button
                            onClick={onReset}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-brand-green focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded"
                        >
                            <RotateCcw className="h-3 w-3" /> Reset
                        </button>
                    </div>
                    {groups.map((g) => (
                        <div key={g.group} className="px-2 py-1">
                            <p className="px-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{g.group}</p>
                            <div className="space-y-0.5">
                                {g.items.map((item) => {
                                    const visible = isVisible(item.key);
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => onToggle(item.key)}
                                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                                        >
                                            <span className={`text-sm ${visible ? 'text-gray-700' : 'text-gray-400'}`}>{item.label}</span>
                                            {visible ? (
                                                <Eye className="h-4 w-4 text-brand-green flex-shrink-0" />
                                            ) : (
                                                <EyeOff className="h-4 w-4 text-gray-300 flex-shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DashboardVisibilityMenu;
