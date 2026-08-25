import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';

const QualityControlForm: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        checkDate: new Date().toISOString().split('T')[0],
        result: 'PASSED',
        comments: '',
        batchNumber: '' // In reality this should be a dropdown of batches
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Mocking a batch relation for now since we don't have batch selection logic yet
            // In a real app, we'd select an existing batch ID.
            await apiClient.post('/quality', formData);
            navigate('/quality');
        } catch (error) {
            console.error(error);
            alert('Error recording QC check');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">New Quality Control Check</h1>
            <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Batch Number (Manual Entry)</label>
                    <input
                        type="text"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        value={formData.batchNumber}
                        onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                        placeholder="Enter batch number"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Check Date</label>
                    <input
                        type="date"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        value={formData.checkDate}
                        onChange={(e) => setFormData({ ...formData, checkDate: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Result</label>
                    <select
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        value={formData.result}
                        onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                    >
                        <option value="PASSED">Passed</option>
                        <option value="FAILED">Failed</option>
                        <option value="PENDING">Pending</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Comments</label>
                    <textarea
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        rows={3}
                        value={formData.comments}
                        onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/quality')}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Save Record'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default QualityControlForm;
