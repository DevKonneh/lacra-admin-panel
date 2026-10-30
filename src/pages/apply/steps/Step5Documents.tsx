import React from 'react';
import { useRegistration } from '../RegistrationContext';
import { DOCUMENT_REQUIREMENTS } from '../documentRequirements';
import DocumentUpload from '../../../components/forms/DocumentUpload';
import Alert from '../../../components/forms/Alert';
import type { FieldErrors } from '../validators';

export function validateStep5(category: string, state: ReturnType<typeof useRegistration>['state']): FieldErrors {
    const errors: FieldErrors = {};
    const requirements = DOCUMENT_REQUIREMENTS[category as keyof typeof DOCUMENT_REQUIREMENTS] || [];
    requirements.forEach((req) => {
        if (req.required) {
            const file = state.documents[req.key];
            if (!file || file.status !== 'done') {
                errors[req.key] = `${req.label} is required.`;
            }
        }
    });
    return errors;
}

interface Step5Props {
    errors: FieldErrors;
}

// Step 5: Supporting Documents. Dynamically renders exactly the
// required/optional document list configured for the selected category
// (documentRequirements.ts), reusing the single DocumentUpload component
// for every entry. Final submission (enforced in the wizard shell) is
// blocked while any required document is missing or still uploading.
const Step5Documents: React.FC<Step5Props> = ({ errors }) => {
    const { state, setDocument } = useRegistration();
    const category = state.step1.category;
    const requirements = category ? DOCUMENT_REQUIREMENTS[category] : [];

    if (!category) {
        return <Alert variant="info" title="No category selected">Please go back to Step 1 and select an application category.</Alert>;
    }

    const missingCount = Object.keys(errors).length;

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-500">
                Upload the documents required for your application. Files marked <span className="font-medium text-amber-700">Required</span> must be
                uploaded successfully before you can submit your application.
            </p>

            {missingCount > 0 && (
                <Alert variant="warning" title="Missing required documents">
                    {missingCount} required document{missingCount === 1 ? '' : 's'} still need to be uploaded before you can submit.
                </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {requirements.map((req) => (
                    <DocumentUpload
                        key={req.key}
                        label={req.label}
                        required={req.required}
                        accept={req.acceptAttr}
                        acceptDisplay={req.accept}
                        maxSizeMb={req.maxSizeMb}
                        helpText={req.helpText}
                        value={state.documents[req.key] || null}
                        onChange={(f) => setDocument(req.key, f)}
                    />
                ))}
            </div>
        </div>
    );
};

export default Step5Documents;
