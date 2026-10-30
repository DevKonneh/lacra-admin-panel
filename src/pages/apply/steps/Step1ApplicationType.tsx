import React, { useState } from 'react';
import { Store, Building2, Users, Ship, Leaf, Coffee, Droplet, RefreshCw, FilePlus } from 'lucide-react';
import type { ApplicationCategory, Commodity } from '../types';
import { COMMODITY_LABELS } from '../types';
import { useRegistration } from '../RegistrationContext';
import ListOptionRow from '../../../components/forms/ListOptionRow';
import FormField from '../../../components/forms/FormField';
import { TextInput, SelectInput } from '../../../components/forms/inputs';
import Alert from '../../../components/forms/Alert';

// The 4 top-level category list options shown to the applicant. "Exporter"
// is a single combined row - Local Export Licence and Foreign Export
// Licence are merged into it, with a secondary Local/Foreign dropdown
// appearing once it's selected. That secondary choice is what actually
// resolves the real underlying ApplicationCategory value
// ('LOCAL_EXPORTER' | 'FOREIGN_EXPORTER') used by every downstream step,
// so Step2/3/4/5/6/documentRequirements.ts never need to know about this
// "Exporter" UI grouping at all.
type CategoryListValue = 'LOCAL_BUYER' | 'AGENCY' | 'COOPERATIVE' | 'EXPORTER';

const CATEGORY_META: { value: CategoryListValue; icon: React.ReactNode; title: string; description: string }[] = [
    {
        value: 'LOCAL_BUYER',
        icon: <Store size={18} />,
        title: 'Local Produce Buyer',
        description: 'Individuals or businesses buying cocoa, coffee or palm oil directly from local farmers.',
    },
    {
        value: 'AGENCY',
        icon: <Building2 size={18} />,
        title: 'Agency',
        description: 'Registered agencies operating with a team of buyers and a weighing clerk.',
    },
    {
        value: 'COOPERATIVE',
        icon: <Users size={18} />,
        title: 'Cooperative',
        description: 'Farmer cooperatives with leadership, members and buying/weighing personnel.',
    },
    {
        value: 'EXPORTER',
        icon: <Ship size={18} />,
        title: 'Exporter',
        description: 'Companies exporting commodities abroad - choose Local or Foreign below once selected.',
    },
];

const COMMODITY_META: { value: Commodity; icon: React.ReactNode }[] = [
    { value: 'COCOA', icon: <Leaf size={18} /> },
    { value: 'COFFEE', icon: <Coffee size={18} /> },
    { value: 'PALM_OIL', icon: <Droplet size={18} /> },
];

function categoryToListValue(category: ApplicationCategory | ''): CategoryListValue | '' {
    if (category === 'LOCAL_EXPORTER' || category === 'FOREIGN_EXPORTER') return 'EXPORTER';
    if (category === 'LOCAL_BUYER' || category === 'AGENCY' || category === 'COOPERATIVE') return category;
    return '';
}

export interface Step1Errors {
    category?: string;
    commodity?: string;
    exporterSubtype?: string;
    applicantKind?: string;
    previousNumber?: string;
    [key: string]: string | undefined;
}

export function validateStep1(step1: ReturnType<typeof useRegistration>['state']['step1']): Step1Errors {
    const errors: Step1Errors = {};
    if (!step1.category) errors.category = 'Please select an application category.';
    if (!step1.commodity) errors.commodity = 'Please select a commodity.';
    if (!step1.applicantKind) errors.applicantKind = 'Please select whether you are applying as an individual or an organization.';
    if (step1.isRenewal && !step1.previousNumber.trim()) errors.previousNumber = 'Enter your previous permit/licence number for a renewal.';
    return errors;
}

interface Step1Props {
    errors: Step1Errors;
}

