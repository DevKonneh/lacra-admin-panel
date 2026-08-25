import React, { useEffect, useState } from 'react';
import { OfflineDataService } from '../services/OfflineDataService';
import apiClient from '../api/client';

const OfflineBanner: React.FC = () => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [syncing, setSyncing] = useState(false);

    const updatePending = () => {
        const farmers = OfflineDataService.getOfflineFarmers().length;
        const farms = OfflineDataService.getOfflineFarms().length;
        setPendingCount(farmers + farms);
    };

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            updatePending();
        };
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        updatePending();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleSync = async () => {
        if (!OfflineDataService.hasPendingData() || syncing) return;
        setSyncing(true);
        try {
            const result = await OfflineDataService.syncOfflineData(apiClient);
            const total = result.farmersSynced + result.farmsSynced;
            if (total > 0) {
                alert(`Synced ${total} record(s). ${result.errors.length ? 'Some errors: ' + result.errors.join('; ') : ''}`);
                updatePending();
            }
            if (result.errors.length > 0 && total === 0) {
                alert('Sync failed: ' + result.errors.join('; '));
            }
        } finally {
            setSyncing(false);
        }
    };

    if (isOffline) {
        return (
            <div className="bg-yellow-500 text-white text-center py-2 font-medium">
                You are currently offline. Changes will be synced when connection is restored.
            </div>
        );
    }

    if (pendingCount > 0) {
        return (
            <div className="bg-blue-600 text-white text-center py-2 px-4 flex items-center justify-center gap-4">
                <span>{pendingCount} pending record(s) to sync</span>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="px-3 py-1 bg-white text-blue-600 rounded font-medium hover:bg-blue-50 disabled:opacity-50"
                >
                    {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
            </div>
        );
    }

    return null;
};

export default OfflineBanner;
