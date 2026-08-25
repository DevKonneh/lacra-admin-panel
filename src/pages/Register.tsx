import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import * as turf from '@turf/turf';
import apiClient from '../api/client';
import styles from './Register.module.css';

// Fix for default marker icon issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component for drawing controls
const MapDrawingControl: React.FC<{
    onCreated: (geojson: any, areaHash: any) => void;
    onDeleted: () => void;
}> = ({ onCreated, onDeleted }) => {
    const map = useMap();
    const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

    useEffect(() => {
        if (!map) return;

        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawnItemsRef.current = drawnItems;

        const drawControl = new L.Control.Draw({
            edit: {
                featureGroup: drawnItems,
                remove: true,
                edit: false
            },
            draw: {
                marker: false,
                circle: false,
                circlemarker: false,
                polyline: false,
                rectangle: false,
                polygon: {
                    allowIntersection: false,
                    showArea: true,
                    shapeOptions: {
                        color: '#0f7a3a',
                        weight: 2
                    }
                }
            }
        });

        map.addControl(drawControl);

        const handleCreated = (e: any) => {
            const layer = e.layer;
            drawnItems.clearLayers();
            drawnItems.addLayer(layer);

            const geojson = layer.toGeoJSON();
            const areaM2 = turf.area(geojson);
            const areaHa = (areaM2 / 10000).toFixed(4);
            const areaAc = (parseFloat(areaHa) * 2.47105).toFixed(4);

            onCreated(geojson, { areaHa, areaAc });
        };

        const handleDeleted = () => {
            onDeleted();
        };

        map.on(L.Draw.Event.CREATED, handleCreated);
        map.on(L.Draw.Event.DELETED, handleDeleted);

        return () => {
            map.removeControl(drawControl);
            map.removeLayer(drawnItems);
            map.off(L.Draw.Event.CREATED, handleCreated);
            map.off(L.Draw.Event.DELETED, handleDeleted);
        };
    }, [map, onCreated, onDeleted]);

    return null;
};

