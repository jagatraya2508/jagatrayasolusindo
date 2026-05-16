import { useState, useEffect } from 'react';

import { usePeriod } from '../../context/PeriodContext';
import { useAuth } from '../../context/AuthContext';

function PurchaseOrderList() {
    const { selectedPeriod } = usePeriod();
    const { token } = useAuth();
    const [canApprove, setCanApprove] = useState(false);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [suppliers, setSuppliers] = useState([]);
    const [items, setItems] = useState([]);
    const [formData, setFormData] = useState({
        doc_number: '',
        doc_date: new Date().toISOString().split('T')[0],
        partner_id: '',
        status: 'Draft',
        details: [],
        transcode_id: '',
        tax_type: 'Exclude', // 'Exclude' | 'Include' | 'No Tax'
        payment_term_id: '',
        currency_code: ''
    });
    const [transcodes, setTranscodes] = useState([]);
    const [paymentTerms, setPaymentTerms] = useState([]);
    const [currencies, setcurrencies] = useState([]);

    useEffect(() => {
        fetchData();
        fetchMasterData();
        checkApprovalPermission();
    }, [selectedPeriod]); // Add selectedPeriod dependency

    const checkApprovalPermission = async () => {
        try {
            const res = await fetch('/api/approval-check/purchase-order', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setCanApprove(data.allowed === true);
        } catch { setCanApprove(false); }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/purchase-orders';
            if (selectedPeriod) {
                // Ensure format YYYY-MM-DD
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
                setOrders(data.data);
            }
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const fetchMasterData = async () => {
        try {
            const [suppRes, itemRes, transRes, topRes, rateRes] = await Promise.all([
                fetch('/api/partners?type=Supplier'),
                fetch('/api/items'),
                fetch('/api/transcodes'),
                fetch('/api/payment-terms'),
                fetch('/api/currencies')
            ]);
            const suppData = await suppRes.json();
            const itemData = await itemRes.json();
            const transData = await transRes.json();
            const topData = await topRes.json();
            const rateData = await rateRes.json();

            if (suppData.success) setSuppliers(suppData.data);
            if (itemData.success) setItems(itemData.data);
            if (transData.success) {
                // Filter specifically for PO (nomortranscode = 1)
                const poTranscodes = transData.data.filter(t => t.active === 'Y' && t.nomortranscode === 1);
                setTranscodes(poTranscodes);
            }
            if (topData.success) setPaymentTerms(topData.data.filter(t => t.active === 'Y'));
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

    const generateDocNumber = () => {
        const date = new Date();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `PO-${y}${m}${d}-${rand}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.details.length === 0) {
            alert('Tambahkan minimal 1 item!');
            return;
        }
        try {
            const url = editingItem ? `/api/purchase-orders/${editingItem}` : '/api/purchase-orders';
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
                setEditingItem(null);
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
        try {
            const response = await fetch(`/api/purchase-orders/${id}`);
            const data = await response.json();
            if (data.success) {
                const po = data.data;
                // Find transcode based on doc_number prefix or pattern? 
                // Since we don't store transcode_id, we might need to rely on the user re-selecting if they want to change it, 
                // OR better: just keep existing number and generic type logic.
                // For now, let's load the data.

                // Try to guess transcode from available list if needed, or just leave blank/find first match
                // Ideally backend should store transcode_id but it doesnt yet.
                // We'll trust the doc_number.

                setFormData({
                    doc_number: po.doc_number,
                    doc_date: new Date(po.doc_date).toISOString().split('T')[0],
                    partner_id: po.partner_id || '',
                    status: po.status,
                    details: po.details.map(d => ({
                        item_id: d.item_id,
                        quantity: parseFloat(d.quantity),
                        unit_price: parseFloat(d.unit_price)
                    })),
                    transcode_id: po.transcode_id || '',
                    tax_type: po.tax_type || (po.ppn_included !== undefined ? (po.ppn_included ? 'Exclude' : 'No Tax') : 'Exclude'),
                    payment_term_id: po.payment_term_id || '',
                    currency_code: po.currency_code || ''
                });
                setEditingItem(id);
                setShowForm(true);
            }
        } catch (error) {
            alert('Error fetching details: ' + error.message);
        }
    };

    const handleApprove = async (id) => {
        if (!confirm('Approve Purchase Order ini? Status akan menjadi Approved dan tidak bisa diedit lagi.')) return;
        try {
            const response = await fetch(`/api/purchase-orders/${id}/approve`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            } else {
                alert('Error: ' + (data.reason || data.error));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleUnapprove = async (id) => {
        if (!confirm('Unapprove Purchase Order ini? Status akan kembali menjadi Draft.')) return;
        try {
            const response = await fetch(`/api/purchase-orders/${id}/unapprove`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            } else {
                alert('Error: ' + (data.reason || data.error));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus Purchase Order ini?')) return;
        try {
            const response = await fetch(`/api/purchase-orders/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const addDetailLine = () => {
        setFormData({
            ...formData,
            details: [...formData.details, { item_id: '', quantity: 1, unit_price: 0 }]
        });
    };

    const removeDetailLine = (index) => {
        const newDetails = formData.details.filter((_, i) => i !== index);
        setFormData({ ...formData, details: newDetails });
    };

    const updateDetailLine = (index, field, value) => {
        const newDetails = [...formData.details];
        newDetails[index][field] = value;

        // Auto-fill price from item
        if (field === 'item_id') {
            const item = items.find(i => i.id === parseInt(value));
            if (item) {
                newDetails[index].unit_price = item.standard_cost || 0;
            }
        }

        setFormData({ ...formData, details: newDetails });
    };

    const resetForm = () => {
        setEditingItem(null);
        setFormData({
            doc_number: '',
            doc_date: new Date().toISOString().split('T')[0],
            partner_id: '',
            status: 'Draft',
            details: [],
            transcode_id: '',
            tax_type: 'Exclude',
            payment_term_id: '',
            currency_code: ''
        });
    };

    

    const formatCurrency = (value) => {
        const code = formData.currency_code || 'IDR';
        try {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: code }).format(value || 0);
        } catch {
            return `${code} ${new Intl.NumberFormat('id-ID').format(value || 0)}`;
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('id-ID');
    };

    const calculateSubtotal = () => {
        return formData.details.reduce((sum, d) => sum + (d.quantity * d.unit_price), 0);
    };

    const calculatePPN = () => {
        if (formData.tax_type === 'No Tax') return 0;

        const subtotal = calculateSubtotal();
        if (formData.tax_type === 'Include') {
            // Include: Gross = TaxBase + PPN_Value
            // PPN_Value = Gross - (Gross / 1.11)
            const taxBase = subtotal / 1.11;
            return subtotal - taxBase;
        } else {
            // Exclude: PPN = Subtotal * 11%
            return subtotal * 0.11;
        }
    };

    const calculateGrandTotal = () => {
        const subtotal = calculateSubtotal();
        const ppn = calculatePPN();

        if (formData.tax_type === 'Include') {
            // Include: Total is same as subtotal (which is gross)
            return subtotal;
        } else {
            // Exclude: Total = Subtotal + PPN
            // No Tax: Total = Subtotal (PPN is 0)
            return subtotal + ppn;
        }
    };

    // Helper for display purposes in table footer
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
                <h1 className="page-title">Purchase Order</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                    + Buat PO Baru
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal modal-large">
                        <div className="modal-header">
                            <h3>
                                {editingItem ? (formData.status === 'Approved' ? 'Detail Purchase Order' : 'Edit Purchase Order') : 'Buat Purchase Order Baru'}
                                {formData.status === 'Approved' && <span className="badge badge-success" style={{ marginLeft: '10px' }}>Approved - Read Only</span>}
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
                                            const selectedId = parseInt(e.target.value);
                                            const selectedTranscode = transcodes.find(t => t.id === selectedId);
                                            setFormData({ ...formData, transcode_id: selectedId });
                                            if (selectedTranscode) {
                                                generateNumber(selectedTranscode.code);
                                            }
                                        }}
                                        required
                                        disabled={formData.status === 'Approved'}
                                    >
                                        <option value="">-- Pilih Tipe Transaksi --</option>
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
                                        onChange={(e) => setFormData({ ...formData, doc_date: e.target.value })}
                                        disabled={formData.status === 'Approved'}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mata Uang / Kurs</label>
                                    <select
                                        value={formData.currency_code || ''}
                                        onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                                        disabled={formData.status === 'Approved' || formData.status === 'Closed'}
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
                                    <label>Supplier</label>
                                    <select
                                        value={formData.partner_id}
                                        onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                                        required
                                        disabled={formData.status === 'Approved'}
                                    >
                                        <option value="">-- Pilih Supplier --</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Term of Payment</label>
                                    <select
                                        value={formData.payment_term_id}
                                        onChange={(e) => setFormData({ ...formData, payment_term_id: e.target.value })}
                                        disabled={formData.status === 'Approved'}
                                    >
                                        <option value="">-- Pilih TOP --</option>
                                        {paymentTerms.map(t => (
                                            <option key={t.id} value={t.id}>{t.code} - {t.name} ({t.days} hari)</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Detail Items */}
                            <div className="form-section">
                                <div className="form-section-header">
                                    <h4>Detail Item</h4>
                                    {formData.status !== 'Approved' && (
                                        <button type="button" className="btn btn-outline" onClick={addDetailLine}>+ Tambah Baris</button>
                                    )}
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th style={{ width: '100px' }}>Qty</th>
                                            <th style={{ width: '150px' }}>Harga</th>
                                            <th style={{ width: '150px' }}>Total</th>
                                            <th style={{ width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.details.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', padding: '1rem' }}>
                                                    {formData.status === 'Approved' ? 'Tidak ada item' : 'Belum ada item. Klik "Tambah Baris" untuk menambah item.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            formData.details.map((detail, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <select
                                                            value={detail.item_id}
                                                            onChange={(e) => updateDetailLine(idx, 'item_id', e.target.value)}
                                                            required
                                                            disabled={formData.status === 'Approved'}
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
                                                                min="1"
                                                                value={detail.quantity}
                                                                onChange={(e) => updateDetailLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                                disabled={formData.status === 'Approved'}
                                                                style={{ width: '80px' }}
                                                            />
                                                            <span style={{ fontSize: '0.85rem', color: '#666' }}>
                                                                {items.find(i => i.id === parseInt(detail.item_id))?.unit || '-'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={detail.unit_price}
                                                            onChange={(e) => updateDetailLine(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                                            disabled={formData.status === 'Approved'}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {formatCurrency(detail.quantity * detail.unit_price)}
                                                    </td>
                                                    <td>
                                                        {formData.status !== 'Approved' && (
                                                            <button type="button" className="btn-icon" onClick={() => removeDetailLine(idx)}>🗑️</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    <tfoot>
                                        {/* Dynamic Footer based on Tax Type */}
                                        {(() => {
                                            const display = getFooterDisplay();
                                            return (
                                                <>
                                                    <tr>
                                                        <td colSpan="3" style={{ textAlign: 'right' }}>{display.subtotalLabel}:</td>
                                                        <td style={{ textAlign: 'right' }}>{formatCurrency(display.subtotalValue)}</td>
                                                        <td></td>
                                                    </tr>

                                                    {display.taxBaseLabel && (
                                                        <tr>
                                                            <td colSpan="3" style={{ textAlign: 'right', color: '#666' }}>{display.taxBaseLabel}:</td>
                                                            <td style={{ textAlign: 'right', color: '#666' }}>{formatCurrency(display.taxBaseValue)}</td>
                                                            <td></td>
                                                        </tr>
                                                    )}

                                                    <tr>
                                                        <td colSpan="3" style={{ textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                                Pajak (PPN 11%):
                                                                <select
                                                                    value={formData.tax_type}
                                                                    onChange={(e) => setFormData({ ...formData, tax_type: e.target.value })}
                                                                    style={{ width: 'auto', padding: '0.2rem', fontSize: '0.9rem' }}
                                                                    disabled={formData.status === 'Approved'}
                                                                >
                                                                    <option value="Exclude">Exclude (Tambah)</option>
                                                                    <option value="Include">Include (Termasuk)</option>
                                                                    <option value="No Tax">No Tax (Tanpa Pajak)</option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>{formatCurrency(display.ppnValue)}</td>
                                                        <td></td>
                                                    </tr>

                                                    <tr style={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                                                        <td colSpan="3" style={{ textAlign: 'right' }}>Grand Total:</td>
                                                        <td style={{ textAlign: 'right' }}>{formatCurrency(calculateGrandTotal())}</td>
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
                                    {formData.status === 'Approved' ? 'Tutup' : 'Batal'}
                                </button>
                                {formData.status !== 'Approved' && (
                                    <button type="submit" className="btn btn-primary">{editingItem ? 'Update PO' : 'Simpan PO'}</button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Table */}
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
                                <th>No. Dokumen</th>
                                <th>Tanggal</th>
                                <th>Supplier</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Belum ada data Purchase Order
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id}>
                                        <td><strong>{order.doc_number}</strong></td>
                                        <td>{formatDate(order.doc_date)}</td>
                                        <td>{order.partner_name || '-'}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(order.total_amount)}</td>
                                        <td>
                                            <span className={`badge ${order.status === 'Draft' ? 'badge-warning' : order.status === 'Approved' ? 'badge-success' : 'badge-info'}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {order.status === 'Draft' ? (
                                                <>
                                                    {canApprove && <button className="btn-icon" onClick={() => handleApprove(order.id)} title="Approve" style={{ color: 'green', marginRight: '5px' }}>✅</button>}
                                                    <button className="btn-icon" onClick={() => handleEdit(order.id)} title="Edit" style={{ marginRight: '5px' }}>✏️</button>
                                                    <button className="btn-icon" onClick={() => handleDelete(order.id)} title="Hapus">🗑️</button>
                                                </>
                                            ) : (
                                                <>
                                                    {canApprove && <button
                                                        className="btn-icon"
                                                        onClick={() => order.status !== 'Closed' && handleUnapprove(order.id)}
                                                        title={order.status === 'Closed' ? "Closed - Cannot Unapprove" : "Unapprove"}
                                                        style={{
                                                            color: 'orange',
                                                            marginRight: '5px',
                                                            opacity: order.status === 'Closed' ? 0.3 : 1,
                                                            cursor: order.status === 'Closed' ? 'not-allowed' : 'pointer'
                                                        }}
                                                        disabled={order.status === 'Closed'}
                                                    >
                                                        🔓
                                                    </button>}
                                                    <button className="btn-icon" onClick={() => handleEdit(order.id)} title="Lihat Detail" style={{ color: 'blue' }}>👁️</button>
                                                </>
                                            )}
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

export default PurchaseOrderList;


