import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
    ApplicationState,
    StepApplicationType,
    BuyerInfo,
    AgencyInfo,
    CooperativeInfo,
    ExporterInfo,
    WarehouseInfo,
    PersonnelRecord,
    FarmerRecord,
    OwnerRecord,
    SupplierRecord,
    UploadedFile,
    DeclarationInfo,
} from './types';
import { createEmptyApplication } from './types';

const DRAFT_STORAGE_KEY = 'lacra_registration_draft_v1';

// -----------------------------------------------------------------------
// Draft persistence helpers. Uploaded file metadata is persisted (name,
// size, type, status, progress) but any object-URL preview is dropped
// since object URLs do not survive a page reload - the applicant will
// simply see the file listed as already uploaded and can replace it if a
// fresh preview is needed. There is no real backend storage endpoint in
// this phase, so this local-draft mechanism is the "Save Draft" /
// autosave feature described in the spec.
// -----------------------------------------------------------------------

function stripUnusablePreviewUrls(state: ApplicationState): ApplicationState {
    const clean = (f: UploadedFile | null) => (f ? { ...f, previewUrl: undefined } : f);
    const cleanRecordPhoto = <T extends { photo?: UploadedFile | null }>(r: T) =>
        'photo' in r ? { ...r, photo: clean((r as { photo?: UploadedFile | null }).photo ?? null) } : r;

    return {
        ...state,
        buyer: { ...state.buyer, photo: clean(state.buyer.photo) },
        agency: {
            ...state.agency,
            ownerCitizenshipProof: clean(state.agency.ownerCitizenshipProof),
            signatoryPhoto: clean(state.agency.signatoryPhoto),
            businessLogo: clean(state.agency.businessLogo),
        },
        cooperative: { ...state.cooperative, repPhoto: clean(state.cooperative.repPhoto) },
        exporter: {
            ...state.exporter,
            signatoryPhoto: clean(state.exporter.signatoryPhoto),
            businessLogo: clean(state.exporter.businessLogo),
        },
        personnel: state.personnel.map(cleanRecordPhoto),
        leadership: state.leadership.map(cleanRecordPhoto),
        owners: state.owners.map((o) => ({ ...o, citizenshipProof: clean(o.citizenshipProof) })),
        documents: Object.fromEntries(Object.entries(state.documents).map(([k, v]) => [k, clean(v)])),
    };
}

function loadDraft(): { state: ApplicationState; savedAt: string | null } {
    try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) return { state: createEmptyApplication(), savedAt: null };
        const parsed = JSON.parse(raw);
        return { state: { ...createEmptyApplication(), ...parsed.state }, savedAt: parsed.savedAt || null };
    } catch {
        return { state: createEmptyApplication(), savedAt: null };
    }
}

function persistDraft(state: ApplicationState): string {
    const savedAt = new Date().toISOString();
    const payload = { state: stripUnusablePreviewUrls(state), savedAt };
    try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // localStorage may be unavailable (private browsing, quota) - fail
        // silently here; the applicant still has the in-memory data for
        // the current session and can retry Save Draft.
    }
    return savedAt;
}

