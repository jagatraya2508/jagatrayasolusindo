import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, MapPin, Map as MapIcon, RefreshCw, X } from 'lucide-react';

function LiveTracking() {
    const { token } = useAuth();
    const [salesUsers, setSalesUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);

    const L = window.L;

    const fetchTrackingData = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/users/tracking', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setSalesUsers(data.data);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrackingData();
        // Refresh API every 30 seconds
        const interval = setInterval(fetchTrackingData, 30000);
        return () => clearInterval(interval);
    }, [token]);

    const filteredUsers = salesUsers.filter(user => 
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.includes(searchTerm)
    );

    const initMap = (node) => {
        if (!node || !L) return;
        
        // Cek map instance sebelumnya untuk di-cleanup
        if (node._leaflet_id) {
            node._leaflet_id = null;
            node.innerHTML = "";
        }

        const map = L.map(node).setView([-2.5489, 118.0149], 5); // Default center Indonesia

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const markers = [];
        let mapBounds = L.latLngBounds();

        if (selectedUser && selectedUser.last_lat && selectedUser.last_lng) {
            const lat = parseFloat(selectedUser.last_lat);
            const lng = parseFloat(selectedUser.last_lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                map.setView([lat, lng], 15);
                const marker = L.marker([lat, lng]).addTo(map);
                marker.bindPopup(`<b>${selectedUser.full_name}</b><br>${selectedUser.phone || '-'}<br>Last Update: ${new Date(selectedUser.last_location_time).toLocaleString('id-ID')}`).openPopup();
            }
        } else {
            salesUsers.forEach(user => {
                const lat = parseFloat(user.last_lat);
                const lng = parseFloat(user.last_lng);

                if (!isNaN(lat) && !isNaN(lng)) {
                    const marker = L.marker([lat, lng]).addTo(map);
                    marker.bindPopup(`<b>${user.full_name}</b><br>${user.phone || '-'}<br>Last Update: ${new Date(user.last_location_time).toLocaleString('id-ID')}`);
                    markers.push(marker);
                    mapBounds.extend([lat, lng]);
                }
            });

            if (markers.length > 0) {
                map.fitBounds(mapBounds, { padding: [50, 50] });
            }
        }
    };

    return (
        <div className="page-container" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MapIcon size={24} color="#3b82f6" />
                        Live Tracking Sales
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.25rem' }}>Pantau lokasi GPS real-time dari tim sales di lapangan.</p>
                </div>
                <button 
                    onClick={fetchTrackingData}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <RefreshCw size={16} className={loading ? "spin" : ""} />
                    Refresh
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>
                {/* Sidebar List */}
                <div style={{ background: '#1f2937', borderRadius: '12px', border: '1px solid #374151', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid #374151' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input 
                                type="text"
                                placeholder="Cari by nama atau telp..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 2.5rem', background: '#374151', border: '1px solid #4b5563', borderRadius: '6px', color: 'white' }}
                            />
                        </div>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
                        {selectedUser && (
                            <div style={{ padding: '0.75rem', marginBottom: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#60a5fa', fontSize: '0.875rem' }}>Menampilkan <b>{selectedUser.full_name}</b></span>
                                <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><X size={16} /></button>
                            </div>
                        )}
                        {loading && salesUsers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Memuat data...</div>
                        ) : error ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>Error: {error}</div>
                        ) : filteredUsers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Tidak ada data sales yang terlacak.</div>
                        ) : (
                            filteredUsers.map(user => (
                                <div 
                                    key={user.id} 
                                    onClick={() => setSelectedUser(user)}
                                    style={{ padding: '0.875rem', background: selectedUser?.id === user.id ? '#374151' : 'transparent', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid #2d3748', display: 'flex', gap: '0.75rem' }}
                                >
                                    <div style={{ background: '#3b82f6', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                                        {user.full_name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: 'white', fontWeight: 500, fontSize: '0.9rem' }}>{user.full_name}</div>
                                        <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '2px' }}>{user.phone || '-'}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', color: '#60a5fa', fontSize: '0.75rem' }}>
                                            <MapPin size={12} />
                                            {new Date(user.last_location_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Map View */}
                <div style={{ background: '#1f2937', borderRadius: '12px', border: '1px solid #374151', overflow: 'hidden', position: 'relative' }}>
                    {!L && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#9ca3af' }}>
                            Leaflet Map Library is not loaded.
                        </div>
                    )}
                    <div ref={initMap} style={{ width: '100%', height: '100%', minHeight: '500px', backgroundColor: '#e5e7eb' }}></div>
                </div>
            </div>
        </div>
    );
}

export default LiveTracking;
