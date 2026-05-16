import { useState, useEffect } from 'react';

import { usePeriod } from '../../context/PeriodContext';
import { useAuth } from '../../context/AuthContext';

function APInvoiceList() {
    const { selectedPeriod } = usePeriod();
    const { token } = useAuth();
    const [canApprove, setCanApprove] = useState(false);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [suppliers, setSuppliers] = useState([]);
    const [receivings, setReceivings] = useState([]);
    const [items, setItems] = useState([]);
    const [transcodes, setTranscodes] = useState([]);

    // "sourceType": 'receiving' | 'manual'
    const [sourceType, setSourceType] = useState('receiving');

    const [formData, setFormData] = useState({
        doc_number: '',
        doc_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        transcode_id: '',
        partner_id: '',
        receiving_id: '',
        status: 'Draft',
        notes: '',
        items: [],
        tax_type: 'Exclude',
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
            const res = await fetch('/api/approval-check/ap-invoice', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setCanApprove(data.allowed === true);
        } catch { setCanApprove(false); }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/ap-invoices';
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
            if (data.success) {
                setInvoices(data.data);
            }
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const fetchMasterData = async () => {
        try {
            const [supRes, recRes, itemRes, transRes, rateRes] = await Promise.all([
                fetch('/api/partners?type=Supplier'),
                fetch('/api/receivings'),
                fetch('/api/items'),
                fetch('/api/transcodes'),
                fetch('/api/currencies')
            ]);
            const supData = await supRes.json();
            const recData = await recRes.json();
            const itemData = await itemRes.json();
            const transData = await transRes.json();
            const rateData = await rateRes.json();

            if (supData.success) setSuppliers(supData.data);
            if (recData.success) {
                // Only show Approved receivings that are NOT fully billed
                setReceivings(recData.data.filter(r =>
                    r.status === 'Approved' &&
                    (parseFloat(r.total_billed || 0) < parseFloat(r.total_received || 0))
                ));
            }
            if (itemData.success) setItems(itemData.data);
            if (transData.success) {
                // Filter for AP Invoice transcode (nomortranscode === 7)
                setTranscodes(transData.data.filter(t => t.active === 'Y' && t.nomortranscode === 7));
            }
            if (rateData.success) setcurrencies(rateData.data);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const generateNumber = async (code) => {
        try {
            const response = await fetch(`/api/transcodes/${code}/generate`);
            const data = await response.json();
            if (data.success) {
                setFormData(prev => ({ ...prev, doc_number: data.doc_number }));
            } else {
                alert('Gagal generate nomor dokumen: ' + data.error);
            }
        } catch (error) {
            console.error('Error generating number:', error);
        }
    };

    const handleSelectReceiving = async (recId) => {
        if (!recId) {
            setFormData(prev => ({
                ...prev,
                receiving_id: '',
                partner_id: '',
                items: []
            }));
            return;
        }

        try {
            const response = await fetch(`/api/receivings/${recId}`);
            const data = await response.json();
            if (data.success) {
                const rec = data.data;
                const recDetails = rec.details || [];

                setFormData(prev => ({
                    ...prev,
                    receiving_id: rec.id,
                    partner_id: rec.partner_id,
                    items: recDetails
                        .map(d => {
                            const qtyReceived = parseFloat(d.quantity);
                            const qtyBilled = parseFloat(d.qty_billed || 0);
                            const remaining = qtyReceived - qtyBilled;
                            return {
                                item_id: d.item_id,
                                description: d.item_name || '',
                                quantity: remaining > 0 ? remaining : 0,
                                unit_price: parseFloat(d.unit_price) || 0,
                                amount: 0,
                                receiving_id: rec.id
                            };
                        })
                        .filter(item => item.quantity > 0), // Only include items with remaining quantity
                    tax_type: rec.tax_type || 'Exclude'
                }));
            }
        } catch (error) {
            console.error('Error fetching Receiving details:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingItem ? `/api/ap-invoices/${editingItem}` : '/api/ap-invoices';
            const method = editingItem ? 'PUT' : 'POST';

            const payload = {
                ...formData,
                items: formData.items.map(item => ({
                    ...item,
                    amount: parseFloat(item.quantity) * parseFloat(item.unit_price)
                }))
            };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (data.success) {
                alert(data.message);
                setShowForm(false);
                resetForm();
                fetchData();
                fetchMasterData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleEdit = async (id) => {
        try {
            const response = await fetch(`/api/ap-invoices/${id}`);
            const data = await response.json();
            if (data.success) {
                const inv = data.data;
                setFormData({
                    doc_number: inv.doc_number,
                    doc_date: new Date(inv.doc_date).toISOString().split('T')[0],
                    due_date: inv.due_date ? new Date(inv.due_date).toISOString().split('T')[0] : '',
                    transcode_id: inv.transcode_id || '',
                    partner_id: inv.partner_id || '',
                    receiving_id: inv.receiving_id || '',
                    status: inv.status,
                    notes: inv.notes || '',
                    items: inv.details.map(d => ({
                        item_id: d.item_id,
                        description: d.description,
                        quantity: parseFloat(d.quantity),
                        unit_price: parseFloat(d.unit_price),
                        amount: parseFloat(d.amount) || 0,
                        receiving_id: d.receiving_id || ''
                    })),
                    tax_type: inv.tax_type || 'Exclude',
                    currency_code: inv.currency_code || ''
                });

                setSourceType(inv.receiving_id ? 'receiving' : 'manual');
                setEditingItem(id);
                setShowForm(true);
            }
        } catch (error) {
            alert('Error fetching details: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus Invoice ini?')) return;
        try {
            const response = await fetch(`/api/ap-invoices/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
                fetchMasterData();
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleApprove = async (id) => {
        if (!confirm('Approve Invoice ini?')) return;
        try {
            const response = await fetch(`/api/ap-invoices/${id}/approve`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handlePost = async (id) => {
        if (!confirm('Post Invoice ini?')) return;
        try {
            const response = await fetch(`/api/ap-invoices/${id}/post`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handleUnpost = async (id) => {
        if (!confirm('Unpost Invoice ini? Status kembali ke Approved.')) return;
        try {
            const response = await fetch(`/api/ap-invoices/${id}/unpost`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handleUnapprove = async (id) => {
        if (!confirm('Unapprove Invoice ini?')) return;
        try {
            const response = await fetch(`/api/ap-invoices/${id}/unapprove`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handleAddItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { item_id: '', description: '', quantity: 1, unit_price: 0, amount: 0 }]
        }));
    };

    const handleRemoveItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        // Auto-calculate description if item selected
        if (field === 'item_id') {
            const item = items.find(i => i.id === parseInt(value));
            if (item) newItems[index].description = item.name;
        }
        setFormData({ ...formData, items: newItems });
    };

    const resetForm = () => {
        setEditingItem(null);
        setSourceType('receiving');
        setFormData({
            doc_number: 'AUTO',
            doc_date: new Date().toISOString().split('T')[0],
            due_date: new Date().toISOString().split('T')[0],
            transcode_id: '',
            partner_id: '',
            receiving_id: '',
            status: 'Draft',
            notes: '',
            items: [],
            tax_type: 'Exclude',
            currency_code: ''
        });
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('id-ID');
    };

    

    const formatCurrency = (value) => {
        const code = formData.currency_code || 'IDR';
        try {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: code }).format(value || 0);
        } catch {
            return `${code} ${new Intl.NumberFormat('id-ID').format(value || 0)}`;
        }
    };

    const calculateSubtotal = () => {
        return formData.items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unit_price) || 0), 0);
    };

    const calculatePPN = () => {
        if (formData.tax_type === 'No Tax') return 0;

        const subtotal = calculateSubtotal();
        if (formData.tax_type === 'Include') {
            const taxBase = subtotal / 1.11;
            return subtotal - taxBase;
        } else {
            return subtotal * 0.11;
        }
    };

    const calculateGrandTotal = () => {
        const subtotal = calculateSubtotal();
        const ppn = calculatePPN();

        if (formData.tax_type === 'Include') {
            return subtotal;
        } else {
            return subtotal + ppn;
        }
    };

    const getFooterDisplay = () => {
        const subtotal = calculateSubtotal();
        const ppn = calculatePPN();

        if (formData.tax_type === 'Include') {
            const taxBase = subtotal / 1.11;
            return {
                subtotalLabel: 'Subtotal (Gross)',
                subtotalValue: subtotal,
                taxBaseLabel: 'DPP (Tax Base)',
                taxBaseValue: taxBase,
                ppnValue: ppn
            };
        }

        return {
            subtotalLabel: 'Subtotal',
            subtotalValue: subtotal,
            taxBaseLabel: null,
            taxBaseValue: null,
            ppnValue: ppn
        };
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">AP Invoice / Tagihan Pembelian</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                    + Buat Invoice Baru
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal modal-large">
                        <div className="modal-header">
                            <h3>{editingItem ? 'Edit Invoice' : 'Buat Invoice Baru'}</h3>
                            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>No. Dokumen</label>
                                    <input
                                        type="text"
                                        value={formData.doc_number}
                                        onChange={(e) => setFormData({ ...formData, doc_number: e.target.value })}
                                        required
                                        placeholder="Otomatis"
                                        readOnly
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Tipe Transaksi</label>
                                    <select
                                        value={formData.transcode_id}
                                        onChange={(e) => {
                                            const selectedId = parseInt(e.target.value);
                                            const selectedTranscode = transcodes.find(t => t.id === selectedId);
                                            setFormData({ ...formData, transcode_id: selectedId });
                                            if (selectedTranscode) {
                                                generateNumber(selectedTranscode.code);
                                            }
                                        }}
                                        disabled={formData.status !== 'Draft'}
                                    >
                                        <option value="">-- Pilih Tipe --</option>
                                        {transcodes.map(t => (
                                            <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Tanggal Invoice</label>
                                    <input
                                        type="date"
                                        value={formData.doc_date}
                                        onChange={(e) => setFormData({ ...formData, doc_date: e.target.value })}
                                        required
                                        disabled={formData.status !== 'Draft'}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Jatuh Tempo</label>
                                    <input
                                        type="date"
                                        value={formData.due_date}
                                        onChange={e => setFormData({ ...formData, due_date: e.target.value })}
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
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label>Sumber Data</label>
                                    <div style={{ display: 'flex', gap: '20px', marginTop: '5px' }}>
                                        <label style={{ display: 'inline-flex', alignItems: 'center' }}>
                                            <input
                                                type="radio"
                                                name="sourceType"
                                                checked={sourceType === 'receiving'}
                                                onChange={() => {
                                                    setSourceType('receiving');
                                                    setFormData(prev => ({ ...prev, receiving_id: '', items: [] }));
                                                }}
                                                disabled={editingItem || formData.status !== 'Draft'}
                                            />
                                            <span style={{ marginLeft: '5px' }}>Dari Receiving</span>
                                        </label>
                                        <label style={{ display: 'inline-flex', alignItems: 'center' }}>
                                            <input
                                                type="radio"
                                                name="sourceType"
                                                checked={sourceType === 'manual'}
                                                onChange={() => {
                                                    setSourceType('manual');
                                                    setFormData(prev => ({ ...prev, receiving_id: '', items: [] }));
                                                }}
                                                disabled={editingItem || formData.status !== 'Draft'}
                                            />
                                            <span style={{ marginLeft: '5px' }}>Input Manual</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                {sourceType === 'receiving' && (
                                    <div className="form-group">
                                        <label>Receiving (Approved)</label>
                                        <select
                                            value={formData.receiving_id}
                                            onChange={(e) => handleSelectReceiving(e.target.value)}
                                            disabled={editingItem || formData.status !== 'Draft'}
                                        >
                                            <option value="">-- Pilih Receiving --</option>
                                            {receivings.map(rec => (
                                                <option key={rec.id} value={rec.id}>
                                                    {rec.doc_number} - {rec.partner_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Supplier</label>
                                    <select
                                        value={formData.partner_id}
                                        onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                                        required
                                        disabled={formData.receiving_id || formData.status !== 'Draft'}
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
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="2"
                                    disabled={formData.status !== 'Draft'}
                                />
                            </div>

                            <div className="form-section">
                                <div className="form-section-header">
                                    <h4>Daftar Tagihan</h4>
                                    <button type="button" className="btn btn-outline" onClick={handleAddItem} disabled={formData.status !== 'Draft'}>+ Tambah Item/Jasa</button>
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Item (Opsional)</th>
                                            <th>Deskripsi</th>
                                            <th style={{ width: '80px' }}>Qty</th>
                                            <th style={{ width: '120px' }}>Harga Satuan</th>
                                            <th style={{ width: '120px' }}>Total</th>
                                            <th style={{ width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.items.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>
                                                    {sourceType === 'receiving' && !formData.receiving_id ? 'Pilih Receiving terlebih dahulu.' : 'Belum ada item.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            formData.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <select
                                                            value={item.item_id}
                                                            onChange={(e) => handleItemChange(idx, 'item_id', e.target.value)}
                                                            style={{ width: '100%' }}
                                                            disabled={formData.receiving_id || formData.status !== 'Draft'}
                                                        >
                                                            <option value="">-- Non-Inventory --</option>
                                                            {items.map(i => (
                                                                <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={item.description}
                                                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                            required
                                                            disabled={formData.status !== 'Draft'}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={item.quantity}
                                                            onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                            required
                                                            style={{ width: '100%' }}
                                                            disabled={formData.status !== 'Draft'}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={item.unit_price}
                                                            onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                                            required
                                                            style={{ width: '100%' }}
                                                            disabled={formData.status !== 'Draft'}
                                                        />
                                                    </td>
                                                    <td>
                                                        {formatMoney((item.quantity || 0) * (item.unit_price || 0))}
                                                    </td>
                                                    <td>
                                                        <button type="button" className="btn-icon" onClick={() => handleRemoveItem(idx)} disabled={formData.status !== 'Draft'}>🗑️</button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    <tfoot>
                                        {(() => {
                                            const display = getFooterDisplay();
                                            return (
                                                <>
                                                    <tr>
                                                        <td colSpan="4" style={{ textAlign: 'right' }}>{display.subtotalLabel}:</td>
                                                        <td style={{ fontWeight: 'bold' }}>
                                                            {formatMoney(display.subtotalValue)}
                                                        </td>
                                                        <td></td>
                                                    </tr>

                                                    {display.taxBaseLabel && (
                                                        <tr>
                                                            <td colSpan="4" style={{ textAlign: 'right', color: '#666' }}>{display.taxBaseLabel}:</td>
                                                            <td style={{ color: '#666' }}>{formatMoney(display.taxBaseValue)}</td>
                                                            <td></td>
                                                        </tr>
                                                    )}

                                                    <tr>
                                                        <td colSpan="4" style={{ textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                                Pajak (PPN 11%):
                                                                <select
                                                                    value={formData.tax_type}
                                                                    onChange={(e) => setFormData({ ...formData, tax_type: e.target.value })}
                                                                    style={{ width: 'auto', padding: '0.2rem', fontSize: '0.9rem' }}
                                                                    disabled={formData.status !== 'Draft' || !!formData.receiving_id}
                                                                >
                                                                    <option value="Exclude">Exclude (Tambah)</option>
                                                                    <option value="Include">Include (Termasuk)</option>
                                                                    <option value="No Tax">No Tax (Tanpa Pajak)</option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td style={{ fontWeight: 'bold' }}>{formatMoney(display.ppnValue)}</td>
                                                        <td></td>
                                                    </tr>

                                                    <tr style={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                                                        <td colSpan="4" style={{ textAlign: 'right' }}>Grand Total:</td>
                                                        <td style={{ fontWeight: 'bold' }}>
                                                            {formatMoney(calculateGrandTotal())}
                                                        </td>
                                                        <td></td>
                                                    </tr>
                                                </>
                                            );
                                        })()}
                                    </tfoot>
                                </table>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                                    {formData.status !== 'Draft' ? 'Tutup' : 'Batal'}
                                </button>
                                {formData.status === 'Draft' && (
                                    <button type="submit" className="btn btn-primary">{editingItem ? 'Update Invoice' : 'Simpan Invoice'}</button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* List Table */}
            <div className="card">
                {loading ? (
                    <div className="loading"><div className="loading-spinner"></div><p>Memuat data...</p></div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>No. Dokumen</th>
                                <th>No. Receiving</th>
                                <th>jth Tempo</th>
                                <th>Supplier</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada AP Invoice</td>
                                </tr>
                            ) : (
                                invoices.map(inv => (
                                    <tr key={inv.id}>
                                        <td>{formatDate(inv.doc_date)}</td>
                                        <td><strong>{inv.doc_number}</strong></td>
                                        <td>{inv.receiving_number || '-'}</td>
                                        <td>{inv.due_date ? formatDate(inv.due_date) : '-'}</td>
                                        <td>{inv.partner_name || '-'}</td>
                                        <td>
                                            <span className={`badge ${inv.status === 'Draft' ? 'badge-warning' : (inv.status.startsWith('Pending') ? 'badge-info' : 'badge-success')}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div className="action-btn-group">
                                                {/* Group 1: Approval */}
                                                {(inv.status === 'Draft' || inv.status.startsWith('Pending')) && canApprove && (
                                                    <button className="btn-action approve" onClick={() => handleApprove(inv.id)} title="Approve">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                                        Approve
                                                    </button>
                                                )}
                                                {inv.status.startsWith('Pending') && canApprove && (
                                                    <button className="btn-action unapprove" onClick={() => handleUnapprove(inv.id)} title="Unapprove">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
                                                        Unapprove
                                                    </button>
                                                )}
                                                {(inv.status === 'Approved' || inv.status === 'Posted') && canApprove && (
                                                    <button className="btn-action unapprove" onClick={() => handleUnapprove(inv.id)} disabled={inv.status === 'Posted'} title={inv.status === 'Posted' ? 'Unpost dulu sebelum unapprove' : 'Unapprove'}>
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
                                                        Unapprove
                                                    </button>
                                                )}

                                                {/* Separator */}
                                                {(inv.status === 'Approved' || inv.status === 'Posted') && canApprove && (
                                                    <span className="action-separator"></span>
                                                )}

                                                {/* Group 2: Posting */}
                                                {inv.status === 'Approved' && canApprove && (
                                                    <button className="btn-action post" onClick={() => handlePost(inv.id)} title="Post Jurnal">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                                                        Posting
                                                    </button>
                                                )}
                                                {inv.status === 'Posted' && canApprove && (
                                                    <button className="btn-action unpost" onClick={() => handleUnpost(inv.id)} title="Unpost">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                                                        Unpost
                                                    </button>
                                                )}

                                                {/* Separator */}
                                                <span className="action-separator"></span>

                                                {/* Group 3: Edit / View / Delete */}
                                                {inv.status === 'Draft' && (
                                                    <button className="btn-action edit" onClick={() => handleEdit(inv.id)} title="Edit">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                                                        Edit
                                                    </button>
                                                )}
                                                {inv.status === 'Draft' && (
                                                    <button className="btn-action delete" onClick={() => handleDelete(inv.id)} title="Hapus">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                                        Hapus
                                                    </button>
                                                )}
                                                {inv.status !== 'Draft' && (
                                                    <button className="btn-action view" onClick={() => handleEdit(inv.id)} title="Lihat Detail">
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
                )}
            </div>
        </div>
    );
}

export default APInvoiceList;


