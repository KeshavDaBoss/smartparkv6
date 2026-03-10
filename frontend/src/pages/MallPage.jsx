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
                <h1>{mallName}</h1>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* Admin: Configure ROIs button */}
                    {mallId === 'mall2' && level === 1 && user?.username === 'user4' && (
                        <button
                            onClick={() => {
                                fetch('http://localhost:5001/get_rois')
                                    .then(res => res.json())
                                    .then(data => {
                                        if (data.rois) {
                                            const updatedRois = {};
                                            for (let key in data.rois) {
                                                let val = data.rois[key];
                                                if (val && typeof val[0] === 'number') {
                                                    updatedRois[key] = [
                                                        [val[0], val[1]],
                                                        [val[0] + val[2], val[1]],
                                                        [val[0] + val[2], val[1] + val[3]],
                                                        [val[0], val[1] + val[3]]
                                                    ];
                                                } else {
                                                    updatedRois[key] = val;
                                                }
                                            }
                                            setRois(updatedRois);
                                        }
                                        setShowRoiConfig(true);
                                    })
                                    .catch(err => {
                                        console.error(err);
                                        setShowRoiConfig(true);
                                    });
                            }}
                            style={{ background: 'var(--primary)', padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <img src="/settings_icon.png" alt="settings" style={{ width: '20px', height: '20px' }} /> Configure ROIs
                        </button>
                    )}

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


            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                <Legend color="var(--slot-free)" label="Available" />
                <Legend color="var(--slot-occupied)" label="Occupied" />
                <Legend color="var(--slot-booked)" label="Booked" />
                <Legend color="var(--slot-my-booking)" label="My Booking" />
            </div>

            {/* ROI Configuration Modal */}
            {showRoiConfig && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.95)', zIndex: 1000,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    paddingTop: '2rem', paddingBottom: '2rem', overflowY: 'auto'
                }}>
                    <div style={{ width: '640px', background: '#222', padding: '20px', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ margin: 0 }}>Configure Regions of Interest</h2>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button onClick={() => setRois(prev => ({ ...prev, [currentSlotConfig]: [] }))} style={{ background: '#ff9800', padding: '8px 15px', height: '37px', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>Clear Slot</button>
                                <button onClick={() => setShowRoiConfig(false)} style={{ background: '#ff4d4d', padding: '8px 15px' }}>Cancel</button>
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
                                    style={{ background: '#4caf50', padding: '8px 15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <img src="/save_icon.png" alt="save" style={{ width: '20px', height: '20px' }} /> Save
                                </button>
                            </div>
                        </div>

                        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>
                            1. Select a slot below.<br />
                            2. <strong>Click and drag</strong> on the live feed to <strong>paint</strong> over the slot.<br />
                            3. Use "Clear Slot" if you make a mistake, then click <strong>Save</strong> when done.
                        </p>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                            {['M2-L1-S1', 'M2-L1-S2', 'M2-L1-S3', 'M2-L1-S4'].map(sid => (
                                <button
                                    key={sid}
                                    onClick={() => setCurrentSlotConfig(sid)}
                                    style={{
                                        flex: 1,
                                        background: currentSlotConfig === sid ? 'var(--primary)' : '#444',
                                        border: rois[sid] && rois[sid].length > 0 ? '2px solid #4caf50' : '2px solid transparent'
                                    }}>
                                    {sid} {rois[sid] && rois[sid].length > 0 ? '✓' : ''}
                                </button>
                            ))}
                        </div>

                        <div style={{ position: 'relative', width: '640px', height: '480px', border: '1px solid #555', cursor: 'crosshair', userSelect: 'none' }}
                            onMouseDown={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = Math.round(e.clientX - rect.left);
                                const y = Math.round(e.clientY - rect.top);
                                setDrawing(true);
                                setRois(prev => ({
                                    ...prev,
                                    [currentSlotConfig]: [[x, y]]
                                }));
                            }}
                            onMouseMove={(e) => {
                                if (!drawing) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = Math.round(e.clientX - rect.left);
                                const y = Math.round(e.clientY - rect.top);
                                setRois(prev => {
                                    const currentPoints = prev[currentSlotConfig] || [];
                                    const last = currentPoints[currentPoints.length - 1];
                                    if (last && Math.abs(x - last[0]) < 2 && Math.abs(y - last[1]) < 2) return prev;
                                    return {
                                        ...prev,
                                        [currentSlotConfig]: [...currentPoints, [x, y]]
                                    };
                                });
                            }}
                            onMouseUp={() => setDrawing(false)}
                            onMouseLeave={() => setDrawing(false)}
                        >
                            <img
                                src="http://localhost:5001/video_feed"
                                draggable="false"
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.5, pointerEvents: 'none' }}
                                alt=""
                            />

                            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                                {Object.entries(rois).map(([sid, pts]) => {
                                    if (!pts || pts.length < 2) return null;
                                    const isCurrent = sid === currentSlotConfig;
                                    const pointsStr = pts.map(p => `${p[0]},${p[1]}`).join(' ');
                                    return (
                                        <g key={sid}>
                                            <polyline
                                                points={pointsStr}
                                                fill="none"
                                                stroke={isCurrent ? 'rgba(255, 255, 255, 0.5)' : 'rgba(76, 175, 80, 0.5)'}
                                                strokeWidth="40"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                            <text x={pts[0][0]} y={pts[0][1] - 30} fill="#fff" fontSize="16" fontWeight="bold" textAnchor="middle" style={{ textShadow: '0 0 4px #000' }}>
                                                {sid}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
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
