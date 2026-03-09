import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSlots } from '../utils/api';
import FloorPlan from '../components/FloorPlan';
import gsap from 'gsap';

export default function MallPage() {
    const { mallId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    // State
    const [level, setLevel] = useState(1);
    const [slots, setSlots] = useState([]);
    const [viewDate, setViewDate] = useState('today'); // VIEWING date (for map coloring)
    const [navTrigger, setNavTrigger] = useState(0); // integer to trigger nav effect
    const [showRoiConfig, setShowRoiConfig] = useState(false);
    const canvasRef = useRef(null);
    const [rois, setRois] = useState({});
    const [currentSlotConfig, setCurrentSlotConfig] = useState('M2-L1-S1');
    const [drawing, setDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const mallName = mallId === 'mall1' ? 'Mall 1' : 'Mall 2';
    const levels = mallId === 'mall1' ? [1, 2] : [1];

    const fetchSlots = async () => {
        try {
            const dateObj = new Date();
            if (viewDate === 'tomorrow') {
                dateObj.setDate(dateObj.getDate() + 1);
            }
            const dateStr = formatDate(dateObj);
            const data = await getSlots(dateStr, user.user_id);
            setSlots(data);
        } catch (e) {
            console.error(e);
        }
    };

    const formatDate = (d) => {
        let dd = d.getDate();
        let mm = d.getMonth() + 1;
        let yyyy = d.getFullYear();
        if (dd < 10) dd = '0' + dd;
        if (mm < 10) mm = '0' + mm;
        return '' + dd + mm + yyyy;
    };

    useEffect(() => {
        fetchSlots();
        // Poll every 2 seconds for real-time updates
        const interval = setInterval(fetchSlots, 2000);
        return () => clearInterval(interval);
    }, [mallId, viewDate]);

    return (
        <div style={{ padding: '2rem' }}>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'transparent', paddingLeft: 0, marginBottom: '1rem' }}>
                ← Back to Dashboard
            </button>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>{mallName} <span style={{ fontSize: '0.6em', opacity: 0.7 }}>Level {level}</span></h1>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* View Date Selector (To see future availability) */}
                    <select
                        className="input-field"
                        style={{ width: 'auto', margin: 0 }}
                        value={viewDate}
                        onChange={(e) => setViewDate(e.target.value)}
                    >
                        <option value="today">Today's Status</option>
                        <option value="tomorrow">Tomorrow's Avail.</option>
                    </select>

                    <button onClick={() => setNavTrigger(p => p + 1)} style={{ background: 'var(--accent)' }}>
                        Navigate to Closest
                    </button>
                </div>
            </div>

            {/* Level Tabs */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '1rem' }}>
                {levels.map(l => (
                    <div
                        key={l}
                        onClick={() => setLevel(l)}
                        style={{
                            padding: '10px 20px',
                            background: level === l ? 'var(--primary)' : '#333',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Level {l}
                    </div>
                ))}
            </div>

            <FloorPlan
                mallId={mallId}
                level={level}
                slots={slots}
                refreshSlots={fetchSlots}
                onNavigate={navTrigger > 0 ? navTrigger : null}
            />

            {mallId === 'mall2' && level === 1 && (
                <div style={{ marginTop: '3rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>
                        <h2 style={{ color: 'var(--text)', margin: 0 }}>Live Camera Feed</h2>
                        <button
                            onClick={() => {
                                // Fetch existing ROIs before opening
                                fetch('http://localhost:5001/get_rois')
                                    .then(res => res.json())
                                    .then(data => {
                                        if (data.rois) setRois(data.rois);
                                        setShowRoiConfig(true);
                                    })
                                    .catch(err => {
                                        console.error(err);
                                        setShowRoiConfig(true);
                                    });
                            }}
                            style={{ background: 'var(--primary)', padding: '8px 16px', fontSize: '0.9rem' }}>
                            ⚙️ Configure ROIs
                        </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <img
                            src="http://localhost:5001/video_feed"
                            alt="Live Parking Feed"
                            style={{
                                width: '100%',
                                maxWidth: '640px',
                                border: '2px solid var(--primary)',
                                borderRadius: '8px'
                            }}
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='480' viewBox='0 0 640 480'%3E%3Crect width='640' height='480' fill='%23333'/%3E%3Ctext x='320' y='240' font-family='sans-serif' font-size='24' fill='%23888' text-anchor='middle' dominant-baseline='middle'%3ECamera Feed Offline%3C/text%3E%3C/svg%3E";
                            }}
                        />
                    </div>
                </div>
            )}

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                <Legend color="var(--slot-free)" label="Available" />
                <Legend color="var(--slot-occupied)" label="Occupied" />
                <Legend color="var(--slot-booked)" label="Booked (N/A Mall 2)" />
                <Legend color="var(--slot-my-booking)" label="My Booking" />
            </div>

            {/* ROI Configuration Modal */}
            {showRoiConfig && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.95)', zIndex: 1000,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem'
                }}>
                    <div style={{ width: '640px', background: '#222', padding: '20px', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ margin: 0 }}>Configure Regions of Interest</h2>
                            <button onClick={() => setShowRoiConfig(false)} style={{ background: '#ff4d4d', padding: '5px 15px' }}>Close</button>
                        </div>

                        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>
                            1. Select a slot below.<br />
                            2. Click and drag on the live feed to draw the detection box.<br />
                            3. Click Save when you have drawn all 4 boxes.
                        </p>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                            {['M2-L1-S1', 'M2-L1-S2', 'M2-L1-S3', 'M2-L1-S4'].map(sid => (
                                <button
                                    key={sid}
                                    onClick={() => setCurrentSlotConfig(sid)}
                                    style={{
                                        flex: 1,
                                        background: currentSlotConfig === sid ? 'var(--primary)' : '#444',
                                        border: rois[sid] ? '2px solid #4caf50' : '2px solid transparent'
                                    }}>
                                    {sid} {rois[sid] ? '✓' : ''}
                                </button>
                            ))}
                        </div>

                        <div style={{ position: 'relative', width: '640px', height: '480px', border: '1px solid #555', cursor: 'crosshair', userSelect: 'none' }}
                            onMouseDown={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setStartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                                setDrawing(true);
                            }}
                            onMouseMove={(e) => {
                                if (!drawing) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                const currentX = e.clientX - rect.left;
                                const currentY = e.clientY - rect.top;

                                const x = Math.min(startPos.x, currentX);
                                const y = Math.min(startPos.y, currentY);
                                const w = Math.abs(currentX - startPos.x);
                                const h = Math.abs(currentY - startPos.y);

                                setRois(prev => ({
                                    ...prev,
                                    [currentSlotConfig]: [Math.round(x), Math.round(y), Math.round(w), Math.round(h)]
                                }));
                            }}
                            onMouseUp={() => setDrawing(false)}
                            onMouseLeave={() => setDrawing(false)}
                        >
                            {/* Underlying Feed (snapshot or actual feed if we use MJPEG on canvas, but img is easier) */}
                            <img
                                src="http://localhost:5001/video_feed"
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.5, pointerEvents: 'none' }}
                                alt=""
                            />

                            {/* Render drawn boxes */}
                            {Object.entries(rois).map(([sid, coords]) => {
                                if (!coords || coords.length !== 4) return null;
                                const isCurrent = sid === currentSlotConfig;
                                return (
                                    <div key={sid} style={{
                                        position: 'absolute',
                                        left: coords[0], top: coords[1],
                                        width: coords[2], height: coords[3],
                                        border: `2px solid ${isCurrent ? '#fff' : '#4caf50'}`,
                                        backgroundColor: isCurrent ? 'rgba(255, 255, 255, 0.2)' : 'rgba(76, 175, 80, 0.2)',
                                        pointerEvents: 'none',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff',
                                        fontWeight: 'bold', textShadow: '0 0 4px #000'
                                    }}>
                                        {sid}
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => {
                                fetch('http://localhost:5001/config_rois', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(rois)
                                })
                                    .then(res => res.json())
                                    .then(() => {
                                        alert('ROIs Saved Successfully!');
                                        setShowRoiConfig(false);
                                    })
                                    .catch(err => alert('Failed to save ROIs: ' + err.message));
                            }}
                            style={{ width: '100%', marginTop: '1rem', background: '#4caf50', padding: '15px', fontSize: '1.1rem' }}>
                            💾 Save ROIs to Camera
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const Legend = ({ color, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '20px', height: '20px', background: color, borderRadius: '4px' }}></div>
        <span>{label}</span>
    </div>
);
