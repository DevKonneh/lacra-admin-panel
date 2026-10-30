import React from 'react';
import { Check } from 'lucide-react';

interface ListOptionRowProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    selected: boolean;
    onClick: () => void;
    badge?: string;
}

// Single-column, list-style selectable row (radio-button visual) used for
// Step 1's Commodity and Application Category selectors. Unlike
// SelectableCard's grid layout, this always renders as a full-width list
// row so multiple options read top-to-bottom like a list, and the
// leading circular indicator makes the "only one can be selected"
// single-choice behavior visually obvious.
const ListOptionRow: React.FC<ListOptionRowProps> = ({ icon, title, description, selected, onClick, badge }) => (
    <button
        type="button"
        onClick={onClick}
        role="radio"
        aria-checked={selected}
        className={[
            'w-full flex items-center gap-3.5 rounded-xl border-2 px-4 py-3.5 text-left transition-all duration-150',
            'focus:outline-none focus:ring-4 focus:ring-brand-green/15',
            selected
                ? 'border-brand-green bg-brand-green/[0.06] shadow-sm ring-1 ring-brand-green/10'
                : 'border-slate-200 bg-white hover:border-brand-green/40 hover:bg-slate-50/80 hover:shadow-sm',
        ].join(' ')}
    >
        <span
            className={`flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                selected ? 'border-brand-green bg-brand-green' : 'border-slate-300 bg-white'
            }`}
        >
            {selected && <Check size={12} strokeWidth={3} className="text-white" />}
        </span>
        {icon && (
            <span
                className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${
                    selected ? 'bg-brand-green text-white' : 'bg-brand-green/10 text-brand-green'
                }`}
            >
                {icon}
            </span>
        )}
        <span className="flex-1 min-w-0">
            <span className={`font-semibold text-sm block ${selected ? 'text-brand-green' : 'text-slate-800'}`}>{title}</span>
            {description && <span className="text-xs text-slate-500 leading-snug block mt-0.5">{description}</span>}
        </span>
        {badge && (
            <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                {badge}
            </span>
        )}
    </button>
);

export default ListOptionRow;