const Register: React.FC = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
    const [formData, setFormData] = useState({
        // Step 1: Personal Info
        fullName: '',
        email: '',
        gender: '',
        dob: '',
        phone: '',
        nationality: '',
        nationalId: '',
        // Step 2: Location
        county: '',
        district: '',
        community: '',
        inspectorName: '',
        lat: '',
        lng: '',
        directions: '',
        // Step 3: Farm Details
        farmName: '',
        crop: '',
        ownership: '',
        regStatus: '',
        farmSizeManual: '',
        farmUnitManual: 'hectares',
        farmNotes: '',
        // Step 4: Mapping (GeoJSON string for now)
        boundaryJson: '',
        areaHa: '0.0000',
        areaAc: '0.0000',
        // Step 5: Attachments & Consent
        consent: false
    });

    const steps = [
        { title: "Personal Info", hint: "Farmer identity and contact", pageTitle: "Personal Information", pageHint: "Enter the farmer's basic details." },
        { title: "Location & GPS", hint: "County, community, capture GPS", pageTitle: "Location & GPS", pageHint: "Enter location details and capture GPS coordinates." },
        { title: "Farm Details", hint: "Crop, ownership, notes", pageTitle: "Farm Details", pageHint: "Enter farm information (crop, ownership, registration)." },
        { title: "Mapping", hint: "Draw polygon boundary", pageTitle: "Farm Mapping", pageHint: "Draw the farm boundary polygon and confirm area." },
        { title: "Attachments", hint: "Photos & consent", pageTitle: "Evidence & Consent", pageHint: "Upload supporting evidence and confirm consent." },
        { title: "Review & Submit", hint: "Check and submit", pageTitle: "Review & Submit", pageHint: "Confirm the data, export JSON, or submit to server." }
    ];

    const validateStep = (step: number) => {
        const d = formData;
        let ok = true;
        if (step === 0) {
            if (!d.fullName || !d.gender || !d.phone) ok = false;
        } else if (step === 1) {
            if (!d.county || !d.community || !d.inspectorName) ok = false;
        } else if (step === 2) {
            if (!d.farmName || !d.crop || !d.ownership) ok = false;
        } else if (step === 3) {
            // Mapping validation typically checks for polygon
            // if (!d.boundaryJson) ok = false; 
        } else if (step === 4) {
            if (!d.consent) ok = false;
        }
        return ok;
    };

    const handleNext = () => {
        if (!validateStep(currentStep)) {
            alert("Please complete required fields.");
            return;
        }
        const newDone = new Set(doneSteps);
        newDone.add(currentStep);
        setDoneSteps(newDone);

        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Submit
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
    };

    const handleSubmit = async () => {
        try {
            // Adapt payload to match backend expectations
            // This is a placeholder payload structure based on the fields
            await apiClient.post('/auth/register-farmer', formData);
            alert('Registration successful!');
            navigate('/login');
        } catch (err: any) {
            alert('Registration failed: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        // Handle checkbox special case if needed, though 'consent' is boolean in state
        if (e.target.type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [id]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [id]: value }));
        }
    };

    return (
        <div className={styles.registerContainer}>
            <div className={styles.app}>
                <div className={styles.header}>
                    <div className={styles.logo}></div>
                    <div>
                        <h1>Inspector Farm Mapping</h1>
                        <p>Enter farmer details, capture GPS, draw farm boundary, attach evidence, and submit.</p>
                    </div>
                    <div className={styles.headerRight}>
                        <button className={styles.btnGhost}>Load Draft</button>
                        <button className={styles.btnGhost}>Save Draft</button>
                        <button className={styles.btnDanger}>Clear</button>
                    </div>
                </div>

                <aside className={`${styles.card} ${styles.side}`}>
                    <div className={styles.sideTop}>
                        <div className={styles.pill}>LACRA • CMIS</div>
                        <div className={styles.muted}>
                            Complete each section and click <b>Next</b>. Sections marked done are ready.
                        </div>
                    </div>

                    <div className={styles.steps}>
                        {steps.map((s, i) => (
                            <button
                                key={i}
                                className={`${styles.stepBtn} ${currentStep === i ? styles.stepBtnActive : ''} ${doneSteps.has(i) ? styles.stepBtnDone : ''}`}
                                onClick={() => { if (i < currentStep || doneSteps.has(i)) setCurrentStep(i) }}
                            >
                                <div className={styles.num}>{doneSteps.has(i) ? "✓" : i + 1}</div>
                                <div>
                                    <div className={styles.stepTitle}>{s.title}</div>
                                    <div className={styles.stepHint}>{s.hint}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className={styles.sideFoot}>
                        <button className={styles.btn} onClick={handleBack} disabled={currentStep === 0}>Back</button>
                        <button className={styles.btnPrimary} onClick={handleNext}>
                            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </aside>

                <main className={styles.card}>
                    <div className={styles.mainTop}>
                        <div>
                            <h2>{steps[currentStep].pageTitle}</h2>
                            <p>{steps[currentStep].pageHint}</p>
                        </div>
                        <div>
                            <span className={styles.pill}>Step {currentStep + 1} of {steps.length}</span>
                        </div>
                    </div>

                    <div className={styles.content}>
                        {/* STEP 0: Personal Info */}
                        {currentStep === 0 && (
                            <>
                                <div className={styles.grid2}>
                                    <div>
                                        <label className={styles.label}>Farmer Full Name *</label>
                                        <input className={styles.input} id="fullName" value={formData.fullName} onChange={handleChange} placeholder="e.g., Mary T. Kamara" />
                                    </div>
                                    <div>
                                        <label className={styles.label}>Email</label>
                                        <input className={styles.input} id="email" value={formData.email} onChange={handleChange} placeholder="e.g., [EMAIL_ADDRESS]" />
                                    </div>
                                    <div>
                                        <label className={styles.label}>Gender *</label>
                                        <select className={styles.select} id="gender" value={formData.gender} onChange={handleChange}>
                                            <option value="">Select</option>
                                            <option>Male</option>
                                            <option>Female</option>
                                            <option>Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={styles.label}>Date of Birth / Age</label>
                                        <input className={styles.input} id="dob" value={formData.dob} onChange={handleChange} placeholder="e.g., 1990-06-14 or 34" />
                                    </div>
                                    <div>
                                        <label className={styles.label}>Phone Number *</label>
                                        <input className={styles.input} id="phone" value={formData.phone} onChange={handleChange} placeholder="+231..." />
                                    </div>
                                    <div>
                                        <label className={styles.label}>Nationality</label>
                                        <input className={styles.input} id="nationality" value={formData.nationality} onChange={handleChange} placeholder="e.g., Liberian" />
                                    </div>
                                    <div>
                                        <label className={styles.label}>National ID (LASSRA/Other)</label>
                                        <input className={styles.input} id="nationalId" value={formData.nationalId} onChange={handleChange} placeholder="e.g., LASSRA-XXXXXX" />
                                    </div>
                                </div>
                                <label className={styles.label}>Farmer Photo (upload/capture)</label>
                                <input className={styles.input} type="file" accept="image/*" />
                                <div className={styles.help}>Tip: On a phone/tablet, the camera option will appear automatically for photo capture.</div>
                            </>
                        )}

                        {/* STEP 1: Location */}
                        {currentStep === 1 && (
                            <>
                                <div className={styles.grid2}>
                                    <div>
                                        <label className={styles.label}>County *</label>
                                        <input className={styles.input} id="county" value={formData.county} onChange={handleChange} placeholder="e.g., Bong" />
                                    </div>
                                    <div>
                                        <label className={styles.label}>District</label>
                                        <input className={styles.input} id="district" value={formData.district} onChange={handleChange} placeholder="e.g., District #3" />
                                    </div>
                                    <div>
                                        <label className={styles.label}>Community / Town / Village *</label>
                                        <input className={styles.input} id="community" value={formData.community} onChange={handleChange} placeholder="e.g., Gbarnga Town" />
                                    </div>
                                    <div>
                                        <label className={styles.label}>Enumerator / Inspector Name *</label>
                                        <input className={styles.input} id="inspectorName" value={formData.inspectorName} onChange={handleChange} placeholder="e.g., John Doe" />
                                    </div>
                                </div>
                                <div className={styles.mapRow}>
                                    <button className={styles.btnPrimary} onClick={() => {
                                        if (!navigator.geolocation) {
                                            alert("Geolocation is not supported by your browser");
                                            return;
                                        }
                                        navigator.geolocation.getCurrentPosition(
                                            (position) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    lat: position.coords.latitude.toFixed(6),
                                                    lng: position.coords.longitude.toFixed(6)
                                                }));
                                            },
                                            (error) => {
                                                alert("Unable to retrieve your location: " + error.message);
                                            }
                                        );
                                    }}>Capture GPS</button>
                                    <button className={styles.btn} onClick={() => alert("Map view not active")}>Center on GPS</button>
                                    <span className={styles.pill}>GPS: {formData.lat && formData.lng ? "Captured" : "Not captured"}</span>
                                </div>
                                <div className={`${styles.grid2}`} style={{ marginTop: '10px' }}>
                                    <div>
                                        <label className={styles.label}>Latitude</label>
                                        <input className={styles.input} id="lat" value={formData.lat} readOnly placeholder="—" />
                                    </div>
                                    <div>
                                        <label className={styles.label}>Longitude</label>
                                        <input className={styles.input} id="lng" value={formData.lng} readOnly placeholder="—" />
                                    </div>
                                </div>
                                <label className={styles.label}>Directions to Farm (optional)</label>
                                <textarea className={styles.textarea} id="directions" value={formData.directions} onChange={handleChange} placeholder="Landmarks, road description..." />
                            </>
                        )}

                        {/* STEP 2: Farm Details */}
                        {currentStep === 2 && (
                            <>
                                <div className={styles.grid2}>
                                    <div>
                                        <label className={styles.label}>Farm Name *</label>
                                        <input className={styles.input} id="farmName" value={formData.farmName} onChange={handleChange} placeholder="e.g., Kamara Cocoa Farm" />
                                    </div>
                                    <div>
                                        <label className={styles.label}>Primary Crop *</label>
                                        <select className={styles.select} id="crop" value={formData.crop} onChange={handleChange}>
                                            <option value="">Select</option>
                                            <option>Cocoa</option>
                                            <option>Coffee</option>
                                            <option>Oil Palm</option>
                                            <option>Rubber</option>
                                            <option>Cassava</option>
                                            <option>Vegetables</option>
                                            <option>Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={styles.label}>Ownership Type *</label>
                                        <select className={styles.select} id="ownership" value={formData.ownership} onChange={handleChange}>
                                            <option value="">Select</option>
                                            <option>Owned</option>
                                            <option>Rented</option>
                                            <option>Family Inherited</option>
                                            <option>Communal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={styles.label}>Farm Registration Status</label>
                                        <select className={styles.select} id="regStatus" value={formData.regStatus} onChange={handleChange}>
                                            <option value="">Select</option>
                                            <option>Registered</option>
                                            <option>Not Registered</option>
                                        </select>
                                    </div>
                                </div>
                                <div className={styles.grid2}>
                                    <div>
                                        <label className={styles.label}>Farm Size (manual estimate)</label>
                                        <input className={styles.input} id="farmSizeManual" value={formData.farmSizeManual} onChange={handleChange} placeholder="e.g., 3.2" />
                                    </div>
                                    <div>
                                        <label className={styles.label}>Unit</label>
                                        <select className={styles.select} id="farmUnitManual" value={formData.farmUnitManual} onChange={handleChange}>
                                            <option value="hectares">Hectares</option>
                                            <option value="acres">Acres</option>
                                        </select>
                                    </div>
                                </div>
                                <label className={styles.label}>Notes</label>
                                <textarea className={styles.textarea} id="farmNotes" value={formData.farmNotes} onChange={handleChange} placeholder="Any special notes about the farm..." />
                            </>
                        )}

                        {/* STEP 3: Mapping */}
                        {currentStep === 3 && (
                            <>
                                <div className={styles.help} style={{ marginBottom: '10px' }}>
                                    Draw the farm boundary polygon using the map tools (top-left). You can edit or delete after drawing.
                                </div>
                                <div className={styles.map} id="map">
                                    {/* Placeholder for map */}
                                    <MapContainer
                                        center={[6.3156, -10.8074]}
                                        zoom={12}
                                        style={{ height: '100%', width: '100%', borderRadius: '16px' }}
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        />
                                        <MapDrawingControl
                                            onCreated={(geojson, { areaHa, areaAc }) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    boundaryJson: JSON.stringify(geojson, null, 2),
                                                    areaHa,
                                                    areaAc
                                                }));
                                            }}
                                            onDeleted={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    boundaryJson: '',
                                                    areaHa: '0.0000',
                                                    areaAc: '0.0000'
                                                }));
                                            }}
                                        />
                                    </MapContainer>
                                </div>
                                <div className={styles.mapRow}>
                                    <span className={styles.pill}>Boundary: {formData.boundaryJson ? "Captured" : "Not started"}</span>
                                    <span className={styles.pill}>Area (ha): <b>{formData.areaHa}</b></span>
                                    <button className={`${styles.btnDanger}`} onClick={() => {
                                        // Reset state - map clearing is handled by drawing control logic but ideally we'd force clear
                                        setFormData(prev => ({
                                            ...prev,
                                            boundaryJson: '',
                                            areaHa: '0.0000',
                                            areaAc: '0.0000'
                                        }));
                                    }}>Reset Polygon</button>
                                </div>
                                <label className={styles.label}>Boundary GeoJSON</label>
                                <textarea className={styles.textarea} readOnly value={formData.boundaryJson} placeholder="GeoJSON will appear after drawing..." />
                            </>
                        )}

                        {/* STEP 4: Attachments */}
                        {currentStep === 4 && (
                            <>
                                <label className={styles.label}>Upload National ID / Proof (optional)</label>
                                <input className={styles.input} type="file" accept="image/*,application/pdf" />

                                <label className={styles.label}>Upload Farmer on Farm Photo (recommended)</label>
                                <input className={styles.input} type="file" accept="image/*" />

                                <label className={styles.label}>Upload Farm Photos (optional, multiple)</label>
                                <input className={styles.input} type="file" accept="image/*" multiple />

                                <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
                                    <input type="checkbox" id="consent" checked={formData.consent} onChange={handleChange} />
                                    Farmer agrees to data capture and verification *
                                </label>
                            </>
                        )}

                        {/* STEP 5: Review */}
                        {currentStep === 5 && (
                            <>
                                <div className={styles.help}>
                                    Review your submission. If everything looks good, click <b>Submit</b>.
                                </div>
                                <div className={styles.grid2} style={{ marginTop: '10px' }}>
                                    <button className={styles.btn}>Export JSON</button>
                                    <button className={styles.btnPrimary} onClick={handleSubmit}>Submit</button>
                                </div>
                                <label className={styles.label} style={{ marginTop: '12px' }}>Preview Payload</label>
                                <pre className={styles.reviewBox}>
                                    {JSON.stringify(formData, null, 2)}
                                </pre>
                            </>
                        )}
                    </div>

                    <div className={styles.bar}>
                        <div className={styles.barLeft}>
                            {validateStep(currentStep) ? "All good. Continue." : "Required fields must be completed to proceed."}
                        </div>
                        <div className={styles.barRight}>
                            <button className={styles.btn} onClick={handleBack} disabled={currentStep === 0}>Back</button>
                            <button className={styles.btnPrimary} onClick={handleNext}>
                                {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Register;
