import React, { useEffect, useState } from 'react';
import { createShipment, getAllShipments, validateShipment, getDDSData, type DDSData } from '../../api/shipments';
import type { Shipment } from '../../api/shipments';
import { getAllBatches } from '../../api/batches';
import type { Batch } from '../../api/batches';
import jsPDF from 'jspdf';

const ExportManager: React.FC = () => {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
    const [destination, setDestination] = useState('Netherlands');
    const [vessel, setVessel] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [shipRes, batchRes] = await Promise.all([getAllShipments(), getAllBatches()]);
        if (shipRes.data.status) setShipments(shipRes.data.data);

        if (batchRes.data.status) {
            const allBatches = batchRes.data.data;
            // Filter only WAREHOUSE batches for export
            const readyBatches = allBatches.filter((b: Batch) => b.status === 'WAREHOUSE');
            setBatches(readyBatches);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createShipment(selectedBatches, destination, vessel);
            alert('Shipment Created!');
            setSelectedBatches([]);
            setVessel('');
            loadData();
        } catch (error) {
            alert('Error creating shipment');
        } finally {
            setLoading(false);
        }
    };

    const handleValidate = async (id: string) => {
        try {
            const res = await validateShipment(id);
            if (res.data.status) {
                alert(`Compliance Verified! DDS Issued: ${res.data.data.ddsNumber}`); // ddsNumber is inside data wrapper
                loadData();
            }
        } catch (error: any) {
            if (error.response && error.response.data && error.response.data.errors) {
                const violations = error.response.data.errors.join('\n- ');
                alert(`Compliance Check Failed:\n- ${violations}`);
            } else {
                alert('Compliance Check Failed: Unknown error');
            }
        }
    };

    const generateDDSAsPDF = (d: DDSData) => {
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        let y = 20;
        const lineHeight = 6;
        const sectionGap = 4;

        const addText = (text: string, opts?: { bold?: boolean; size?: number }) => {
            pdf.setFontSize(opts?.size ?? 10);
            pdf.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
            const lines = pdf.splitTextToSize(text, pageWidth - 40);
            lines.forEach((line: string) => {
                pdf.text(line, 20, y);
                y += lineHeight;
            });
        };

        addText('EU DUE DILIGENCE STATEMENT (EUDR)', { bold: true, size: 14 });
        y += sectionGap;
        addText(`DDS Reference: ${d.ddsNumber} | Shipment: ${d.shipmentId} | Destination: ${d.destinationCountry}`);
        addText(`Vessel: ${d.vesselName} | Date: ${d.signature.date}`);
        y += sectionGap;

        addText('1. OPERATOR', { bold: true });
        addText(`Name: ${d.operator.name} | Registration: ${d.operator.registrationNumber}`);
        addText(`Address: ${d.operator.address}${d.operator.eori ? ` | EORI: ${d.operator.eori}` : ''}`);
        y += sectionGap;

        addText('2. PRODUCT', { bold: true });
        addText(`Description: ${d.product.description} | HS Code: ${d.product.hsCode} | Net Mass (kg): ${d.product.volumeKg}`);
        y += sectionGap;

        addText('3. GEOLOCATION (Plot-level)', { bold: true });
        d.geolocations.forEach((g, i) => {
            addText(`Plot ${i + 1}: ${g.farmName} - Farmer: ${g.farmerName}`);
            addText(`Country: ${g.country} | Coordinates: ${g.coordinates}`);
            if (y > 270) { pdf.addPage(); y = 20; }
        });
        y += sectionGap;

        addText('4. RISK & COMPLIANCE', { bold: true });
        addText(d.riskCompliance);
        y += sectionGap;

        addText('5. SIGNATURE', { bold: true });
        addText(`Issued by: ${d.signature.issuedBy} | Date: ${d.signature.date}`);
        addText(d.signature.statement);

        pdf.save(`${d.ddsNumber}.pdf`);
    };

    const handleDownloadDDS = async (shipment: Shipment) => {
        if (!shipment.ddsNumber) {
            const content = 'DDS has not been issued for this shipment. Please run the compliance check first.';
            const blob = new Blob([content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dds-not-issued.txt';
            a.click();
            window.URL.revokeObjectURL(url);
            return;
        }
        try {
            const res = await getDDSData(shipment.id);
            if (res.data.status && res.data.data) {
                const dds = res.data.data;
                generateDDSAsPDF(dds);
            } else {
                throw new Error('Failed to load DDS data');
            }
        } catch (err) {
            console.error(err);
            const fallback = `LACRA DUE DILIGENCE STATEMENT\nDDS Reference: ${shipment.ddsNumber}\nShipment: ${shipment.shipmentId}\nDestination: ${shipment.destinationCountry}\nVessel: ${shipment.vesselName}\nDate: ${new Date().toLocaleDateString()}\nStatus: COMPLIANT\n\nVerified against EU Deforestation Regulation.`;
            const blob = new Blob([fallback], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${shipment.ddsNumber}.txt`;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    };

    const toggleBatch = (id: string) => {
        setSelectedBatches(prev =>
            prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Export & DDS Generation</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Create Shipment */}
                <div className="lg:col-span-1 bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">New Shipment</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Destination Country</label>
                            <input type="text" value={destination} onChange={e => setDestination(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Vessel / Flight Name</label>
                            <input type="text" value={vessel} onChange={e => setVessel(e.target.value)} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Batches (From Warehouse)</label>
                            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2">
                                {batches.map(b => (
                                    <div key={b.id} className="flex items-center py-1">
                                        <input type="checkbox" checked={selectedBatches.includes(b.id)} onChange={() => toggleBatch(b.id)} className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded" />
                                        <span className="ml-2 text-sm text-gray-700">{b.batchId} ({b.cropType}, {b.weightKg}kg)</span>
                                    </div>
                                ))}
                                {batches.length === 0 && <p className="text-xs text-gray-400 p-2">No batches ready in Warehouse.</p>}
                            </div>
                        </div>
                        <button type="submit" disabled={loading || selectedBatches.length === 0} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400">
                            {loading ? 'Creating...' : 'Create Shipment Draft'}
                        </button>
                    </form>
                </div>

                {/* Shipment List */}
                <div className="lg:col-span-2 bg-white shadow rounded-lg overflow-hidden">
                    <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Active Shipments</h3>
                    </div>
                    <ul className="divide-y divide-gray-200">
                        {shipments.map(ship => (
                            <li key={ship.id} className="p-4 hover:bg-gray-50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center">
                                            <p className="text-lg font-bold text-gray-900">{ship.shipmentId}</p>
                                            <span className={`ml-3 px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${ship.status === 'ISSUED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {ship.status}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-gray-500">
                                            To: <strong>{ship.destinationCountry}</strong> via {ship.vesselName}
                                        </p>
                                        <p className="text-sm text-gray-500">Includes {ship.batches?.length} batches</p>
                                        {ship.ddsNumber && (
                                            <p className="mt-2 text-sm font-medium text-blue-600">DDS Reference: {ship.ddsNumber}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col space-y-2">
                                        {ship.status === 'DRAFT' && (
                                            <button onClick={() => handleValidate(ship.id)} className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none">
                                                Run Compliance Check
                                            </button>
                                        )}
                                        {ship.status === 'ISSUED' && (
                                            <button onClick={() => handleDownloadDDS(ship)} className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none">
                                                Download DDS PDF
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                        {shipments.length === 0 && <li className="p-4 text-center text-gray-500">No shipments created.</li>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ExportManager;
