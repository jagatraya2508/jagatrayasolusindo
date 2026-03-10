import { useState, useEffect } from 'react';

import { usePeriod } from '../../context/PeriodContext';

function SalesOrderList() {
    const { selectedPeriod } = usePeriod();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [salesPersons, setSalesPersons] = useState([]);
    const [items, setItems] = useState([]);
    const [unitConversions, setUnitConversions] = useState([]);
    const [formData, setFormData] = useState({
        doc_number: '',
        doc_date: new Date().toISOString().split('T')[0],
        partner_id: '',
        salesperson_id: '',
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
    const [allowedTops, setAllowedTops] = useState([]);

    useEffect(() => {
        fetchData();
        fetchMasterData();
    }, [selectedPeriod]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/sales-orders';
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
                setOrders(data.data);
            }
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const fetchMasterData = async () => {
        try {
            const [custRes, spRes, itemRes, transRes, topRes, rateRes] = await Promise.all([
                fetch('/api/partners?type=Customer'),
                fetch('/api/salespersons'),
                fetch('/api/items'),
                fetch('/api/transcodes'),
                fetch('/api/payment-terms'),
                fetch('/api/currencies')
            ]);
            const custData = await custRes.json();
            const spData = await spRes.json();
            const itemData = await itemRes.json();
            const transData = await transRes.json();
            const topData = await topRes.json();
            const rateData = await rateRes.json();

            if (custData.success) setCustomers(custData.data);
            if (spData.success) setSalesPersons(spData.data);
            if (itemData.success) setItems(itemData.data);
            if (transData.success) {
                // Filter specifically for SO (nomortranscode = 2)
                const soTranscodes = transData.data.filter(t => t.active === 'Y' && t.nomortranscode === 2);
                setTranscodes(soTranscodes);
            }
            if (topData.success) setPaymentTerms(topData.data.filter(t => t.active === 'Y'));
            if (rateData.success) setcurrencies(rateData.data);

            // Fetch unit conversions
            try {
                const ucRes = await fetch('/api/unit-conversions');
                const ucData = await ucRes.json();
                if (ucData.success) setUnitConversions(ucData.data.filter(uc => uc.active === 'Y'));
            } catch (err) { console.error('Error fetching unit conversions:', err); }
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
        return `SO-${y}${m}${d}-${rand}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.details.length === 0) {
            alert('Tambahkan minimal 1 item!');
            return;
        }
        try {
            const url = editingItem ? `/api/sales-orders/${editingItem}` : '/api/sales-orders';
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

    const handleCustomerChange = async (customerId) => {
        setFormData(prev => ({ ...prev, partner_id: customerId, payment_term_id: '' }));
        if (!customerId) {
            setAllowedTops([]);
            return;
        }

        try {
            const response = await fetch(`/api/partners/${customerId}`);
            const data = await response.json();
            if (data.success && data.data && data.data.allowed_tops) {
                setAllowedTops(data.data.allowed_tops);
            } else {
                setAllowedTops([]);
            }
        } catch (error) {
            console.error('Error fetching partner allowed TOPs:', error);
            setAllowedTops([]);
        }
    };

    const handleEdit = async (id) => {
        try {
            const response = await fetch(`/api/sales-orders/${id}`);
            const data = await response.json();
            if (data.success) {
                const so = data.data;

                // Also fetch allowed tops for the customer
                if (so.partner_id) {
                    const custRes = await fetch(`/api/partners/${so.partner_id}`);
                    const custData = await custRes.json();
                    if (custData.success && custData.data && custData.data.allowed_tops) {
                        setAllowedTops(custData.data.allowed_tops);
                    } else {
                        setAllowedTops([]);
                    }
                } else {
                    setAllowedTops([]);
                }

                setFormData({
                    doc_number: so.doc_number,
                    doc_date: new Date(so.doc_date).toISOString().split('T')[0],
                    partner_id: so.partner_id || '',
                    salesperson_id: so.sales_person_id || '',
                    status: so.status,
                    details: so.details.map(d => ({
                        item_id: d.item_id,
                        quantity: parseFloat(d.quantity),
                        unit_price: parseFloat(d.unit_price),
                        unit_code: d.detail_unit_code || d.item_base_unit || '',
                        conversion_factor: parseFloat(d.detail_conversion_factor) || 1
                    })),
                    transcode_id: so.transcode_id || '',
                    tax_type: so.tax_type || (so.ppn_included !== undefined ? (so.ppn_included ? 'Exclude' : 'No Tax') : 'Exclude'),
                    payment_term_id: so.payment_term_id || '',
                    currency_code: so.currency_code || ''
                });
                setEditingItem(id);
                setShowForm(true);
            }
        } catch (error) {
            alert('Error fetching details: ' + error.message);
        }
    };

    const handleApprove = async (id) => {
        // Since we don't have a specific approve endpoint for SO yet in the provided snippets (only PO was explicitly asked), 
        // I should probably add one in server/index.js if I want this to work fully.
        // Wait, I only added it for PO. Let me add it for SO too in server/index.js in next step or now?
        // Actually, for now let's just use the same pattern but I need to make sure backend supports it.
        // I didn't add the /approve endpoint for SO in server/index.js yet.
        // I will add the UI button but it will fail if I don't add the endpoint.
        // Let's hold off on the Approve button for SO until backend is ready?
        // NO, better to add backend support now.
        // But for this tool call, I'll just add the functions. I'll add the backend endpoint in next tool call.

        if (!confirm('Approve Sales Order ini? status akan menjadi Approved')) return;
        try {
            // Reusing the same pattern, assuming I will add the endpoint
            const response = await fetch(`/api/sales-orders/${id}/approve`, { method: 'PUT' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleUnapprove = async (id) => {
        if (!confirm('Unapprove Sales Order ini? Status akan kembali menjadi Draft.')) return;
        try {
            const response = await fetch(`/api/sales-orders/${id}/unapprove`, { method: 'PUT' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus Sales Order ini?')) return;
        try {
            const response = await fetch(`/api/sales-orders/${id}`, { method: 'DELETE' });
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
            details: [...formData.details, { item_id: '', quantity: 1, unit_price: 0, unit_code: '', conversion_factor: 1 }]
        });
    };

    const removeDetailLine = (index) => {
        const newDetails = formData.details.filter((_, i) => i !== index);
        setFormData({ ...formData, details: newDetails });
    };

    const updateDetailLine = (index, field, value) => {
        const newDetails = [...formData.details];
        newDetails[index][field] = value;

        // Auto-fill price and unit from item
        if (field === 'item_id') {
            const item = items.find(i => i.id === parseInt(value));
            if (item) {
                newDetails[index].unit_price = item.standard_price || 0;
                newDetails[index].unit_code = item.unit || '';
                newDetails[index].conversion_factor = 1;
            }
        }

        // Handle unit change - update conversion factor
        if (field === 'unit_code') {
            const item = items.find(i => i.id === parseInt(newDetails[index].item_id));
            const baseUnit = item?.unit || '';
            if (value === baseUnit || !value) {
                newDetails[index].conversion_factor = 1;
            } else {
                // Find conversion: from selected unit to base unit
                const conv = unitConversions.find(uc =>
                    (uc.from_unit_code === value && uc.to_unit_code === baseUnit) ||
                    (uc.to_unit_code === value && uc.from_unit_code === baseUnit)
                );
                if (conv) {
                    if (conv.from_unit_code === value) {
                        // e.g., BOX -> PCS, factor = 12
                        newDetails[index].conversion_factor = parseFloat(conv.conversion_factor);
                    } else {
                        // Reverse: PCS -> BOX, factor = 1/12
                        newDetails[index].conversion_factor = 1 / parseFloat(conv.conversion_factor);
                    }
                } else {
                    newDetails[index].conversion_factor = 1;
                }
            }
        }

        setFormData({ ...formData, details: newDetails });
    };

    const resetForm = () => {
        setEditingItem(null);
        setAllowedTops([]);
        setFormData({
            doc_number: '',
            doc_date: new Date().toISOString().split('T')[0],
            partner_id: '',
            salesperson_id: '',
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
                <h1 className="page-title">Sales Order</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                    + Buat SO Baru
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal modal-large">
                        <div className="modal-header">
                            <h3>
                                {editingItem ? (formData.status === 'Approved' ? 'Detail Sales Order' : 'Edit Sales Order') : 'Buat Sales Order Baru'}
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
                                    <label>Customer</label>
                                    <select
                                        value={formData.partner_id}
                                        onChange={(e) => handleCustomerChange(e.target.value)}
                                        required
                                        disabled={formData.status === 'Approved'}
                                    >
                                        <option value="">-- Pilih Customer --</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
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
                                        {paymentTerms
                                            .filter(t => allowedTops.length === 0 || allowedTops.includes(t.id))
                                            .map(t => (
                                                <option key={t.id} value={t.id}>{t.code} - {t.name} ({t.days} hari)</option>
                                            ))
                                        }
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Sales Person</label>
                                    <select
                                        value={formData.salesperson_id}
                                        onChange={(e) => setFormData({ ...formData, salesperson_id: e.target.value })}
                                        disabled={formData.status === 'Approved'}
                                    >
                                        <option value="">-- Pilih Sales --</option>
                                        {salesPersons.map(sp => (
                                            <option key={sp.id} value={sp.id}>{sp.code} - {sp.name}</option>
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
                                            <th style={{ width: '120px' }}>Satuan</th>
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
                                                                min="0.01"
                                                                step="0.01"
                                                                value={detail.quantity}
                                                                onChange={(e) => updateDetailLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                                disabled={formData.status === 'Approved'}
                                                                style={{ width: '80px' }}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {(() => {
                                                            const item = items.find(i => i.id === parseInt(detail.item_id));
                                                            const baseUnit = item?.unit || '';
                                                            const itemConversionCode = item?.conversion_code || '';
                                                            // Get available units for this item
                                                            const availableUnits = [baseUnit];

                                                            unitConversions.forEach(uc => {
                                                                // Only include conversions that match the item's conversion_code
                                                                if (itemConversionCode && uc.conversion_code === itemConversionCode) {
                                                                    if (uc.from_unit_code === baseUnit && !availableUnits.includes(uc.to_unit_code)) availableUnits.push(uc.to_unit_code);
                                                                    if (uc.to_unit_code === baseUnit && !availableUnits.includes(uc.from_unit_code)) availableUnits.push(uc.from_unit_code);
                                                                }
                                                            });

                                                            const convFactor = detail.conversion_factor || 1;
                                                            const baseQty = detail.quantity * convFactor;
                                                            return (
                                                                <div>
                                                                    <select
                                                                        value={detail.unit_code || baseUnit}
                                                                        onChange={(e) => updateDetailLine(idx, 'unit_code', e.target.value)}
                                                                        disabled={formData.status === 'Approved'}
                                                                        style={{ width: '100%', fontSize: '0.85rem' }}
                                                                    >
                                                                        {availableUnits.filter(Boolean).map(u => (
                                                                            <option key={u} value={u}>{u}</option>
                                                                        ))}
                                                                    </select>
                                                                    {convFactor !== 1 && detail.quantity > 0 && (
                                                                        <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '2px' }}>
                                                                            = {baseQty} {baseUnit}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
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
                                    <button type="submit" className="btn btn-primary">{editingItem ? 'Update SO' : 'Simpan SO'}</button>
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
                                <th>Customer</th>
                                <th>Sales</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Belum ada data Sales Order
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id}>
                                        <td><strong>{order.doc_number}</strong></td>
                                        <td>{formatDate(order.doc_date)}</td>
                                        <td>{order.partner_name || '-'}</td>
                                        <td>{order.salesperson_name || '-'}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(order.total_amount)}</td>
                                        <td>
                                            <span className={`badge ${order.status === 'Draft' ? 'badge-warning' : order.status === 'Approved' ? 'badge-success' : 'badge-info'}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {order.status === 'Draft' ? (
                                                <>
                                                    <button className="btn-icon" onClick={() => handleApprove(order.id)} title="Approve" style={{ color: 'green', marginRight: '5px' }}>✅</button>
                                                    <button className="btn-icon" onClick={() => handleEdit(order.id)} title="Edit" style={{ marginRight: '5px' }}>✏️</button>
                                                    <button className="btn-icon" onClick={() => handleDelete(order.id)} title="Hapus">🗑️</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
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
                                                    </button>
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
        </div >
    );
}

export default SalesOrderList;


