import React, { useMemo, useState } from 'react';
import { Save, ChevronLeft, ChevronRight, ClipboardCheck, Send, Loader2 } from 'lucide-react';
import logo from '../../assets/lacra_logo.jpg';
import { RegistrationProvider, useRegistration, clearStoredDraft } from './RegistrationContext';
import ProgressStepper from '../../components/forms/ProgressStepper';
import Alert from '../../components/forms/Alert';
import ConfirmationPage from './ConfirmationPage';
import type { FieldErrors } from './validators';
import { createApplication } from '../../api/applications';

import Step1ApplicationType, { validateStep1 } from './steps/Step1ApplicationType';
import Step2BusinessInfo, { validateStep2 } from './steps/Step2BusinessInfo';
import Step3OwnersPersonnel, { validateStep3 } from './steps/Step3OwnersPersonnel';
import Step4Warehouse, { validateStep4 } from './steps/Step4Warehouse';
import Step5Documents, { validateStep5 } from './steps/Step5Documents';
import Step6Review, { validateStep6 } from './steps/Step6Review';

const STEP_META = [
    { label: 'Application Type', shortLabel: 'Type' },
    { label: 'Applicant / Business Information', shortLabel: 'Business Info' },
    { label: 'Owner and Responsible Persons', shortLabel: 'Owners' },
    { label: 'Operations and Warehouse', shortLabel: 'Warehouse' },
    { label: 'Supporting Documents', shortLabel: 'Documents' },
    { label: 'Declaration and Review', shortLabel: 'Review' },
];

// Generates a fresh pair of small integers for the arithmetic CAPTCHA
// each time the review step is entered (kept in wizard-level state so it
// doesn't reset while the applicant is still filling in the declaration).
function randomCaptchaPair(): [number, number] {
    return [1 + Math.floor(Math.random() * 9), 1 + Math.floor(Math.random() * 9)];
}

