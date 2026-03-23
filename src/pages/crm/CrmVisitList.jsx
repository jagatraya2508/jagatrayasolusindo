import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, Save, MapPin, 
  Camera, CheckCircle, Clock 
} from 'lucide-react';

const CrmVisitList = () => {
    const getToken = () => localStorage.getItem('token');
    const [visits, setVisits] = useState([]);
    const [leads, setLeads] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [opportunities, setOpportunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
    const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
    const [currentVisit, setCurrentVisit] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [cameraStream, setCameraStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [location, setLocation] = useState(null);
    const [locationError, setLocationError] = useState('');
    const [previewImage, setPreviewImage] = useState(null);

    // Check-in form state
    const [formData, setFormData] = useState({
        lead_id: '',
        customer_id: '',
        subject: '',
        description: ''
    });

    useEffect(() => {
        fetchData();
        fetchRelatedData();
    }, []);

    // State for new filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);
            let url = '/api/crm/activities?activity_type=Visit';
            if (statusFilter) url += `&status=${statusFilter}`;
            if (searchTerm) url += `&search=${searchTerm}`;
            // Optional additional filters if API supports them
            if (startDate) url += `&start_date=${startDate}`;
            if (endDate) url += `&end_date=${endDate}`;
            if (customerFilter) url += `&customer_id=${customerFilter}`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const result = await response.json();
            if (result.success) {
                setVisits(result.data);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Gagal mengambil data kunjungan');
        } finally {
            setLoading(false);
        }
    };

    const fetchRelatedData = async () => {
        try {
            const [leadsRes, oppsRes, custsRes] = await Promise.all([
                fetch('/api/crm/leads', { headers: { 'Authorization': `Bearer ${getToken()}` } }),
                fetch('/api/crm/opportunities', { headers: { 'Authorization': `Bearer ${getToken()}` } }),
                fetch('/api/customers', { headers: { 'Authorization': `Bearer ${getToken()}` } })
            ]);

            const leadsData = await leadsRes.json();
            const oppsData = await oppsRes.json();
            const custsData = await custsRes.json();

            if (leadsData.success) setLeads(leadsData.data);
            if (oppsData.success) setOpportunities(oppsData.data);
            if (custsData.success) setCustomers(custsData.data);
        } catch (err) {
            console.error('Error fetching related data:', err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus kunjungan ini?')) return;
        try {
            const response = await fetch(`/api/crm/activities/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const result = await response.json();
            if (result.success) {
                fetchData();
            } else {
                alert(result.error);
            }
        } catch (err) {
            alert('Gagal menghapus kunjungan');
        }
    };

    // Camera and Location Logic
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            setCameraStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Tidak bisa mengakses kamera. Pastikan izin telah diberikan.");
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            context.drawImage(videoRef.current, 0, 0, 320, 240);
            const dataUrl = canvasRef.current.toDataURL('image/jpeg');
            setCapturedImage(dataUrl);
            stopCamera();
        }
    };

    const retakePhoto = () => {
        setCapturedImage(null);
        startCamera();
    };

    const getLocation = () => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
                setLocationError('');
            },
            () => {
                setLocationError('Unable to retrieve your location');
            }
        );
    };

    // Modal Handlers
    const openCheckIn = () => {
        setFormData({ lead_id: '', customer_id: '', subject: 'Kunjungan Rutin', description: '' });
        setCapturedImage(null);
        setLocation(null);
        setLocationError('');
        setIsCheckInModalOpen(true);
        startCamera();
        getLocation();
    };

    const closeCheckIn = () => {
        setIsCheckInModalOpen(false);
        stopCamera();
    };

    const openCheckOut = (visit) => {
        setCurrentVisit(visit);
        setCapturedImage(null);
        setLocation(null);
        setLocationError('');
        setIsCheckOutModalOpen(true);
        startCamera();
        getLocation();
    };

    const closeCheckOut = () => {
        setIsCheckOutModalOpen(false);
        setCurrentVisit(null);
        stopCamera();
    };

    const handleCheckInSubmit = async (e) => {
        e.preventDefault();
        if (!location || !capturedImage) {
            alert('Lokasi GPS dan Selfie wajib ada untuk check-in!');
            return;
        }
        try {
            const payload = {
                ...formData,
                check_in_lat: location.lat,
                check_in_lng: location.lng,
                selfie_base64: capturedImage
            };
            const response = await fetch('/api/crm/visits/check-in', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                closeCheckIn();
                fetchData();
            } else {
                alert(result.error);
            }
        } catch (err) {
            alert('Terjadi kesalahan saat check-in');
        }
    };

    const handleCheckOutSubmit = async (e) => {
        e.preventDefault();
        if (!location || !capturedImage) {
            alert('Lokasi GPS dan Selfie wajib ada untuk check-out!');
            return;
        }
        try {
            const payload = {
                check_out_lat: location.lat,
                check_out_lng: location.lng,
                selfie_base64: capturedImage
            };
            const response = await fetch(`/api/crm/visits/check-out/${currentVisit.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                closeCheckOut();
                fetchData();
            } else {
                alert(result.error);
            }
        } catch (err) {
            alert('Terjadi kesalahan saat check-out');
        }
    };

    // Calculate duration
    const calculateDuration = (checkIn, checkOut) => {
        if (!checkIn || !checkOut) return '0j 0m';
        const inDate = new Date(checkIn);
        const outDate = new Date(checkOut);
        const diff = outDate.getTime() - inDate.getTime();
        if (diff < 0) return '0j 0m';
        const totalMinutes = Math.floor(diff / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}j ${minutes}m`;
    };
    // Export to Excel (HTML table format - opens natively in Excel)
    const exportExcel = () => {
        const rows = visits.map((v, i) => {
            const name = v.customer_name || v.lead_name || '-';
            const type = v.customer_name ? 'Pelanggan' : (v.lead_name ? 'Lead' : '-');
            const checkIn = v.check_in_time ? new Date(v.check_in_time).toLocaleString('id-ID') : '-';
            const checkOut = v.check_out_time ? new Date(v.check_out_time).toLocaleString('id-ID') : '-';
            const dur = v.check_out_time ? calculateDuration(v.check_in_time, v.check_out_time) : '-';
            const status = v.status === 'Completed' ? 'Selesai' : 'Sedang Berjalan';
            return `<tr><td>${i + 1}</td><td>${name}</td><td>${type}</td><td>${v.creator_name || v.assigned_to || ''}</td><td>${checkIn}</td><td>${checkOut}</td><td>${dur}</td><td>${status}</td><td>${v.check_in_lat || ''}</td><td>${v.check_in_lng || ''}</td><td>${v.check_out_lat || ''}</td><td>${v.check_out_lng || ''}</td><td>${v.description || ''}</td></tr>`;
        }).join('');

        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>td,th{border:1px solid #ccc;padding:6px 10px;font-family:Arial;font-size:12px;white-space:nowrap}th{background:#1a56db;color:#fff;font-weight:bold}</style></head>
<body><h3>Laporan Kunjungan</h3><p>Tanggal: ${new Date().toLocaleDateString('id-ID')}</p>
<table><thead><tr><th>No</th><th>Nama</th><th>Tipe</th><th>Sales</th><th>Check-in</th><th>Check-out</th><th>Durasi</th><th>Status</th><th>Lat In</th><th>Lng In</th><th>Lat Out</th><th>Lng Out</th><th>Catatan</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Laporan_Kunjungan_${new Date().toISOString().slice(0, 10)}.xls`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Export to PDF (via print)
    const exportPDF = () => {
        const rows = visits.map((v, i) => {
            const name = v.customer_name || v.lead_name || '-';
            const type = v.customer_name ? 'Pelanggan' : (v.lead_name ? 'Lead' : '-');
            const checkIn = v.check_in_time ? new Date(v.check_in_time).toLocaleString('id-ID') : '-';
            const checkOut = v.check_out_time ? new Date(v.check_out_time).toLocaleString('id-ID') : '-';
            const dur = v.check_out_time ? calculateDuration(v.check_in_time, v.check_out_time) : '-';
            const status = v.status === 'Completed' ? 'Selesai' : 'Sedang Berjalan';
            return `<tr>
                <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${i + 1}</td>
                <td style="padding:6px 8px;border:1px solid #ddd">${name}<br><small style="color:#888">${type}</small></td>
                <td style="padding:6px 8px;border:1px solid #ddd">${v.creator_name || v.assigned_to || ''}</td>
                <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px">${checkIn}</td>
                <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px">${checkOut}</td>
                <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${dur}</td>
                <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${status}</td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html><html><head><title>Laporan Kunjungan</title>
        <style>body{font-family:Arial,sans-serif;padding:20px}h2{color:#1a56db;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1a56db;color:#fff;padding:8px;border:1px solid #1a56db;font-size:12px}td{font-size:12px}@media print{body{padding:10px}}</style>
        </head><body>
        <h2>Laporan Kunjungan</h2>
        <p style="color:#666;font-size:13px">${visits.length} kunjungan • Dicetak: ${new Date().toLocaleString('id-ID')}</p>
        <table><thead><tr><th>No</th><th>Nama / Tipe</th><th>Sales</th><th>Check-in</th><th>Check-out</th><th>Durasi</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table>
        </body></html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 500);
    };

    return (
        <div style={{ padding: '1.5rem' }}>
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1a56db' }}>Kunjungan</h1>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>{visits.length} kunjungan tercatat</p>
                </div>
                <button onClick={openCheckIn} className="btn btn-success" style={{ gap: '0.5rem' }}>
                    <CheckCircle size={16} />
                    Check-in Sekarang
                </button>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>Dari:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', background: '#fff' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>s/d:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', background: '#fff' }}
                        />
                    </div>
                    <select
                        value={customerFilter}
                        onChange={(e) => setCustomerFilter(e.target.value)}
                        style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', background: '#fff', minWidth: '200px' }}
                    >
                        <option value="">Semua Pelanggan</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setTimeout(fetchData, 100); }}
                        style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.875rem', background: '#fff', minWidth: '150px' }}
                    >
                        <option value="">Semua Status</option>
                        <option value="In Progress">Sedang Berjalan</option>
                        <option value="Completed">Selesai</option>
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={exportExcel} className="btn btn-outline" style={{ gap: '6px', fontSize: '0.875rem' }}>
                        <span style={{ fontWeight: 700 }}>X</span> Excel
                    </button>
                    <button onClick={exportPDF} className="btn btn-outline" style={{ gap: '6px', fontSize: '0.875rem' }}>
                        <span style={{ fontWeight: 700 }}>↓</span> PDF
                    </button>
                    <button className="btn btn-outline" style={{ gap: '6px', fontSize: '0.875rem' }}>
                        <MapPin size={16} /> Lihat Peta
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#c53030', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    {error}
                </div>
            )}

            {/* Visit Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {loading ? (
                    <div className="loading"><div className="loading-spinner"></div><p style={{ marginTop: '0.5rem', color: '#6b7280' }}>Memuat data...</p></div>
                ) : visits.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                        <MapPin size={48} color="#d1d5db" style={{ margin: '0 auto 0.5rem' }} />
                        <p style={{ color: '#6b7280' }}>Tidak ada data kunjungan ditemukan</p>
                    </div>
                ) : (
                    visits.map((visit) => {
                        const relatedName = visit.customer_name || visit.lead_name || '-';
                        const relatedType = visit.customer_name ? 'kontraktor' : (visit.lead_name ? 'lead' : '-');

                        return (
                            <div key={visit.id} className="card" style={{ borderLeft: '4px solid #d1d5db', padding: '1.25rem 1.5rem' }}>
                                {/* Top Row: Name + Actions */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: 0 }}>{relatedName}</h3>
                                        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '2px 0 0' }}>{relatedType}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {visit.status === 'Completed' ? (
                                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <CheckCircle size={12} /> Selesai
                                            </span>
                                        ) : (
                                            <button onClick={() => openCheckOut(visit)} className="btn btn-success" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                                                Check-Out
                                            </button>
                                        )}
                                        <button className="btn-icon" style={{ color: '#6b7280', background: '#f3f4f6', borderRadius: '6px' }}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(visit.id)} className="btn-icon" style={{ color: '#fff', background: '#dc2626', borderRadius: '6px' }} title="Hapus">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Info Row */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '0.75rem', color: '#6b7280', margin: '0.75rem 0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                        <span>{visit.creator_name || 'Wisnu Wardana'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} />
                                        <span>{visit.check_in_time ? new Date(visit.check_in_time).toLocaleString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}</span>
                                    </div>
                                    {visit.check_out_time && (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span>[→</span>
                                                <span>{new Date(visit.check_out_time).toLocaleString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                            </div>
                                            <span style={{ fontWeight: 600, color: '#1a56db' }}>{calculateDuration(visit.check_in_time, visit.check_out_time)}</span>
                                        </>
                                    )}
                                </div>

                                {/* Coordinates */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem' }}>
                                    {visit.check_in_lat && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                                            <MapPin size={12} /> Check-in: {visit.check_in_lat}, {visit.check_in_lng}
                                        </span>
                                    )}
                                    {visit.check_out_lat && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                                            <MapPin size={12} /> Check-out: {visit.check_out_lat}, {visit.check_out_lng}
                                        </span>
                                    )}
                                    {(visit.check_in_lat || visit.check_out_lat) && (
                                        <a href={`https://maps.google.com/?q=${visit.check_in_lat || visit.check_out_lat},${visit.check_in_lng || visit.check_out_lng}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#1a56db', fontSize: '0.75rem', textDecoration: 'none' }}>
                                            <MapPin size={12} /> Lihat Peta
                                        </a>
                                    )}
                                </div>

                                {/* Selfies */}
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {visit.selfie_in && (
                                        <div>
                                            <p style={{ fontSize: '0.625rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Selfie In</p>
                                            <div onClick={() => setPreviewImage(visit.selfie_in)} style={{ width: 64, height: 64, borderRadius: '6px', border: '1px solid #e5e7eb', overflow: 'hidden', cursor: 'pointer' }} title="Klik untuk memperbesar">
                                                <img src={visit.selfie_in} alt="Selfie In" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                        </div>
                                    )}
                                    {visit.selfie_out && (
                                        <div>
                                            <p style={{ fontSize: '0.625rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Selfie Out</p>
                                            <div onClick={() => setPreviewImage(visit.selfie_out)} style={{ width: 64, height: 64, borderRadius: '6px', border: '1px solid #e5e7eb', overflow: 'hidden', cursor: 'pointer' }} title="Klik untuk memperbesar">
                                                <img src={visit.selfie_out} alt="Selfie Out" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Photo Preview Modal */}
            {previewImage && (
                <div className="modal-overlay" onClick={() => setPreviewImage(null)} style={{ cursor: 'zoom-out' }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setPreviewImage(null)} className="modal-close" style={{ position: 'absolute', top: -16, right: -16, zIndex: 10 }}>&times;</button>
                        <img src={previewImage} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '12px', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', objectFit: 'contain', background: '#fff' }} />
                    </div>
                </div>
            )}

            {/* Check-In Modal */}
            {isCheckInModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <MapPin size={20} color="#1a56db" /> Check-in Kunjungan
                            </h3>
                            <button onClick={closeCheckIn} className="modal-close">&times;</button>
                        </div>
                        <form id="checkInForm" onSubmit={handleCheckInSubmit} style={{ padding: '1.5rem' }}>
                            <div className="form-group">
                                <label>Pilih Lead (Opsional)</label>
                                <select value={formData.lead_id} onChange={(e) => setFormData({...formData, lead_id: e.target.value})}>
                                    <option value="">- Pilih Lead -</option>
                                    {leads.map(l => <option key={l.id} value={l.id}>{l.company_name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Atau Pilih Pelanggan</label>
                                <select value={formData.customer_id} onChange={(e) => setFormData({...formData, customer_id: e.target.value})}>
                                    <option value="">- Pilih Pelanggan -</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Catatan Kunjungan</label>
                                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows="2"></textarea>
                            </div>

                            <div style={{ padding: '1rem', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff', marginTop: '1rem' }}>
                                <h4 style={{ fontWeight: 600, color: '#1e40af', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Camera size={16} /> Ambil Selfie Bukti</h4>
                                {!capturedImage ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', width: 320, height: 240, marginBottom: '0.75rem' }}>
                                            <video ref={videoRef} autoPlay playsInline width="320" height="240" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <button type="button" onClick={capturePhoto} className="btn btn-primary"><Camera size={16} /> Jepret Selfie</button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ borderRadius: '8px', overflow: 'hidden', width: 320, height: 240, marginBottom: '0.75rem', border: '1px solid #d1d5db' }}>
                                            <img src={capturedImage} alt="Captured Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <button type="button" onClick={retakePhoto} className="btn btn-outline">Ulangi Foto</button>
                                    </div>
                                )}
                                <canvas ref={canvasRef} width="320" height="240" style={{ display: 'none' }} />
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #93c5fd', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                                    <MapPin size={16} color="#059669" />
                                    {location ? (
                                        <span style={{ color: '#047857', fontFamily: 'monospace', fontSize: '0.75rem' }}>Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}</span>
                                    ) : locationError ? (
                                        <span style={{ color: '#dc2626' }}>{locationError}</span>
                                    ) : (
                                        <span style={{ color: '#6b7280' }}>Mendeteksi lokasi...</span>
                                    )}
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="button" onClick={closeCheckIn} className="btn btn-outline">Batal</button>
                                <button type="submit" disabled={!location || !capturedImage} className="btn btn-primary" style={{ opacity: (!location || !capturedImage) ? 0.5 : 1 }}>
                                    <CheckCircle size={18} /> Check-In Sekarang
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Check-Out Modal */}
            {isCheckOutModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={20} color="#059669" /> Check-out Kunjungan
                            </h3>
                            <button onClick={closeCheckOut} className="modal-close">&times;</button>
                        </div>
                        <form id="checkOutForm" onSubmit={handleCheckOutSubmit} style={{ padding: '1.5rem' }}>
                            <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.875rem', marginBottom: '1rem' }}>
                                <p><strong>Subjek:</strong> {currentVisit?.subject}</p>
                                <p><strong>Waktu Check-in:</strong> {new Date(currentVisit?.check_in_time).toLocaleString('id-ID')}</p>
                            </div>
                            <div style={{ padding: '1rem', border: '1px solid #bbf7d0', borderRadius: '8px', background: '#f0fdf4' }}>
                                <h4 style={{ fontWeight: 600, color: '#166534', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Camera size={16} /> Ambil Selfie Pulang (Check-out)</h4>
                                {!capturedImage ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', width: 320, height: 240, marginBottom: '0.75rem' }}>
                                            <video ref={videoRef} autoPlay playsInline width="320" height="240" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <button type="button" onClick={capturePhoto} className="btn btn-success"><Camera size={16} /> Jepret Selfie</button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ borderRadius: '8px', overflow: 'hidden', width: 320, height: 240, marginBottom: '0.75rem', border: '1px solid #d1d5db' }}>
                                            <img src={capturedImage} alt="Captured Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <button type="button" onClick={retakePhoto} className="btn btn-outline">Ulangi Foto</button>
                                    </div>
                                )}
                                <canvas ref={canvasRef} width="320" height="240" style={{ display: 'none' }} />
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                                    <MapPin size={16} color="#059669" />
                                    {location ? (
                                        <span style={{ color: '#047857', fontFamily: 'monospace', fontSize: '0.75rem' }}>Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}</span>
                                    ) : locationError ? (
                                        <span style={{ color: '#dc2626' }}>{locationError}</span>
                                    ) : (
                                        <span style={{ color: '#6b7280' }}>Mendeteksi lokasi...</span>
                                    )}
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="button" onClick={closeCheckOut} className="btn btn-outline">Batal</button>
                                <button type="submit" disabled={!location || !capturedImage} className="btn btn-success" style={{ opacity: (!location || !capturedImage) ? 0.5 : 1 }}>
                                    <CheckCircle size={18} /> Selesai Check-Out
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CrmVisitList;
