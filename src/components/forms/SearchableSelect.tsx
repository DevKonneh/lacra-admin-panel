import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { inputClasses } from './inputs';

interface SearchableSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    hasError?: boolean;
    disabled?: boolean;
    id?: string;
}

// Lightweight searchable dropdown (no extra dependency) used for the
// County / District cascading pickers. Fully keyboard accessible: type to
// filter, Arrow keys aren't required since the native input+list pattern
// lets users just type and press Enter/click - Escape closes it.
const SearchableSelect: React.FC<SearchableSelectProps> = ({
    value, onChange, options, placeholder = 'Search...', hasError, disabled, id,
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = useMemo(() => {
        if (!query) return options;
        const q = query.toLowerCase();
        return options.filter((o) => o.toLowerCase().includes(q));
    }, [options, query]);

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                id={id}
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
                className={`${inputClasses(hasError)} flex items-center justify-between text-left bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
            >
                <span className={value ? 'text-slate-900' : 'text-slate-400'}>{value || placeholder}</span>
                <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
            </button>

            {open && !disabled && (
                <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                        <Search size={14} className="text-slate-400 flex-shrink-0" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Type to search..."
                            className="w-full text-sm outline-none placeholder:text-slate-400"
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') setOpen(false);
                                if (e.key === 'Enter' && filtered.length === 1) {
                                    onChange(filtered[0]);
                                    setOpen(false);
                                    setQuery('');
                                }
                            }}
                        />
                    </div>
                    <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
                        {filtered.length === 0 && (
                            <li className="px-3 py-2 text-sm text-slate-400">No matches found</li>
                        )}
                        {filtered.map((opt) => (
                            <li key={opt}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={opt === value}
                                    onClick={() => {
                                        onChange(opt);
                                        setOpen(false);
                                        setQuery('');
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-brand-green/8 ${
                                        opt === value ? 'text-brand-green font-medium' : 'text-slate-700'
                                    }`}
                                >
                                    {opt}
                                    {opt === value && <Check size={14} />}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