// Step 1: Application Type - the applicant selects a single commodity, a
// single application category, applicant kind, and whether this is a new
// application or a renewal. Selecting a category here drives which
// fields/documents are shown in every subsequent step.
const Step1ApplicationType: React.FC<Step1Props> = ({ errors }) => {
    const { state, setStep1 } = useRegistration();
    const { step1 } = state;
    const [showOrgWarning, setShowOrgWarning] = useState(false);

    // Which of the 4 top-level list rows is highlighted as selected. This
    // is tracked as its OWN piece of UI state (rather than being derived
    // purely from step1.category) because selecting "Exporter" does NOT
    // immediately resolve step1.category (the applicant still has to pick
    // Local/Foreign below first) - deriving selection straight from
    // step1.category made the Exporter row appear to instantly
    // "un-select" itself the moment it was clicked, since category was
    // still '' at that point. Initialized from the real category so a
    // reloaded draft still shows the correct row highlighted.
    const [selectedListValue, setSelectedListValue] = useState<CategoryListValue | ''>(() => categoryToListValue(step1.category));

    const selectCommodity = (c: Commodity) => {
        setStep1({ ...step1, commodity: c });
    };

    const selectCategoryRow = (value: CategoryListValue) => {
        setSelectedListValue(value);
        if (value === 'EXPORTER') {
            // Don't resolve the real category yet - the applicant still
            // needs to answer the Local/Foreign sub-question below. This
            // intentionally leaves step1.category as '' (so validation
            // still requires completing that sub-choice) unless it was
            // already an exporter category from a reloaded draft.
            const alreadyExporter = step1.category === 'LOCAL_EXPORTER' || step1.category === 'FOREIGN_EXPORTER';
            if (!alreadyExporter) setStep1({ ...step1, category: '' });
            setShowOrgWarning(step1.applicantKind === 'INDIVIDUAL');
            return;
        }
        setStep1({ ...step1, category: value });
        if (value === 'AGENCY' || value === 'COOPERATIVE') {
            setShowOrgWarning(step1.applicantKind === 'INDIVIDUAL');
        } else {
            setShowOrgWarning(false);
        }
    };

    const exporterSubtypeValue: 'LOCAL' | 'FOREIGN' | '' =
        step1.category === 'LOCAL_EXPORTER' ? 'LOCAL' : step1.category === 'FOREIGN_EXPORTER' ? 'FOREIGN' : '';

    const selectExporterSubtype = (v: 'LOCAL' | 'FOREIGN' | '') => {
        const resolved: ApplicationCategory | '' = v === 'LOCAL' ? 'LOCAL_EXPORTER' : v === 'FOREIGN' ? 'FOREIGN_EXPORTER' : '';
        setStep1({ ...step1, category: resolved });
        setShowOrgWarning(step1.applicantKind === 'INDIVIDUAL');
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-base font-semibold text-slate-800 mb-1">1. Select the commodity you deal in</h2>
                <p className="text-sm text-slate-500 mb-4">You may select only one commodity per registration.</p>
                {errors.commodity && (
                    <p className="text-xs text-red-600 mb-2" role="alert">{errors.commodity}</p>
                )}
                <div className="flex flex-col gap-2" role="radiogroup" aria-label="Commodity">
                    {COMMODITY_META.map((c) => (
                        <ListOptionRow
                            key={c.value}
                            icon={c.icon}
                            title={COMMODITY_LABELS[c.value]}
                            selected={step1.commodity === c.value}
                            onClick={() => selectCommodity(c.value)}
                        />
                    ))}
                </div>
            </div>

            <div>
                <h2 className="text-base font-semibold text-slate-800 mb-1">2. Select your application category</h2>
                <p className="text-sm text-slate-500 mb-4">Only one category can be selected. Only the fields and documents required for your chosen category will be shown next.</p>
                {errors.category && (
                    <p className="text-xs text-red-600 mb-2" role="alert">{errors.category}</p>
                )}
                <div className="flex flex-col gap-2" role="radiogroup" aria-label="Application category">
                    {CATEGORY_META.map((c) => (
                        <ListOptionRow
                            key={c.value}
                            icon={c.icon}
                            title={c.title}
                            description={c.description}
                            selected={selectedListValue === c.value}
                            onClick={() => selectCategoryRow(c.value)}
                        />
                    ))}
                </div>

                {selectedListValue === 'EXPORTER' && (
                    <div className="mt-3 ml-4 pl-4 border-l-2 border-brand-green/30 max-w-sm">
                        <FormField
                            label="Are you a Local or Foreign exporter?"
                            required
                            error={!exporterSubtypeValue ? errors.category : undefined}
                        >
                            <SelectInput
                                value={exporterSubtypeValue}
                                onChange={(e) => selectExporterSubtype(e.target.value as 'LOCAL' | 'FOREIGN' | '')}
                            >
                                <option value="">Select...</option>
                                <option value="LOCAL">Local Exporter</option>
                                <option value="FOREIGN">Foreign Exporter</option>
                            </SelectInput>
                        </FormField>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Applying as" required error={errors.applicantKind}>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setStep1({ ...step1, applicantKind: 'INDIVIDUAL' })}
                            className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                step1.applicantKind === 'INDIVIDUAL' ? 'border-brand-green bg-brand-green/8 text-brand-green' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                        >
                            Individual
                        </button>
                        <button
                            type="button"
                            onClick={() => setStep1({ ...step1, applicantKind: 'ORGANIZATION' })}
                            className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                step1.applicantKind === 'ORGANIZATION' ? 'border-brand-green bg-brand-green/8 text-brand-green' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                        >
                            Organization
                        </button>
                    </div>
                </FormField>

                <FormField label="Application type" required>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setStep1({ ...step1, isRenewal: false, previousNumber: '' })}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                !step1.isRenewal ? 'border-brand-green bg-brand-green/8 text-brand-green' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                        >
                            <FilePlus size={15} /> New Application
                        </button>
                        <button
                            type="button"
                            onClick={() => setStep1({ ...step1, isRenewal: true })}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                step1.isRenewal ? 'border-brand-green bg-brand-green/8 text-brand-green' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                        >
                            <RefreshCw size={15} /> Renewal
                        </button>
                    </div>
                </FormField>
            </div>

            {step1.isRenewal && (
                <FormField
                    label="Previous Permit / Licence Number"
                    required
                    error={errors.previousNumber}
                    tooltip="Enter the permit or licence number issued to you previously by LACRA."
                >
                    <TextInput
                        value={step1.previousNumber}
                        onChange={(e) => setStep1({ ...step1, previousNumber: e.target.value })}
                        placeholder="e.g. LCRA-2023-004521"
                    />
                </FormField>
            )}

            {showOrgWarning && (
                <Alert variant="info" title="Organization details required" onClose={() => setShowOrgWarning(false)}>
                    This category is typically registered as an organization. You can still continue as an individual applicant, but you will
                    need to provide the organization's registration details in the next step.
                </Alert>
            )}
        </div>
    );
};

export default Step1ApplicationType;
