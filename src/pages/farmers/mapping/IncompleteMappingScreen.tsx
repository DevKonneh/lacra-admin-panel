import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileClock, Trash2, ArrowRight } from 'lucide-react';
import { OfflineDataService, type MappingDraft } from '../../../services/OfflineDataService';

/**
 * "Continue Incomplete Mapping" — lists partially-filled mapping sessions
 * saved locally (see OfflineDataService.saveDraft/getDrafts) so an
 * enumerator can resume exactly where they left off, whether that's a
 * brand-new farmer registration or an in-progress "Add Farm to Existing
 * Farmer" session, without losing anything already entered.
 */
const IncompleteMappingScreen: React.FC = () => {
    const navigate = useNavigate();
    const [drafts, setDrafts] = useState<MappingDraft[]>([]);

    useEffect(() => {
        setDrafts(OfflineDataService.getDrafts());
    }, []);

    const resume = (draft: MappingDraft) => {
        if (draft.type === 'add_farm' && draft.farmerId) {
            navigate(`/farmers/mapping/confirm-identity/${draft.farmerId}`, { state: { draftId: draft.id } });
        } else {
            navigate('/farmers/register', { state: { draftId: draft.id } });
        }
    };

    const remove = (id: string) => {
        OfflineDataService.deleteDraft(id);
        setDrafts(OfflineDataService.getDrafts());
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center">
                <button onClick={() => navigate('/farmers/mapping/start')} className="mr-4 text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Continue Incomplete Mapping</h1>
                    <p className="text-sm text-gray-500">Resume a farmer or farm mapping session saved on this device.</p>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
                {drafts.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <FileClock className="h-10 w-10 mx-auto mb-2" />
                        <p className="text-sm">No incomplete mapping sessions saved on this device.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {drafts.map((d) => (
                            <div key={d.id} className="flex items-center gap-3 p-4 rounded-lg border border-gray-200">
                                <FileClock className="h-5 w-5 text-amber-500 flex-none" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900">{d.label}</p>
                                    <p className="text-xs text-gray-500">
                                        {d.type === 'add_farm' ? 'Add Farm to Existing Farmer' : 'Register New Farmer'} &middot; Last saved {new Date(d.updatedAt).toLocaleString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => remove(d.id)}
                                    className="text-gray-400 hover:text-red-500 p-2"
                                    title="Discard draft"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => resume(d)}
                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700"
                                >
                                    Resume <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default IncompleteMappingScreen;
