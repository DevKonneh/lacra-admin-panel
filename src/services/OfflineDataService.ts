const OFFLINE_FARMERS = 'offline_farmers';
const OFFLINE_FARMS = 'offline_farms';
const DRAFT_MAPPINGS = 'draft_mapping_sessions';

/**
 * A "draft" is a PARTIALLY filled-in, not-yet-submitted multi-step Farm
 * Mapping session (either a brand-new farmer registration in progress, or
 * an "Add Farm to Existing Farmer" session that has an identified farmer
 * but hasn't finished farm-detail collection yet). This is intentionally a
 * SEPARATE queue from OFFLINE_FARMERS/OFFLINE_FARMS above, which hold
 * COMPLETE records that are just waiting for a network connection to sync.
 * Drafts back the "Continue Incomplete Mapping" opening-screen option.
 */
export interface MappingDraft {
    id: string;
    type: 'new_farmer' | 'add_farm';
    /** Human-readable label shown in the resume list, e.g. farmer name or "New farmer (unnamed)". */
    label: string;
    /** For 'add_farm' drafts: the existing farmer this draft is attached to. */
    farmerId?: string;
    farmerName?: string;
    /** Arbitrary form state for the step the user was on — shape depends on `type`. */
    formData: any;
    /** Which step within the flow the user had reached (for resuming to the right screen). */
    step: string;
    createdAt: string;
    updatedAt: string;
}

export const OfflineDataService = {
    saveFarmerLocally: (farmerData: any) => {
        const existing = JSON.parse(localStorage.getItem(OFFLINE_FARMERS) || '[]');
        existing.push({ ...farmerData, _queuedAt: new Date().toISOString() });
        localStorage.setItem(OFFLINE_FARMERS, JSON.stringify(existing));
    },

    getOfflineFarmers: () => {
        return JSON.parse(localStorage.getItem(OFFLINE_FARMERS) || '[]');
    },

    clearOfflineFarmers: () => {
        localStorage.removeItem(OFFLINE_FARMERS);
    },

    // `[key: string]: any` deliberately allows the full farm-detail field set
    // (ownershipType, numberOfTrees, harvestSeason, etc.) to pass through
    // without this local queue needing to duplicate every field name from
    // CreateFarmData — the offline-sync endpoint on the backend accepts the
    // same superset of fields as the online create() path.
    saveFarmLocally: (farmData: { farmerId?: string; name: string; cropType: string; location: object; totalAreaHa?: number; polygonGeoJSON?: object; [key: string]: any }) => {
        const existing = JSON.parse(localStorage.getItem(OFFLINE_FARMS) || '[]');
        existing.push({ ...farmData, _queuedAt: new Date().toISOString() });
        localStorage.setItem(OFFLINE_FARMS, JSON.stringify(existing));
    },

    getOfflineFarms: () => {
        return JSON.parse(localStorage.getItem(OFFLINE_FARMS) || '[]');
    },

    clearOfflineFarms: () => {
        localStorage.removeItem(OFFLINE_FARMS);
    },

    hasPendingData: () => {
        const farmers = JSON.parse(localStorage.getItem(OFFLINE_FARMERS) || '[]');
        const farms = JSON.parse(localStorage.getItem(OFFLINE_FARMS) || '[]');
        return farmers.length > 0 || farms.length > 0;
    },

    /* -------------------------------------------------------------- */
    /* Incomplete-mapping drafts ("Continue Incomplete Mapping")       */
    /* -------------------------------------------------------------- */

    getDrafts: (): MappingDraft[] => {
        return JSON.parse(localStorage.getItem(DRAFT_MAPPINGS) || '[]');
    },

    getDraft: (id: string): MappingDraft | undefined => {
        return OfflineDataService.getDrafts().find(d => d.id === id);
    },

    /** Create or update (by id) a draft. Returns the saved draft (with id assigned if new). */
    saveDraft: (draft: Omit<MappingDraft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): MappingDraft => {
        const drafts = OfflineDataService.getDrafts();
        const now = new Date().toISOString();
        if (draft.id) {
            const idx = drafts.findIndex(d => d.id === draft.id);
            if (idx >= 0) {
                const updated: MappingDraft = { ...drafts[idx], ...draft, id: draft.id, updatedAt: now };
                drafts[idx] = updated;
                localStorage.setItem(DRAFT_MAPPINGS, JSON.stringify(drafts));
                return updated;
            }
        }
        const created: MappingDraft = {
            ...draft,
            id: draft.id || `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            createdAt: now,
            updatedAt: now,
        };
        drafts.push(created);
        localStorage.setItem(DRAFT_MAPPINGS, JSON.stringify(drafts));
        return created;
    },

    deleteDraft: (id: string) => {
        const drafts = OfflineDataService.getDrafts().filter(d => d.id !== id);
        localStorage.setItem(DRAFT_MAPPINGS, JSON.stringify(drafts));
    },

    syncOfflineData: async (apiClient: { post: (url: string, data: any) => Promise<{ data: any }> }): Promise<{ farmersSynced: number; farmsSynced: number; errors: string[] }> => {
        const errors: string[] = [];
        let farmersSynced = 0;
        let farmsSynced = 0;

        const farmers = OfflineDataService.getOfflineFarmers();
        for (let i = 0; i < farmers.length; i++) {
            const f = farmers[i];
            const { _queuedAt, ...data } = f;
            try {
                const res = await apiClient.post('/farmers/offline-sync', { farmer: data, farms: data.farms || [] });
                if (res.data?.status) {
                    farmersSynced++;
                } else {
                    errors.push(`Farmer ${i + 1}: ${(res.data as any)?.message || 'Failed'}`);
                }
            } catch (err: any) {
                errors.push(`Farmer ${i + 1}: ${err.response?.data?.message || err.message}`);
            }
        }
        if (farmersSynced > 0) {
            OfflineDataService.clearOfflineFarmers();
        }

        const farms = OfflineDataService.getOfflineFarms();
        for (let i = 0; i < farms.length; i++) {
            const f = farms[i];
            const { _queuedAt, polygonGeoJSON, ...data } = f;
            try {
                const payload = { ...data, location: polygonGeoJSON || data.location };
                const res = await apiClient.post('/farms/offline-sync', payload);
                if (res.data?.status) {
                    farmsSynced++;
                } else {
                    errors.push(`Farm ${i + 1}: ${(res.data as any)?.message || 'Failed'}`);
                }
            } catch (err: any) {
                errors.push(`Farm ${i + 1}: ${err.response?.data?.message || err.message}`);
            }
        }
        if (farmsSynced > 0) {
            OfflineDataService.clearOfflineFarms();
        }

        return { farmersSynced, farmsSynced, errors };
    }
};
