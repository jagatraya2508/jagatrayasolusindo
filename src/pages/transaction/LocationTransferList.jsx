import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

function LocationTransferList() {
    const { token } = useAuth();
    const [canApprove, setCanApprove] = useState(false);
    const [view, setView] = useState('list'); // 'list', 'create', 'detail'
    const [transfers, setTransfers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        doc_date: new Date().toISOString().split('T')[0],
        source_location_id: '',
        destination_location_id: '',
        notes: '',
        items: []
    });

    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchTransfers();
        fetchLocations();
        fetchItems();
        checkApprovalPermission();
    }, []);

    const checkApprovalPermission = async () => {
        try {
            const res = await fetch('/api/approval-check/location-transfer', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setCanApprove(data.allowed === true);
        } catch { setCanApprove(false); }
    };

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/location-transfers');
            const data = await res.json();
            if (data.success) {
                setTransfers(data.data);
            }
        } catch (error) {
            console.error('Error fetching transfers:', error);
        }
        setLoading(false);
    };

    const fetchLocations = async () => {
        try {
            const res = await fetch('/api/locations');
            const data = await res.json();
            if (data.success) {
                setLocations(data.data);
            }
        } catch (error) {
            console.error('Error fetching locations:', error);
        }
    };

    const fetchItems = async () => {
        try {
            const res = await fetch('/api/items');
            const data = await res.json();
            if (data.success) {
                setItems(data.data);
            }
        } catch (error) {
            console.error('Error fetching items:', error);
        }
    };

    const handleEdit = async (id) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/location-transfers/${id}`);
            const data = await res.json();
            if (data.success) {
                const transfer = data.data;
                setFormData({
                    doc_date: new Date(transfer.doc_date).toISOString().split('T')[0],
                    source_location_id: transfer.source_location_id,
                    destination_location_id: transfer.destination_location_id,
                    notes: transfer.notes || '',
                    items: transfer.items.map(i => ({
                        item_id: i.item_id,
                        quantity: i.quantity,
                        notes: i.notes || ''
                    }))
                });
                setEditingId(id);
                setView('create');
            } else {
                alert('Gagal mengambil data: ' + data.error);
            }
        } catch (error) {
            console.error('Error fetching details:', error);
            alert('Gagal mengambil data transfer');
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!formData.source_location_id || !formData.destination_location_id || formData.items.length === 0) {
            alert('Please fill all required fields and add at least one item');
            return;
        }

        if (formData.source_location_id === formData.destination_location_id) {
            alert('Source and Destination locations must be different');
            return;
        }

        try {
            const url = editingId ? `/api/location-transfers/${editingId}` : '/api/location-transfers';
            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                alert(editingId ? 'Transfer updated successfully' : 'Transfer created successfully');
                setView('list');
                fetchTransfers();
                resetForm();
            } else {
                alert('Error processing transfer: ' + data.error);
            }
        } catch (error) {
            console.error('Error saving transfer:', error);
        }
    };

    const handleApprove = async (id) => {
        if (!confirm('Are you sure you want to approve this transfer?')) return;
        try {
            const res = await fetch(`/api/location-transfers/${id}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || 'Transfer approved successfully');
                fetchTransfers();
            } else {
                alert('Error approving transfer: ' + (data.reason || data.error));
            }
        } catch (error) {
            console.error('Error approving transfer:', error);
        }
    };

    const handlePost = async (id) => {
        if (!confirm('Are you sure you want to post this transfer? Stock will be updated.')) return;
        try {
            const res = await fetch(`/api/location-transfers/${id}/post`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                alert('Transfer posted successfully');
                fetchTransfers();
            } else {
                alert('Error posting transfer: ' + (data.reason || data.error));
            }
        } catch (error) {
            console.error('Error posting transfer:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this draft?')) return;
        try {
            const res = await fetch(`/api/location-transfers/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                fetchTransfers();
            } else {
                alert('Error deleting transfer: ' + data.error);
            }
        } catch (error) {
            console.error('Error deleting transfer:', error);
        }
    };

    const handleUnpost = async (id) => {
        if (!confirm('Are you sure you want to UNPOST/CANCEL this transfer? Stock will be updated (Reverted).')) return;
        try {
            const res = await fetch(`/api/location-transfers/${id}/unpost`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                alert('Transfer unposted successfully (Status: Approved)');
                fetchTransfers();
            } else {
                alert('Error unposting transfer: ' + data.error);
            }
        } catch (error) {
            console.error('Error unposting transfer:', error);
            alert('Failed to unpost transfer');
        }
    };

    const handleUnapprove = async (id) => {
        if (!confirm('Are you sure you want to unapprove this transfer?')) return;
        try {
            const res = await fetch(`/api/location-transfers/${id}/unapprove`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || 'Transfer unapproved successfully');
                fetchTransfers();
            } else {
                alert('Error unapproving transfer: ' + data.error);
            }
        } catch (error) {
            console.error('Error unapproving transfer:', error);
            alert('Failed to unapprove transfer');
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData({
            doc_date: new Date().toISOString().split('T')[0],
            source_location_id: '',
            destination_location_id: '',
            notes: '',
            items: []
        });
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { item_id: '', quantity: 1, notes: '' }]
        });
    };

    const updateItem = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        setFormData({ ...formData, items: newItems });
    };

    const removeItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    // ==================== STYLES ====================
    const styles = {
        container: {
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
            margin: '20px',
        },
        header: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '24px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        headerTitle: {
            color: '#ffffff',
            fontSize: '1.5rem',
            fontWeight: '600',
            margin: 0,
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
        },
        body: {
            padding: '32px',
        },
        table: {
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: '0 12px',
        },
        tableHeader: {
            background: 'transparent',
        },
        th: {
            padding: '16px 20px',
            textAlign: 'left',
            fontWeight: '600',
            color: '#64748b',
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            borderBottom: 'none',
        },
        tr: {
            background: '#ffffff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            borderRadius: '12px',
            transition: 'all 0.2s ease',
        },
        td: {
            padding: '20px 20px',
            borderBottom: 'none',
            fontSize: '0.95rem',
            color: '#334155',
        },
        tdFirst: {
            borderTopLeftRadius: '12px',
            borderBottomLeftRadius: '12px',
        },
        tdLast: {
            borderTopRightRadius: '12px',
            borderBottomRightRadius: '12px',
        },
        badge: {
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: '600',
            display: 'inline-block',
        },
        badgeDraft: {
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            color: '#ffffff',
        },
        badgePosted: {
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            color: '#ffffff',
        },
        btnPrimary: {
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: '#ffffff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '10px',
            fontWeight: '600',
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.2s ease',
        },
        btnSuccess: {
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
            marginRight: '10px',
            transition: 'all 0.2s ease',
        },
        btnDanger: {
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
            transition: 'all 0.2s ease',
        },
        btnSecondary: {
            background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
            color: '#ffffff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '10px',
            fontWeight: '600',
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(100, 116, 139, 0.3)',
            transition: 'all 0.2s ease',
        },
        formGroup: {
            marginBottom: '24px',
        },
        formLabel: {
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            color: '#334155',
            fontSize: '0.95rem',
        },
        formInput: {
            width: '100%',
            padding: '14px 16px',
            borderRadius: '10px',
            border: '2px solid #e2e8f0',
            fontSize: '1rem',
            transition: 'all 0.2s ease',
            background: '#ffffff',
            boxSizing: 'border-box',
        },
        formRow: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
            marginBottom: '24px',
        },
        sectionTitle: {
            fontSize: '1.1rem',
            fontWeight: '600',
            color: '#334155',
            marginBottom: '20px',
            paddingBottom: '12px',
            borderBottom: '2px solid #e2e8f0',
        },
        emptyState: {
            textAlign: 'center',
            padding: '60px 20px',
            color: '#94a3b8',
        },
        emptyIcon: {
            fontSize: '4rem',
            marginBottom: '16px',
        },
        locationInfo: {
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
        },
        locationCode: {
            fontWeight: '600',
            color: '#1e293b',
        },
        locationWarehouse: {
            fontSize: '0.85rem',
            color: '#64748b',
        },
        docNumber: {
            fontWeight: '600',
            color: '#3b82f6',
        },
        actionCell: {
            display: 'flex',
            gap: '8px',
        },
    };

    if (view === 'create') {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <h2 style={styles.headerTitle}>{editingId ? '✏️ Edit Pindah Gudang' : '📦 Buat Pindah Gudang Baru'}</h2>
                    <button style={styles.btnSecondary} onClick={() => { setView('list'); resetForm(); }}>
                        ← Kembali
                    </button>
                </div>
                <div style={styles.body}>
                    <div style={styles.formRow}>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>📅 Tanggal Dokumen</label>
                            <input
                                type="date"
                                value={formData.doc_date}
                                onChange={(e) => setFormData({ ...formData, doc_date: e.target.value })}
                                style={styles.formInput}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>📍 Dari Lokasi (Asal)</label>
                            <select
                                value={formData.source_location_id}
                                onChange={(e) => setFormData({ ...formData, source_location_id: e.target.value })}
                                style={styles.formInput}
                            >
                                <option value="">-- Pilih Lokasi Asal --</option>
                                {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.code} - {l.name} ({l.warehouse_name || 'N/A'})</option>
                                ))}
                            </select>
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>🎯 Ke Lokasi (Tujuan)</label>
                            <select
                                value={formData.destination_location_id}
                                onChange={(e) => setFormData({ ...formData, destination_location_id: e.target.value })}
                                style={styles.formInput}
                            >
                                <option value="">-- Pilih Lokasi Tujuan --</option>
                                {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.code} - {l.name} ({l.warehouse_name || 'N/A'})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.formLabel}>📝 Catatan</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            style={{ ...styles.formInput, minHeight: '80px', resize: 'vertical' }}
                            placeholder="Masukkan catatan transfer (opsional)"
                        />
                    </div>

                    <h3 style={styles.sectionTitle}>📋 Detail Item Transfer</h3>
                    <table style={{ ...styles.table, borderSpacing: '0 8px' }}>
                        <thead>
                            <tr>
                                <th style={{ ...styles.th, width: '40%' }}>Item</th>
                                <th style={{ ...styles.th, width: '15%' }}>Quantity</th>
                                <th style={styles.th}>Notes</th>
                                <th style={{ ...styles.th, width: '80px', textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.items.map((item, index) => (
                                <tr key={index} style={styles.tr}>
                                    <td style={{ ...styles.td, ...styles.tdFirst }}>
                                        <select
                                            value={item.item_id}
                                            onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                                            style={{ ...styles.formInput, padding: '12px 14px' }}
                                        >
                                            <option value="">-- Pilih Item --</option>
                                            {items.map(i => (
                                                <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td style={styles.td}>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                                            style={{ ...styles.formInput, padding: '12px 14px', textAlign: 'center' }}
                                            min="1"
                                        />
                                    </td>
                                    <td style={styles.td}>
                                        <input
                                            type="text"
                                            value={item.notes}
                                            onChange={(e) => updateItem(index, 'notes', e.target.value)}
                                            style={{ ...styles.formInput, padding: '12px 14px' }}
                                            placeholder="Catatan item..."
                                        />
                                    </td>
                                    <td style={{ ...styles.td, ...styles.tdLast, textAlign: 'center' }}>
                                        <button
                                            onClick={() => removeItem(index)}
                                            style={{ ...styles.btnDanger, padding: '8px 12px' }}
                                        >
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {formData.items.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ ...styles.emptyState, padding: '40px' }}>
                                        <div>📦</div>
                                        <div>Belum ada item. Klik tombol "Tambah Item" untuk menambahkan.</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <button
                        onClick={addItem}
                        style={{ ...styles.btnSecondary, marginTop: '16px' }}
                    >
                        + Tambah Item
                    </button>

                    <div style={{ marginTop: '32px', textAlign: 'right', borderTop: '2px solid #e2e8f0', paddingTop: '24px' }}>
                        <button style={styles.btnPrimary} onClick={handleSave}>
                            {editingId ? '💾 Simpan Perubahan' : '💾 Simpan Draft'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.headerTitle}>📦 Daftar Pindah Gudang</h2>
                <button style={styles.btnPrimary} onClick={() => { resetForm(); setView('create'); }}>
                    + Buat Transfer Baru
                </button>
            </div>
            <div style={styles.body}>
                {loading ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>⏳</div>
                        <div>Memuat data...</div>
                    </div>
                ) : transfers.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>📭</div>
                        <div style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Belum ada data transfer</div>
                        <div style={{ fontSize: '0.9rem' }}>Klik tombol "Buat Transfer Baru" untuk membuat transfer pertama</div>
                    </div>
                ) : (
                    <table style={styles.table}>
                        <thead style={styles.tableHeader}>
                            <tr>
                                <th style={styles.th}>No. Dokumen</th>
                                <th style={styles.th}>Tanggal</th>
                                <th style={styles.th}>Dari Lokasi</th>
                                <th style={styles.th}>Ke Lokasi</th>
                                <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                                <th style={{ ...styles.th, textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transfers.map(t => (
                                <tr
                                    key={t.id}
                                    style={styles.tr}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <td style={{ ...styles.td, ...styles.tdFirst }}>
                                        <span style={styles.docNumber}>{t.doc_number}</span>
                                    </td>
                                    <td style={styles.td}>
                                        {new Date(t.doc_date).toLocaleDateString('id-ID', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </td>
                                    <td style={styles.td}>
                                        <div style={styles.locationInfo}>
                                            <span style={styles.locationCode}>{t.source_location_code}</span>
                                            <span style={styles.locationWarehouse}>{t.source_warehouse_name}</span>
                                        </div>
                                    </td>
                                    <td style={styles.td}>
                                        <div style={styles.locationInfo}>
                                            <span style={styles.locationCode}>{t.destination_location_code}</span>
                                            <span style={styles.locationWarehouse}>{t.destination_warehouse_name}</span>
                                        </div>
                                    </td>
                                    <td style={{ ...styles.td, textAlign: 'center' }}>
                                        <span style={{
                                            ...styles.badge,
                                            ...(t.status === 'Posted' ? styles.badgePosted : t.status === 'Approved' ? { background: '#10b981', color: 'white' } : t.status === 'Draft' ? styles.badgeDraft : { background: '#3b82f6', color: 'white' })
                                        }}>
                                            {t.status === 'Posted' ? '✓ Posted' : t.status === 'Approved' ? '✅ Approved' : t.status === 'Draft' ? '⏳ Draft' : `⏳ ${t.status}`}
                                        </span>
                                    </td>
                                    <td style={{ ...styles.td, ...styles.tdLast, textAlign: 'center' }}>
                                        {t.status === 'Draft' || t.status.startsWith('Pending') ? (
                                            <div style={styles.actionCell}>
                                                {t.status === 'Draft' && (
                                                    <button
                                                        style={{ ...styles.btnPrimary, backgroundColor: '#f59e0b', backgroundImage: 'none', padding: '8px 16px' }}
                                                        onClick={() => handleEdit(t.id)}
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                )}
                                                {canApprove && (
                                                    <button
                                                        style={styles.btnSuccess}
                                                        onClick={() => handleApprove(t.id)}
                                                    >
                                                        ✓ Approve
                                                    </button>
                                                )}
                                                {t.status === 'Draft' && (
                                                    <button
                                                        style={styles.btnDanger}
                                                        onClick={() => handleDelete(t.id)}
                                                    >
                                                        ✕ Delete
                                                    </button>
                                                )}
                                                {t.status.startsWith('Pending') && (
                                                    <button
                                                        style={{ ...styles.btnSecondary, backgroundColor: '#f97316', padding: '8px 16px', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                        onClick={() => handleUnapprove(t.id)}
                                                    >
                                                        ↩ Unapprove
                                                    </button>
                                                )}
                                            </div>
                                        ) : t.status === 'Approved' ? (
                                            <div style={styles.actionCell}>
                                                {canApprove && (
                                                    <button
                                                        style={{ ...styles.btnPrimary, backgroundColor: '#8b5cf6', backgroundImage: 'none', padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                                        onClick={() => handlePost(t.id)}
                                                    >
                                                        📤 Post
                                                    </button>
                                                )}
                                                <button
                                                    style={{ ...styles.btnSecondary, backgroundColor: '#f97316', padding: '8px 16px', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                                    onClick={() => handleUnapprove(t.id)}
                                                >
                                                    ↩ Unapprove
                                                </button>
                                            </div>
                                        ) : t.status === 'Posted' ? (
                                            <div style={styles.actionCell}>
                                                <button
                                                    style={{ ...styles.btnSecondary, backgroundColor: '#475569', padding: '8px 16px', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                                                    onClick={() => handleUnpost(t.id)}
                                                >
                                                    ↩ Unpost
                                                </button>
                                            </div>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default LocationTransferList;


