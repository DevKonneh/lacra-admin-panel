const OFFLINE_FARMERS = 'offline_farmers';
const OFFLINE_FARMS = 'offline_farms';

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

    saveFarmLocally: (farmData: { farmerId?: string; name: string; cropType: string; location: object; totalAreaHa?: number; polygonGeoJSON?: object }) => {
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
