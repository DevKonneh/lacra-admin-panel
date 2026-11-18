import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Search, RotateCcw, MapPin, ChevronRight } from 'lucide-react';
import { OfflineDataService } from '../../../services/OfflineDataService';

/**
 * "How would you like to begin?" — the new opening gate for the Farm
 * Mapping Tool, inserted BEFORE Personal Information is ever collected.
 * This is the single fix for the core problem described in the task: an
 * enumerator no longer has to (accidentally or otherwise) re-collect a
 * returning farmer's full personal profile just to map another farm.
 */
const StartScreen: React.FC = () => {
    const navigate = useNavigate();
    const [draftCount, setDraftCount] = useState(0);

    useEffect(() => {
        setDraftCount(OfflineDataService.getDrafts().length);
    }, []);

    const options = [
        {
            key: 'new',
            icon: UserPlus,
            title: 'Register New Farmer',
            description: 'This person has never been mapped before. Collect their full personal profile and first farm.',
            onClick: () => navigate('/farmers/register'),
        },
        {
            key: 'existing',
            icon: Search,
            title: 'Add Farm to Existing Farmer',
            description: 'This farmer is already registered and you just need to map another farm they own or manage.',
            onClick: () => navigate('/farmers/mapping/find'),
        },
        {
            key: 'incomplete',
            icon: RotateCcw,
            title: 'Continue Incomplete Mapping',
            description: 'Resume a farmer or farm mapping session you started earlier but did not finish.',
            onClick: () => navigate('/farmers/mapping/incomplete'),
            badge: draftCount > 0 ? draftCount : undefined,
        },
    ];

    return (
        <div className="max-w-2xl mx-auto py-8 space-y-8">
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 text-green-700 mb-2">
                    <MapPin className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">How would you like to begin?</h1>
                <p className="text-sm text-gray-500">Choose an option to start the Farm Mapping Tool.</p>
            </div>

            <div className="space-y-3">
                {options.map((opt) => {
                    const Icon = opt.icon;
                    return (
                        <button
                            key={opt.key}
                            onClick={opt.onClick}
                            className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-green-400 hover:shadow-md transition-all text-left group"
                        >
                            <div className="flex-none h-11 w-11 rounded-lg bg-green-50 text-green-700 flex items-center justify-center group-hover:bg-green-100">
                                <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-gray-900">{opt.title}</h3>
                                    {!!opt.badge && (
                                        <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                            {opt.badge} pending
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-green-500 flex-none" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default StartScreen;
