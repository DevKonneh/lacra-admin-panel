import React from 'react';
import { Check } from 'lucide-react';

interface Step {
    label: string;
    shortLabel?: string;
}

interface ProgressStepperProps {
    steps: Step[];
    currentStep: number; // 0-indexed
    completedSteps: Set<number>;
    onStepClick?: (index: number) => void;
}

// Applicant progress indicator shown at the top of the registration
// wizard. Desktop shows the full horizontal stepper with labels; on small
// screens it collapses to a compact "Step X of N" bar with a progress
// track, per the mobile-responsive requirement.
const ProgressStepper: React.FC<ProgressStepperProps> = ({ steps, currentStep, completedSteps, onStepClick }) => {
    const percent = ((currentStep) / (steps.length - 1)) * 100;

    return (
        <div>
            {/* Mobile compact view */}
            <div className="sm:hidden">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">
                        Step {currentStep + 1} of {steps.length}
                    </span>
                    <span className="text-sm text-brand-green font-medium">{steps[currentStep].label}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-brand-green transition-all duration-300" style={{ width: `${percent}%` }} />
                </div>
            </div>

            {/* Desktop full stepper */}
            <ol className="hidden sm:flex items-start w-full">
                {steps.map((step, i) => {
                    const isDone = completedSteps.has(i);
                    const isCurrent = i === currentStep;
                    const clickable = !!onStepClick && (isDone || i < currentStep);
                    return (
                        <li key={step.label} className="flex-1 flex items-center last:flex-none">
                            <div className="flex flex-col items-center gap-1.5 flex-1">
                                <button
                                    type="button"
                                    disabled={!clickable}
                                    onClick={() => clickable && onStepClick?.(i)}
                                    className={[
                                        'h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors flex-shrink-0',
                                        isCurrent
                                            ? 'bg-brand-green border-brand-green text-white shadow-md'
                                            : isDone
                                                ? 'bg-brand-green/15 border-brand-green text-brand-green'
                                                : 'bg-white border-slate-300 text-slate-400',
                                        clickable ? 'cursor-pointer hover:scale-105' : 'cursor-default',
                                    ].join(' ')}
                                    aria-current={isCurrent ? 'step' : undefined}
                                >
                                    {isDone ? <Check size={16} /> : i + 1}
                                </button>
                                <span
                                    className={`text-[11px] text-center leading-tight max-w-[92px] ${
                                        isCurrent ? 'text-brand-green font-semibold' : 'text-slate-500'
                                    }`}
                                >
                                    {step.shortLabel || step.label}
                                </span>
                            </div>
                            {i < steps.length - 1 && (
                                <div className={`h-0.5 flex-1 mx-1 rounded ${isDone ? 'bg-brand-green' : 'bg-slate-200'}`} style={{ marginTop: '-20px' }} />
                            )}
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};

export default ProgressStepper;
