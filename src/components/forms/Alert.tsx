import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

type AlertVariant = 'success' | 'warning' | 'error' | 'info';

interface AlertProps {
    variant: AlertVariant;
    title?: string;
    children: React.ReactNode;
    onClose?: () => void;
}

const VARIANT_STYLES: Record<AlertVariant, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
    success: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-800', icon: <CheckCircle2 className="h-5 w-5 text-green-500" /> },
    warning: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', icon: <AlertTriangle className="h-5 w-5 text-amber-500" /> },
    error: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800', icon: <AlertCircle className="h-5 w-5 text-red-500" /> },
    info: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800', icon: <Info className="h-5 w-5 text-blue-500" /> },
};

// Standard success / warning / error / info banner reused across every
// step of the registration form (validation errors, save confirmations,
// upload warnings, etc.) so messaging is visually consistent throughout.
const Alert: React.FC<AlertProps> = ({ variant, title, children, onClose }) => {
    const s = VARIANT_STYLES[variant];
    return (
        <div className={`rounded-xl border-l-4 shadow-sm ${s.border} ${s.bg} p-4 animate-fade-up`} role={variant === 'error' ? 'alert' : 'status'}>
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{s.icon}</div>
                <div className={`flex-1 text-sm leading-relaxed ${s.text}`}>
                    {title && <p className="font-semibold mb-0.5 tracking-tight">{title}</p>}
                    {children}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className={`flex-shrink-0 rounded-md p-0.5 transition-colors ${s.text} hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-black/10`}
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default Alert;
