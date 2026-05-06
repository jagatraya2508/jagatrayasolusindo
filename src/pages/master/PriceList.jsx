import { useState, useEffect } from 'react';

function PriceList() {
    const [priceLists, setPriceLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [paymentTerms, setPaymentTerms] = useState([]);
    const [items, setItems] = useState([]);
    const [units, setUnits] = useState([]);
    
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        currency_code: 'IDR',
        payment_term_id: '',
        valid_from: '',
        valid_to: '',
        active: 'Y',
        remarks: '',
        details: []
    });

    useEffect(() => {
        fetchPriceLists();
        fetchPaymentTerms();
        fetchItems();
        fetchUnits();
    }, []);

    const getToken = () => localStorage.getItem('token');
    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };

    const fetchPriceLists = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/price-lists', { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const data = await res.json();
            if (data.success) {
                setPriceLists(data.data);
            }
        } catch (e) {
            console.error('Error fetching price lists:', e);
        }
        setLoading(false);
    };

    const fetchPaymentTerms = async () => {
        try {
            const res = await fetch('/api/payment-terms', { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const data = await res.json();
            if (data.success) {
                setPaymentTerms(data.data);
            }
        } catch (e) { console.error('Error:', e); }
    };

    const fetchItems = async () => {
        try {
            const res = await fetch('/api/items', { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const data = await res.json();
            if (data.success) {
                setItems(data.data);
            }
        } catch (e) { console.error('Error:', e); }
    };

    const fetchUnits = async () => {
        try {
            const res = await fetch('/api/units', { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const data = await res.json();
            if (data.success) {
                setUnits(data.data);
            }
        } catch (e) { console.error('Error:', e); }
    };

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            currency_code: 'IDR',
            payment_term_id: '',
            valid_from: '',
            valid_to: '',
            active: 'Y',
            remarks: '',
            details: []
        });
        setEditingId(null);
    };

    const handleEdit = async (pl) => {
        try {
            const res = await fetch(`/api/price-lists/${pl.id}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
            if (!res.ok) {
                alert('Gagal mengambil data: ' + res.statusText);
                return;
            }
            const data = await res.json();
            if (data.success) {
                const fetched = data.data;
                setFormData({
                    code: fetched.code || '',
                    name: fetched.name || '',
                    currency_code: fetched.currency_code || 'IDR',
                    payment_term_id: fetched.payment_term_id || '',
                    valid_from: fetched.valid_from ? fetched.valid_from.split('T')[0] : '',
                    valid_to: fetched.valid_to ? fetched.valid_to.split('T')[0] : '',
                    active: fetched.active || 'Y',
                    remarks: fetched.remarks || '',
                    details: fetched.details || []
                });
                setEditingId(pl.id);
                setShowForm(true);
            } else {
                alert('Error: ' + (data.error || 'Gagal mengambil data'));
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus Price List ini?')) return;
        try {
            const res = await fetch(`/api/price-lists/${id}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                fetchPriceLists();
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingId ? `/api/price-lists/${editingId}` : '/api/price-lists';
            const method = editingId ? 'PUT' : 'POST';
            
            const payload = {
                ...formData,
                payment_term_id: formData.payment_term_id ? parseInt(formData.payment_term_id) : null,
                valid_from: formData.valid_from || null,
                valid_to: formData.valid_to || null
            };

            const res = await fetch(url, {
                method,
                headers: authHeaders,
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setShowForm(false);
                fetchPriceLists();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const addDetailRow = () => {
        setFormData({
            ...formData,
            details: [
                ...formData.details,
                { item_id: '', unit_id: '', price: 0, discount_percent: 0, min_qty: 0, id: Date.now() }
            ]
        });
    };

    const removeDetailRow = (index) => {
        const newDetails = [...formData.details];
        newDetails.splice(index, 1);
        setFormData({ ...formData, details: newDetails });
    };

    const updateDetailRow = (index, field, value) => {
        const newDetails = [...formData.details];
        newDetails[index][field] = value;
        
        // Auto-fill base unit if item is selected
        if (field === 'item_id') {
            const selectedItem = items.find(i => i.id == value);
            if (selectedItem && selectedItem.base_unit_id && !newDetails[index].unit_id) {
                newDetails[index].unit_id = selectedItem.base_unit_id;
            }
        }
        
        setFormData({ ...formData, details: newDetails });
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Master Price List</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                    + Tambah Price List
                </button>
            </div>

            {showForm && (
                <div className="modal-overlay">
                    <div className="modal modal-large" style={{ width: '90vw', maxWidth: '1200px' }}>
                        <div className="modal-header">
                            <h3>{editingId ? 'Edit Price List' : 'Tambah Price List Baru'}</h3>
                            <button className="modal-close" type="button" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-section">
                                <h4 style={{ marginBottom: '1rem', color: '#444', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Informasi Utama</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Kode Price List</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ flex: 2 }}>
                                        <label>Nama Price List</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Status Aktif</label>
                                        <select
                                            value={formData.active}
                                            onChange={(e) => setFormData({ ...formData, active: e.target.value })}
                                        >
                                            <option value="Y">Aktif</option>
                                            <option value="N">Tidak Aktif</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Berlaku Mulai</label>
                                        <input
                                            type="date"
                                            value={formData.valid_from}
                                            onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Berlaku Sampai</label>
                                        <input
                                            type="date"
                                            value={formData.valid_to}
                                            onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Khusus TOP (Opsional)</label>
                                        <select
                                            value={formData.payment_term_id}
                                            onChange={(e) => setFormData({ ...formData, payment_term_id: e.target.value })}
                                        >
                                            <option value="">-- Semua TOP --</option>
                                            {paymentTerms.map(pt => (
                                                <option key={pt.id} value={pt.id}>{pt.name} ({pt.days} Hari)</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="form-section" style={{ marginTop: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                                    <h4 style={{ margin: 0, color: '#444' }}>Daftar Harga Item</h4>
                                    <button type="button" className="btn btn-outline" onClick={addDetailRow} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                                        + Tambah Item
                                    </button>
                                </div>
                                
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px' }}>No</th>
                                                <th>Item</th>
                                                <th style={{ width: '120px' }}>Satuan</th>
                                                <th style={{ width: '150px' }}>Harga</th>
                                                <th style={{ width: '100px' }}>Diskon (%)</th>
                                                <th style={{ width: '100px' }}>Min Qty</th>
                                                <th style={{ width: '60px', textAlign: 'center' }}>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.details.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" style={{ textAlign: 'center', padding: '1rem' }}>
                                                        Belum ada item ditambahkan. Klik "+ Tambah Item".
                                                    </td>
                                                </tr>
                                            ) : (
                                                formData.details.map((row, index) => (
                                                    <tr key={index}>
                                                        <td>{index + 1}</td>
                                                        <td>
                                                            <select
                                                                required
                                                                value={row.item_id}
                                                                onChange={(e) => updateDetailRow(index, 'item_id', e.target.value)}
                                                                style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                                            >
                                                                <option value="">-- Pilih Item --</option>
                                                                {items.map(item => (
                                                                    <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                required
                                                                value={row.unit_id}
                                                                onChange={(e) => updateDetailRow(index, 'unit_id', e.target.value)}
                                                                style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                                            >
                                                                <option value="">-- Satuan --</option>
                                                                {units.map(u => (
                                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                required
                                                                min="0"
                                                                value={row.price}
                                                                onChange={(e) => updateDetailRow(index, 'price', e.target.value)}
                                                                style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                step="0.01"
                                                                value={row.discount_percent}
                                                                onChange={(e) => updateDetailRow(index, 'discount_percent', e.target.value)}
                                                                style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={row.min_qty}
                                                                onChange={(e) => updateDetailRow(index, 'min_qty', e.target.value)}
                                                                style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                                            />
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <button type="button" className="btn-icon" style={{ color: '#e53e3e' }} onClick={() => removeDetailRow(index)} title="Hapus Baris">
                                                                ×
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="form-actions" style={{ marginTop: '20px' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Simpan'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="card">
                {loading ? (
                    <div className="loading">
                        <div className="loading-spinner"></div>
                        <p>Memuat data...</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Kode</th>
                                <th>Nama</th>
                                <th>Mulai Berlaku</th>
                                <th>Sampai Berlaku</th>
                                <th>Khusus TOP</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {priceLists.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Belum ada data Price List
                                    </td>
                                </tr>
                            ) : (
                                priceLists.map((pl) => (
                                    <tr key={pl.id}>
                                        <td><strong>{pl.code}</strong></td>
                                        <td>{pl.name}</td>
                                        <td>{pl.valid_from ? pl.valid_from.split('T')[0] : '-'}</td>
                                        <td>{pl.valid_to ? pl.valid_to.split('T')[0] : '-'}</td>
                                        <td>{pl.payment_term_name || '-'}</td>
                                        <td>
                                            <span className={`status-badge ${pl.active === 'Y' ? 'status-posted' : 'status-draft'}`}>
                                                {pl.active === 'Y' ? 'Aktif' : 'Tidak Aktif'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn-icon" onClick={() => handleEdit(pl)} title="Edit">✏️</button>
                                            <button className="btn-icon" onClick={() => handleDelete(pl.id)} title="Hapus">🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default PriceList;
