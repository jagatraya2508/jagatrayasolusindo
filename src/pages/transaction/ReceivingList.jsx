import { useState, useEffect } from 'react';

import { usePeriod } from '../../context/PeriodContext';
import { useAuth } from '../../context/AuthContext';

function ReceivingList() {
    const { selectedPeriod } = usePeriod();
    const { token } = useAuth();
    const [canApprove, setCanApprove] = useState(false);
    const [receivings, setReceivings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Master Data
    const [suppliers, setSuppliers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [items, setItems] = useState([]);
    const [transcodes, setTranscodes] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);

    const [formData, setFormData] = useState({
        doc_number: '',
        doc_date: new Date().toISOString().split('T')[0],
        po_id: '',
        partner_id: '',
        location_id: '',
        status: 'Draft',
        transcode_id: '',
        remarks: '',
        items: [],
        currency_code: ''
    });
    const [currencies, setcurrencies] = useState([]);

    useEffect(() => {
        fetchData();
        fetchMasterData();
        checkApprovalPermission();
    }, [selectedPeriod]);

    const checkApprovalPermission = async () => {
        try {
            const res = await fetch('/api/approval-check/receiving', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setCanApprove(data.allowed === true);
        } catch { setCanApprove(false); }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/receivings';
            if (selectedPeriod) {
                const formatDate = (d) => new Date(d).toISOString().split('T')[0];
                const query = new URLSearchParams({
                    startDate: formatDate(selectedPeriod.start_date),
                    endDate: formatDate(selectedPeriod.end_date)
                }).toString();
                url += `?${query}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            if (data.success) setReceivings(data.data);
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const fetchMasterData = async () => {
        try {
            const [suppRes, whRes, itemRes, transRes, poRes, rateRes] = await Promise.all([
                fetch('/api/partners?type=Supplier'),
                fetch('/api/locations'),
                fetch('/api/items'),
                fetch('/api/transcodes'),
                fetch('/api/purchase-orders'), // Ideally filter for status Approved
                fetch('/api/currencies')
            ]);

            const suppData = await suppRes.json();
            const whData = await whRes.json();
            const itemData = await itemRes.json();
            const transData = await transRes.json();
            const poData = await poRes.json();
            const rateData = await rateRes.json();

            if (suppData.success) setSuppliers(suppData.data);
            if (suppData.success) setSuppliers(suppData.data);
            if (whData.success) setLocations(whData.data);
            if (itemData.success) setItems(itemData.data);
            if (transData.success) {
                // Filter for Receiving transcode (nomortranscode = 3)
                setTranscodes(transData.data.filter(t => t.active === 'Y' && t.nomortranscode === 3));
            }
            if (poData.success) {
                // Store all POs, filter in render
                setPurchaseOrders(poData.data);
            }
            if (rateData.success) setcurrencies(rateData.data);

        } catch (error) {
            console.error('Error fetching master data:', error);
        }
    };

    const generateNumber = async (code) => {
        try {
            const response = await fetch(`/api/transcodes/${code}/generate`);
            const data = await response.json();
            if (data.success) {
                setFormData(prev => ({ ...prev, doc_number: data.doc_number }));
            }
        } catch (error) {
            console.error('Error generating number:', error);
        }
    };

    const handleSelectPO = async (poId) => {
        if (!poId) {
            setFormData(prev => ({ ...prev, po_id: '', partner_id: '', items: [] }));
            return;
        }

        try {
            const response = await fetch(`/api/purchase-orders/${poId}`);
            const data = await response.json();
            if (data.success) {
                const po = data.data;
                const poDetails = po.details || [];

                setFormData(prev => ({
                    ...prev,
                    po_id: po.id,
                    partner_id: po.partner_id,
                    // Map PO items to Receiving items
                    items: poDetails.map(d => {
                        const ordered = parseFloat(d.quantity);
                        const received = parseFloat(d.qty_received || 0);
                        const outstanding = Math.max(0, ordered - received);
                        return {
                            item_id: d.item_id,
                            quantity: outstanding,
                            unit_price: parseFloat(d.unit_price || 0),
                            remarks: ''
                        };
                    })
                }));
            }
        } catch (error) {
            console.error('Error fetching PO details:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingItem ? `/api/receivings/${editingItem}` : '/api/receivings';
            const method = editingItem ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (data.success) {
                alert(data.message);
                setShowForm(false);
                resetForm();
                fetchData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleEdit = async (id) => {
        console.log('Edit clicked for ID:', id);
        try {
            const response = await fetch(`/api/receivings/${id}`);
            const data = await response.json();
            if (data.success) {
                const rec = data.data;
                setFormData({
                    doc_number: rec.doc_number,
                    doc_date: new Date(rec.doc_date).toISOString().split('T')[0],
                    po_id: rec.po_id || '',
                    partner_id: rec.partner_id || '',
                    location_id: rec.location_id || '',
                    status: rec.status,
                    transcode_id: rec.transcode_id || '',
                    remarks: rec.remarks || '',
                    currency_code: rec.currency_code || '',
                    items: rec.details.map(d => ({
                        item_id: d.item_id,
                        quantity: parseFloat(d.quantity),
                        unit_price: parseFloat(d.unit_price || 0),
                        remarks: d.remarks || ''
                    }))
                });
                setEditingItem(id);
                setShowForm(true);
            } else {
                console.error('Failed to fetch details:', data.message || data.error);
                alert('Gagal mengambil detail: ' + (data.message || data.error));
            }
        } catch (error) {
            console.error('Error in handleEdit:', error);
            alert('Error fetching details: ' + error.message);
        }
    };

    const handleApprove = async (id) => {
        if (!confirm('Approve Receiving ini?')) return;
        try {
            const response = await fetch(`/api/receivings/${id}/approve`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handlePost = async (id) => {
        if (!confirm('Post Receiving ini? Stok & Jurnal otomatis akan terbentuk.')) return;
        try {
            const response = await fetch(`/api/receivings/${id}/post`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handleUnpost = async (id) => {
        if (!confirm('Unpost Receiving ini? Stok & Jurnal akan di-revert.')) return;
        try {
            const response = await fetch(`/api/receivings/${id}/unpost`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handleUnapprove = async (id) => {
        if (!confirm('Unapprove Receiving ini?')) return;
        try {
            const response = await fetch(`/api/receivings/${id}/unapprove`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus Receiving ini?')) return;
        try {
            const response = await fetch(`/api/receivings/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const resetForm = () => {
        setEditingItem(null);
        setFormData({
            doc_number: '',
            doc_date: new Date().toISOString().split('T')[0],
            po_id: '',
            partner_id: '',
            location_id: '',
            status: 'Draft',
            transcode_id: '',
            remarks: '',
            items: [],
            currency_code: ''
        });
    };

    // Helper functions
    const updateItemLine = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        setFormData({ ...formData, items: newItems });
    };

    const removeItemLine = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const addItemLine = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { item_id: '', quantity: 1, unit_price: 0, remarks: '' }]
        });
    };

    const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
    const formatDate = (date) => new Date(date).toLocaleDateString('id-ID');

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Receiving</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                    + Buat Receiving Baru
                </button>
            </div>

            {showForm && (
                <div className="modal-overlay">
                    <div className="modal modal-large">
                        <div className="modal-header">
                            <h3>
                                {editingItem ? (formData.status !== 'Draft' ? 'Detail Receiving' : 'Edit Receiving') : 'Buat Receiving Baru'}
                                {formData.status !== 'Draft' && <span className="badge badge-success" style={{ marginLeft: '10px' }}>{formData.status} - Read Only</span>}
                            </h3>
                            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Tipe Transaksi</label>
                                    <select
                                        value={formData.transcode_id}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setFormData({ ...formData, transcode_id: val });
                                            const tc = transcodes.find(t => t.id === val);
                                            if (tc) generateNumber(tc.code);
                                        }}
                                        disabled={formData.status !== 'Draft'}
                                    >
                                        <option value="">-- Pilih Tipe --</option>
                                        {transcodes.map(tc => (
                                            <option key={tc.id} value={tc.id}>{tc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>No. Dokumen</label>
                                    <input type="text" value={formData.doc_number} readOnly placeholder="Otomatis" />
                                </div>
                                <div className="form-group">
                                    <label>Tanggal</label>
                                    <input
                                        type="date"
                                        value={formData.doc_date}
                                        onChange={e => setFormData({ ...formData, doc_date: e.target.value })}
                                        disabled={formData.status !== 'Draft'}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mata Uang / Kurs</label>
                                    <select
                                        value={formData.currency_code || ''}
                                        onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                                        disabled={formData.status !== 'Draft'}
                                    >
                                        <option value="">IDR (Default - Tanpa Kurs)</option>
                                        {currencies.filter(er => er.active === 'Y').map(er => (
                                            <option key={er.code} value={er.code}>
                                                {er.code} - {er.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Ambil dari PO (Opsional)</label>
                                    <select
                                        value={formData.po_id}
                                        onChange={(e) => handleSelectPO(e.target.value)}
                                        disabled={!!editingItem || formData.status !== 'Draft'}
                                    >
                                        <option value="">-- Manual (Tanpa PO) --</option>
                                        {purchaseOrders
                                            .filter(po => {
                                                // Jika API backend belum di-reload dan tidak mengirimkan total_qty_ordered, tampilkan semua yang Approved
                                                if (po.total_qty_ordered === undefined) {
                                                    return po.status === 'Approved' || (formData.po_id && po.id === parseInt(formData.po_id));
                                                }
                                                // Jika API sudah update, filter berdasarkan qty yang belum dikirim
                                                return (po.status === 'Approved' && parseFloat(po.total_qty_ordered || 0) > parseFloat(po.total_qty_received || 0)) || (formData.po_id && po.id === parseInt(formData.po_id));
                                            })
                                            .map(po => (
                                                <option key={po.id} value={po.id}>{po.doc_number} - {po.partner_name}</option>
                                            ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Kirim Ke Location</label>
                                    <select
                                        value={formData.location_id}
                                        onChange={e => setFormData({ ...formData, location_id: e.target.value })}
                                        required
                                        disabled={formData.status !== 'Draft'}
                                    >
                                        <option value="">-- Pilih Location --</option>
                                        {locations.map(l => (
                                            <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Supplier</label>
                                    <select
                                        value={formData.partner_id}
                                        onChange={e => setFormData({ ...formData, partner_id: e.target.value })}
                                        disabled={!!formData.po_id || formData.status !== 'Draft'}
                                    >
                                        <option value="">-- Pilih Supplier --</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Keterangan</label>
                                <textarea
                                    value={formData.remarks}
                                    onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                    rows="2"
                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                    disabled={formData.status !== 'Draft'}
                                />
                            </div>

                            <div className="form-section">
                                <div className="form-section-header">
                                    <h4>Daftar Barang</h4>
                                    {formData.status === 'Draft' && (
                                        <button type="button" className="btn btn-outline" onClick={addItemLine}>+ Tambah Manual</button>
                                    )}
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th style={{ width: '120px' }}>Qty Terima</th>
                                            <th style={{ width: '150px' }}>Harga Satuan</th>
                                            <th>Keterangan</th>
                                            <th style={{ width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.items.length === 0 ? (
                                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1rem' }}>{formData.status !== 'Draft' ? 'Tidak ada item' : 'Belum ada item'}</td></tr>
                                        ) : (
                                            formData.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <select
                                                            value={item.item_id}
                                                            onChange={e => updateItemLine(idx, 'item_id', e.target.value)}
                                                            disabled={!!formData.po_id || formData.status !== 'Draft'}
                                                        >
                                                            <option value="">-- Pilih Item --</option>
                                                            {items.map(i => (
                                                                <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={e => updateItemLine(idx, 'quantity', parseFloat(e.target.value))}
                                                                min="0"
                                                                disabled={formData.status !== 'Draft'}
                                                                style={{ width: '80px' }}
                                                            />
                                                            <span style={{ fontSize: '0.85rem', color: '#666' }}>
                                                                {items.find(i => i.id === parseInt(item.item_id))?.unit || '-'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                                            <span style={{ marginRight: '5px', fontSize: '0.85rem' }}>Rp</span>
                                                            <input
                                                                type="number"
                                                                value={item.unit_price}
                                                                onChange={e => updateItemLine(idx, 'unit_price', parseFloat(e.target.value))}
                                                                disabled={!!formData.po_id || formData.status !== 'Draft'}
                                                                style={{ width: '100px' }}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={item.remarks}
                                                            onChange={e => updateItemLine(idx, 'remarks', e.target.value)}
                                                            placeholder="Catatan..."
                                                            disabled={formData.status !== 'Draft'}
                                                        />
                                                    </td>
                                                    <td>
                                                        {formData.status === 'Draft' && (
                                                            <button type="button" className="btn-icon" onClick={() => removeItemLine(idx)}>🗑️</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    <tfoot>
                                        {/* Optional footer if needed later */}
                                    </tfoot>
                                </table>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                                    {formData.status !== 'Draft' ? 'Tutup' : 'Batal'}
                                </button>
                                {formData.status === 'Draft' && (
                                    <button type="submit" className="btn btn-primary">Simpan Receiving</button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="card">
                {loading ? (
                    <div className="loading"><div className="loading-spinner"></div><p>Memuat data...</p></div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No. Dokumen</th>
                                <th>Tanggal</th>
                                <th>No. PO</th>
                                <th>Supplier</th>
                                <th>Location</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {receivings.length === 0 ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada data Receiving</td></tr>
                            ) : (
                                receivings.map(rec => (
                                    <tr key={rec.id}>
                                        <td><strong>{rec.doc_number}</strong></td>
                                        <td>{formatDate(rec.doc_date)}</td>
                                        <td>{rec.po_number || '-'}</td>
                                        <td>{rec.partner_name || '-'}</td>
                                        <td>{rec.location_name || '-'}</td>
                                        <td>
                                            <span className={`badge ${rec.status === 'Draft' ? 'badge-warning' : (rec.status.startsWith('Pending') ? 'badge-info' : 'badge-success')}`}>{rec.status}</span>
                                            {rec.status !== 'Draft' && !rec.status.startsWith('Pending') && (
                                                <div style={{ fontSize: '10px', color: 'gray' }}>
                                                    Rec: {parseFloat(rec.total_received || 0)} / Bill: {parseFloat(rec.total_billed || 0)}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div className="action-btn-group">
                                                {/* Group 1: Approval */}
                                                {(rec.status === 'Draft' || rec.status.startsWith('Pending')) && canApprove && (
                                                    <button className="btn-action approve" onClick={() => handleApprove(rec.id)} title="Approve">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                                        Approve
                                                    </button>
                                                )}
                                                {rec.status.startsWith('Pending') && canApprove && (
                                                    <button className="btn-action unapprove" onClick={() => handleUnapprove(rec.id)} title="Unapprove">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
                                                        Unapprove
                                                    </button>
                                                )}
                                                {(rec.status === 'Approved' || rec.status === 'Posted') && canApprove && (
                                                    <button className="btn-action unapprove" onClick={() => handleUnapprove(rec.id)} disabled={rec.status === 'Posted'} title={rec.status === 'Posted' ? 'Unpost dulu sebelum unapprove' : 'Unapprove'}>
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
                                                        Unapprove
                                                    </button>
                                                )}

                                                {/* Separator */}
                                                {(rec.status === 'Approved' || rec.status === 'Posted') && canApprove && (
                                                    <span className="action-separator"></span>
                                                )}

                                                {/* Group 2: Posting */}
                                                {rec.status === 'Approved' && canApprove && (
                                                    <button className="btn-action post" onClick={() => handlePost(rec.id)} title="Post (Stok & Jurnal)">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                                                        Posting
                                                    </button>
                                                )}
                                                {rec.status === 'Posted' && canApprove && (() => {
                                                    const isLocked = parseFloat(rec.total_billed || 0) >= parseFloat(rec.total_received || 0) && parseFloat(rec.total_received || 0) > 0;
                                                    return (
                                                        <button className="btn-action unpost" onClick={() => !isLocked && handleUnpost(rec.id)} disabled={isLocked} title={isLocked ? "Terkunci (Sudah ada Tagihan)" : "Unpost"}>
                                                            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                                                            Unpost
                                                        </button>
                                                    );
                                                })()}

                                                {/* Separator */}
                                                <span className="action-separator"></span>

                                                {/* Group 3: Edit / View / Delete */}
                                                {rec.status === 'Draft' && (
                                                    <button className="btn-action edit" onClick={() => handleEdit(rec.id)} title="Edit">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                                                        Edit
                                                    </button>
                                                )}
                                                {rec.status === 'Draft' && (
                                                    <button className="btn-action delete" onClick={() => handleDelete(rec.id)} title="Hapus">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                                        Hapus
                                                    </button>
                                                )}
                                                {rec.status !== 'Draft' && (
                                                    <button className="btn-action view" onClick={() => handleEdit(rec.id)} title="Lihat Detail">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                                                        Detail
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )
                }
            </div >
        </div >
    );
}

export default ReceivingList;