const WizardInner: React.FC = () => {
    const { state, currentStep, completedSteps, goToStep, markStepComplete, saveDraft, lastSavedAt, setApplicationNumber, setSubmittedAt, resetApplication } = useRegistration();
    const [errors, setErrors] = useState<FieldErrors>({});
    const [showDraftSaved, setShowDraftSaved] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [captchaPair, setCaptchaPair] = useState<[number, number]>(() => randomCaptchaPair());

    const category = state.step1.category;

    // Local Produce Buyer has no separate "Owner and Responsible Persons"
    // step (the applicant IS the individual) and no warehouse/operational
    // requirements at all, so steps 2 (index 2) and 4 (index 3) are both
    // skipped entirely for that category while keeping the same 6-step
    // numbering for every other category, per the spec's fixed step
    // structure. skippedSteps is a Set so handleStartNew-style logic and
    // nextStepIndex can both step over any number of consecutive skipped
    // indices uniformly, regardless of which/how many are skipped for a
    // given category.
    const skipStep3 = category === 'LOCAL_BUYER';
    const skipStep4 = category === 'LOCAL_BUYER';
    const skippedSteps = useMemo(() => {
        const s = new Set<number>();
        if (skipStep3) s.add(2);
        if (skipStep4) s.add(3);
        return s;
    }, [skipStep3, skipStep4]);

    const runValidation = (step: number): FieldErrors => {
        switch (step) {
            case 0: return validateStep1(state.step1) as FieldErrors;
            case 1: return category ? validateStep2(category, state) : {};
            case 2: return category ? validateStep3(category, state) : {};
            case 3: return category ? validateStep4(category, state) : {};
            case 4: return category ? validateStep5(category, state) : {};
            case 5: return validateStep6(state, captchaPair[0] + captchaPair[1]);
            default: return {};
        }
    };

    const nextStepIndex = (from: number, direction: 1 | -1): number => {
        let next = from + direction;
        while (skippedSteps.has(next) && next > 0 && next < STEP_META.length - 1) next += direction;
        return Math.max(0, Math.min(STEP_META.length - 1, next));
    };

    const handleContinue = () => {
        const stepErrors = runValidation(currentStep);
        setErrors(stepErrors);
        if (Object.keys(stepErrors).length > 0) return;
        markStepComplete(currentStep);
        const next = nextStepIndex(currentStep, 1);
        setErrors({});
        goToStep(next);
        if (next === 5) setCaptchaPair(randomCaptchaPair());
    };

    const handleBack = () => {
        setErrors({});
        goToStep(nextStepIndex(currentStep, -1));
    };

    const handleSaveDraft = () => {
        saveDraft();
        setShowDraftSaved(true);
        setTimeout(() => setShowDraftSaved(false), 3000);
    };

    const handleReviewApplication = () => {
        // Jump straight to the review step without requiring the
        // current step's validation to pass, so applicants can preview
        // their progress at any time - final Submit still enforces every
        // step's validation.
        goToStep(5);
        setCaptchaPair(randomCaptchaPair());
    };

    const handleSubmit = async () => {
        if (submitting) return; // prevent duplicate submissions
        const allSteps = [0, 1, 2, 3, 4, 5].filter((s) => !skippedSteps.has(s));
        let combinedErrors: FieldErrors = {};
        for (const step of allSteps) {
            combinedErrors = { ...combinedErrors, ...runValidation(step) };
        }
        setErrors(combinedErrors);
        if (Object.keys(combinedErrors).length > 0) {
            goToStep(5);
            return;
        }

        setSubmitError('');
        setSubmitting(true);
        try {
            const response = await createApplication({
                category: state.step1.category as any,
                commodity: state.step1.commodity || undefined,
                channel: 'ONLINE',
                data: state,
            });
            const application = response.data.data;
            setApplicationNumber(application.applicationNumber);
            setSubmittedAt(application.submittedAt || new Date().toISOString());
            // The applicant's submitted data now lives in the backend
            // (Application row, AWAITING_COMMERCIAL_VERIFICATION) - the
            // local draft is no longer needed and is cleared so a future
            // visit to /apply starts a fresh application rather than
            // resuming this already-submitted one.
            clearStoredDraft();
            setSubmitting(false);
            setSubmitted(true);
        } catch (err: any) {
            setSubmitting(false);
            const message =
                err?.response?.data?.message ||
                'We could not submit your application. Please check your internet connection and try again.';
            setSubmitError(message);
            goToStep(5);
        }
    };

    const handleStartNew = () => {
        resetApplication();
        setSubmitted(false);
        setErrors({});
    };

    if (submitted) {
        return <ConfirmationPage state={state} onStartNew={handleStartNew} />;
    }

    const stepComponents: Record<number, React.ReactNode> = {
        0: <Step1ApplicationType errors={errors} />,
        1: <Step2BusinessInfo errors={errors} />,
        2: <Step3OwnersPersonnel errors={errors} />,
        3: <Step4Warehouse errors={errors} />,
        4: <Step5Documents errors={errors} />,
        5: <Step6Review errors={errors} onEditStep={goToStep} captchaA={captchaPair[0]} captchaB={captchaPair[1]} />,
    };

    const isLastStep = currentStep === STEP_META.length - 1;
    const isFirstStep = currentStep === 0;

    // Steps that don't apply to the selected category (see skippedSteps)
    // are hidden from the progress stepper entirely, rather than shown as
    // a clickable/skippable bubble, so e.g. a Local Produce Buyer never
    // sees an "Operations and Warehouse" step in their progress at all.
    const visibleStepIndices = useMemo(
        () => [0, 1, 2, 3, 4, 5].filter((i) => !skippedSteps.has(i)),
        [skippedSteps]
    );
    const visibleStepMeta = visibleStepIndices.map((i) => STEP_META[i]);
    const visibleCurrentStep = Math.max(0, visibleStepIndices.indexOf(currentStep));
    const visibleCompletedSteps = useMemo(
        () => new Set(Array.from(completedSteps).map((i) => visibleStepIndices.indexOf(i)).filter((i) => i >= 0)),
        [completedSteps, visibleStepIndices]
    );
    const handleStepperClick = (displayIndex: number) => goToStep(visibleStepIndices[displayIndex]);

    return (
        <div className="min-h-screen bg-brand-bg">
            <header className="bg-white border-b border-brand-border shadow-sm sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3.5">
                    <img src={logo} alt="LACRA logo" className="h-11 w-11 rounded-xl object-cover flex-shrink-0 ring-1 ring-black/5" />
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-brand-green uppercase tracking-wider">Liberia Agricultural Commodity Regulatory Authority</p>
                        <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight truncate">Supply Chain Actor Online Registration</h1>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
                <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
                    Use this portal to apply for a Local Produce Buyer Permit, Agency Permit, Cooperative Permit, Local Export Licence or Foreign
                    Export Licence. Fields marked with <span className="text-red-500 font-semibold">*</span> are required. Your progress is saved
                    automatically as you move between steps.
                </p>

                <div className="bg-white rounded-xl border border-brand-border shadow-card p-4 sm:p-6">
                    <ProgressStepper
                        steps={visibleStepMeta}
                        currentStep={visibleCurrentStep}
                        completedSteps={visibleCompletedSteps}
                        onStepClick={handleStepperClick}
                    />
                </div>

                {showDraftSaved && (
                    <Alert variant="success" title="Draft saved" onClose={() => setShowDraftSaved(false)}>
                        Your application has been saved as a draft on this device.
                    </Alert>
                )}

                {Object.keys(errors).length > 0 && (
                    <Alert variant="error" title="Please fix the following before continuing">
                        <ul className="list-disc list-inside space-y-0.5">
                            {Object.values(errors).slice(0, 6).map((msg, i) => <li key={i}>{msg}</li>)}
                        </ul>
                    </Alert>
                )}

                {submitError && (
                    <Alert variant="error" title="Submission failed" onClose={() => setSubmitError('')}>
                        {submitError}
                    </Alert>
                )}

                <div className="bg-white rounded-xl border border-brand-border shadow-card p-4 sm:p-6">
                    <div className="mb-5 pb-4 border-b border-slate-100">
                        <p className="text-[11px] font-bold text-brand-green uppercase tracking-wider">Step {visibleCurrentStep + 1} of {visibleStepIndices.length}</p>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight mt-0.5">{STEP_META[currentStep].label}</h2>
                    </div>
                    {stepComponents[currentStep]}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white rounded-xl border border-brand-border shadow-card p-3 sm:p-4">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={isFirstStep}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border-2 border-slate-200 text-slate-600 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={16} /> Back
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveDraft}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border-2 border-slate-200 text-slate-600 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
                        >
                            <Save size={16} /> Save Draft
                        </button>
                    </div>

                    <div className="flex gap-2">
                        {!isLastStep && (
                            <button
                                type="button"
                                onClick={handleReviewApplication}
                                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border-2 border-brand-green text-brand-green transition-all duration-150 hover:bg-brand-green/5 focus:outline-none focus:ring-4 focus:ring-brand-green/15"
                            >
                                <ClipboardCheck size={16} /> Review Application
                            </button>
                        )}
                        {!isLastStep ? (
                            <button
                                type="button"
                                onClick={handleContinue}
                                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold bg-brand-green text-white shadow-sm transition-all duration-150 hover:bg-brand-green-hover hover:shadow focus:outline-none focus:ring-4 focus:ring-brand-green/20"
                            >
                                Continue <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold bg-brand-green text-white shadow-sm transition-all duration-150 hover:bg-brand-green-hover hover:shadow focus:outline-none focus:ring-4 focus:ring-brand-green/20 disabled:opacity-60"
                            >
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                {submitting ? 'Submitting...' : 'Submit Application'}
                            </button>
                        )}
                    </div>
                </div>

                {lastSavedAt && (
                    <p className="text-xs text-slate-400 text-center">
                        Last saved: {new Date(lastSavedAt).toLocaleString()}
                    </p>
                )}
            </div>
        </div>
    );
};

// Top-level export: wraps the wizard body in its own RegistrationProvider
// so this module is fully self-contained and can be mounted at a public
// route without depending on any authenticated app state.
const ApplicationWizard: React.FC = () => {
    const provider = useMemo(() => <RegistrationProvider><WizardInner /></RegistrationProvider>, []);
    return provider;
};

export default ApplicationWizard;