export function clearStoredDraft() {
    try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

export function hasStoredDraft(): boolean {
    try {
        return !!localStorage.getItem(DRAFT_STORAGE_KEY);
    } catch {
        return false;
    }
}

// -----------------------------------------------------------------------

interface RegistrationContextType {
    state: ApplicationState;
    currentStep: number;
    completedSteps: Set<number>;
    lastSavedAt: string | null;
    isDirty: boolean;

    setStep1: (v: StepApplicationType) => void;
    setBuyer: (v: BuyerInfo) => void;
    setAgency: (v: AgencyInfo) => void;
    setCooperative: (v: CooperativeInfo) => void;
    setExporter: (v: ExporterInfo) => void;
    setWarehouse: (v: WarehouseInfo) => void;
    setPersonnel: (v: PersonnelRecord[]) => void;
    setLeadership: (v: PersonnelRecord[]) => void;
    setFarmers: (v: FarmerRecord[]) => void;
    setOwners: (v: OwnerRecord[]) => void;
    setSuppliers: (v: SupplierRecord[]) => void;
    setDocument: (key: string, value: UploadedFile | null) => void;
    setDeclaration: (v: DeclarationInfo) => void;
    setApplicationNumber: (n: string) => void;
    setSubmittedAt: (d: string) => void;

    goToStep: (step: number) => void;
    markStepComplete: (step: number) => void;
    saveDraft: () => void;
    resetApplication: () => void;
}

const RegistrationContext = createContext<RegistrationContextType | null>(null);

export const RegistrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const initial = useMemo(() => loadDraft(), []);
    const [state, setState] = useState<ApplicationState>(initial.state);
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(initial.savedAt);
    const [isDirty, setIsDirty] = useState(false);

    // Keep a ref to the latest state so the beforeunload listener (added
    // once) always reads current data without needing to be re-bound on
    // every keystroke. Refs are updated in an effect (not during render)
    // to follow React's rules on refs.
    const stateRef = useRef(state);
    const dirtyRef = useRef(isDirty);
    useEffect(() => {
        stateRef.current = state;
        dirtyRef.current = isDirty;
    }, [state, isDirty]);

    const mutate = useCallback(<K extends keyof ApplicationState>(key: K, value: ApplicationState[K]) => {
        setState((prev) => ({ ...prev, [key]: value }));
        setIsDirty(true);
    }, []);

    const setStep1 = useCallback((v: StepApplicationType) => mutate('step1', v), [mutate]);
    const setBuyer = useCallback((v: BuyerInfo) => mutate('buyer', v), [mutate]);
    const setAgency = useCallback((v: AgencyInfo) => mutate('agency', v), [mutate]);
    const setCooperative = useCallback((v: CooperativeInfo) => mutate('cooperative', v), [mutate]);
    const setExporter = useCallback((v: ExporterInfo) => mutate('exporter', v), [mutate]);
    const setWarehouse = useCallback((v: WarehouseInfo) => mutate('warehouse', v), [mutate]);
    const setPersonnel = useCallback((v: PersonnelRecord[]) => mutate('personnel', v), [mutate]);
    const setLeadership = useCallback((v: PersonnelRecord[]) => mutate('leadership', v), [mutate]);
    const setFarmers = useCallback((v: FarmerRecord[]) => mutate('farmers', v), [mutate]);
    const setOwners = useCallback((v: OwnerRecord[]) => mutate('owners', v), [mutate]);
    const setSuppliers = useCallback((v: SupplierRecord[]) => mutate('suppliers', v), [mutate]);
    const setDeclaration = useCallback((v: DeclarationInfo) => mutate('declaration', v), [mutate]);
    const setApplicationNumber = useCallback((n: string) => mutate('applicationNumber', n), [mutate]);
    const setSubmittedAt = useCallback((d: string) => mutate('submittedAt', d), [mutate]);

    const setDocument = useCallback((key: string, value: UploadedFile | null) => {
        setState((prev) => ({ ...prev, documents: { ...prev.documents, [key]: value } }));
        setIsDirty(true);
    }, []);

    const saveDraft = useCallback(() => {
        const savedAt = persistDraft(stateRef.current);
        setLastSavedAt(savedAt);
        setIsDirty(false);
    }, []);

    const markStepComplete = useCallback((step: number) => {
        setCompletedSteps((prev) => new Set(prev).add(step));
    }, []);

    // Autosave draft every time the applicant moves to a different step,
    // per "Automatically save the application locally or as a draft
    // whenever the applicant moves to another step."
    const goToStep = useCallback((step: number) => {
        setCurrentStep(step);
        const savedAt = persistDraft(stateRef.current);
        setLastSavedAt(savedAt);
        setIsDirty(false);
    }, []);

    const resetApplication = useCallback(() => {
        clearStoredDraft();
        setState(createEmptyApplication());
        setCurrentStep(0);
        setCompletedSteps(new Set());
        setLastSavedAt(null);
        setIsDirty(false);
    }, []);

    // Warn before leaving the page with unsaved changes.
    useEffect(() => {
        function handleBeforeUnload(e: BeforeUnloadEvent) {
            if (dirtyRef.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const value: RegistrationContextType = {
        state, currentStep, completedSteps, lastSavedAt, isDirty,
        setStep1, setBuyer, setAgency, setCooperative, setExporter, setWarehouse,
        setPersonnel, setLeadership, setFarmers, setOwners, setSuppliers,
        setDocument, setDeclaration, setApplicationNumber, setSubmittedAt,
        goToStep, markStepComplete, saveDraft, resetApplication,
    };

    return <RegistrationContext.Provider value={value}>{children}</RegistrationContext.Provider>;
};

export const useRegistration = () => {
    const ctx = useContext(RegistrationContext);
    if (!ctx) throw new Error('useRegistration must be used within a RegistrationProvider');
    return ctx;
};
