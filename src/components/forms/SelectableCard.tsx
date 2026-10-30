import React from 'react';
import { Check } from 'lucide-react';

interface SelectableCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    selected: boolean;
    onClick: () => void;
    badge?: string;
}

// Clean selectable card used for both the Application Category grid and
// the Commodity multi-select grid on Step 1. Fully keyboard accessible
// (native <button>) and shows a clear checked state without relying on
// color alone (checkmark badge + border + background tint).
const SelectableCard: React.FC<SelectableCardProps> = ({ icon, title, description, selected, onClick, badge }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={[
            'relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all w-full h-full',
            'focus:outline-none focus:ring-2 focus:ring-brand-green/40',
            selected
                ? 'border-brand-green bg-brand-green/6 shadow-md'
                : 'border-slate-200 bg-white hover:border-brand-green/40 hover:shadow-sm',
        ].join(' ')}
    >
        {selected && (
            <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-brand-green text-white flex items-center justify-center">
                <Check size={13} strokeWidth={3} />
            </span>
        )}
        <div
            className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                selected ? 'bg-brand-green text-white' : 'bg-brand-green/10 text-brand-green'
            }`}
        >
            {icon}
        </div>
        <div>
            <p className="font-semibold text-slate-800 text-sm">{title}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</p>
        </div>
        {badge && (
            <span className="mt-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                {badge}
            </span>
        )}
    </button>
);

export default SelectableCard;
