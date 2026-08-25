import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createBatch, getAllBatches, updateBatchStatus } from '../../api/batches';
import type { Batch } from '../../api/batches';
import { getFarmers } from '../../api/farmers';
import { QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';

const BatchManager: React.FC = () => {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [farmers, setFarmers] = useState<any[]>([]);
    const [selectedFarmers, setSelectedFarmers] = useState<string[]>([]);
    const [weight, setWeight] = useState(0);
    const [cropType, setCropType] = useState('Cocoa');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [batchRes, farmerRes] = await Promise.all([getAllBatches(), getFarmers()]);
        if (batchRes.data.status) {
            setBatches(batchRes.data.data);
        }
        if (farmerRes.data.status) {
            setFarmers(farmerRes.data.data);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createBatch(selectedFarmers, weight, cropType);
            alert('Batch Created!');
            setSelectedFarmers([]);
            setWeight(0);
            loadData();
        } catch (error) {
            alert('Error creating batch. Ensure you have an ACTIVE license.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await updateBatchStatus(id, status);
            loadData();
        } catch (error) {
            alert('Error updating status');
        }
    };

    const toggleFarmer = (id: string) => {
        setSelectedFarmers(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    };

    const handleDownloadPDF = (batch: Batch) => {
        // Use high-res hidden canvas
        const canvas = document.getElementById(`qr-batch-pdf-${batch.id}`) as HTMLCanvasElement;
        if (!canvas) {
            alert("QR Code not ready. Please try again.");
            return;
        }

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF();

        // Card Dimensions
        const cardX = 20;
        const cardY = 20;
        const cardWidth = 170;
        const cardHeight = 100;
        const cornerRadius = 3;

        // Draw Card Border and Background
        pdf.setDrawColor(200, 200, 200);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(cardX, cardY, cardWidth, cardHeight, cornerRadius, cornerRadius, 'FD');

        // Header
        pdf.setFillColor(22, 163, 74); // Green-600
        pdf.rect(cardX, cardY + 5, cardWidth, 15, 'F');

        // Header Text
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("BATCH TRACEABILITY CARD", cardX + cardWidth / 2, cardY + 15, { align: "center" });

        // Content
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);

        const startX = cardX + 10;
        const startY = cardY + 35;
        const lineHeight = 8;
        let currentY = startY;

        const addField = (label: string, value: string) => {
            pdf.setFont("helvetica", "bold");
            pdf.text(label, startX, currentY);
            pdf.setFont("helvetica", "normal");
            pdf.text(value, startX + 35, currentY);
            currentY += lineHeight;
        };

        addField("Batch ID:", batch.batchId);
        currentY += 2;
        addField("Crop:", batch.cropType);
        addField("Weight:", `${batch.weightKg} kg`);
        addField("Status:", batch.status);
        addField("Farmers:", `${batch.farmers?.length || 0} contributing farmers`);
        const dateStr = batch.createdAt ? new Date(batch.createdAt).toLocaleDateString() : 'N/A';
        addField("Created:", dateStr);

        // Add QR Code (Right side)
        const qrSize = 30; // Small optimized size
        const qrX = cardX + cardWidth - qrSize - 20;
        const qrY = cardY + 30;

        pdf.addImage(imgData, 'PNG', qrX, qrY, qrSize, qrSize);

        // QR Label
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text("Scan for Supply Chain", qrX + qrSize / 2, qrY + qrSize + 5, { align: "center" });

        // Card Footer
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text("LACRA Supply Chain Platform", cardX + cardWidth / 2, cardY + cardHeight - 8, { align: "center" });

        pdf.save(`BatchCard_${batch.batchId}.pdf`);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Batch Management & Traceability</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Create Batch Form */}
                <div className="lg:col-span-1 bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Batch</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Crop Type</label>
                            <select value={cropType} onChange={e => setCropType(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm">
                                <option>Cocoa</option>
                                <option>Coffee</option>
                                <option>Palm Oil</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Total Weight (Kg)</label>
                            <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Source Farmers</label>
                            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2">
                                {farmers.map(f => (
                                    <div key={f.id} className="flex items-center py-1">
                                        <input type="checkbox" checked={selectedFarmers.includes(f.id)} onChange={() => toggleFarmer(f.id)} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                                        <span className="ml-2 text-sm text-gray-700">{f.firstName} {f.lastName}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{selectedFarmers.length} farmers selected</p>
                        </div>
                        <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                            {loading ? 'Creating...' : 'Generate Batch'}
                        </button>
                    </form>
                </div>

                {/* Batch List */}
                <div className="lg:col-span-2 bg-white shadow rounded-lg overflow-hidden">
                    <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Active Batches</h3>
                    </div>
                    <ul className="divide-y divide-gray-200">
                        {batches.map(batch => (
                            <li key={batch.id} className="p-4 hover:bg-gray-50">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center">
                                            <p className="text-sm font-medium text-green-600 truncate">{batch.batchId}</p>
                                            <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800`}>
                                                {batch.status}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {batch.cropType} • {batch.weightKg}kg • from {batch.farmers?.length || 0} farmers
                                        </p>
                                        <p className="text-xs text-gray-400">Created by: {batch.createdBy?.holderName || 'Unknown'}</p>
                                    </div>
                                    <div className="ml-4 flex-shrink-0 flex flex-col items-center gap-2">
                                        {/* Hidden high-res canvas for PDF */}
                                        <div style={{ display: 'none' }}>
                                            <QRCodeCanvas
                                                id={`qr-batch-pdf-${batch.id}`}
                                                value={`${window.location.origin}/public/batches/${batch.id}`}
                                                size={256}
                                                level={"H"}
                                                includeMargin={true}
                                            />
                                        </div>
                                        {/* Visible normal canvas */}
                                        <QRCodeCanvas
                                            id={`qr-batch-${batch.id}`}
                                            value={`${window.location.origin}/public/batches/${batch.id}`}
                                            size={64}
                                            level={"M"}
                                            includeMargin={true}
                                        />
                                        <button
                                            onClick={() => handleDownloadPDF(batch)}
                                            className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded border border-gray-300 font-medium whitespace-nowrap"
                                        >
                                            Download PDF
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <Link
                                        to={`/custody/batch/${batch.id}`}
                                        className="text-xs bg-green-50 hover:bg-green-100 text-green-700 py-1 px-3 rounded border border-green-200"
                                    >
                                        Custody History
                                    </Link>
                                    {batch.status === 'COLLECTED' && (
                                        <button onClick={() => handleUpdateStatus(batch.id, 'IN_TRANSIT')} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 px-3 rounded">Move to Transit</button>
                                    )}
                                    {batch.status === 'IN_TRANSIT' && (
                                        <button onClick={() => handleUpdateStatus(batch.id, 'WAREHOUSE')} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 px-3 rounded">Receive at Warehouse</button>
                                    )}
                                    {batch.status === 'WAREHOUSE' && (
                                        <button onClick={() => handleUpdateStatus(batch.id, 'SHIPPED')} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 px-3 rounded">Ship for Export</button>
                                    )}
                                </div>
                            </li>
                        ))}
                        {batches.length === 0 && <li className="p-4 text-center text-gray-500">No batches created yet.</li>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default BatchManager;
