import { useState, useEffect } from 'react';

import { usePeriod } from '../../context/PeriodContext';

function ARInvoiceList() {
    const { selectedPeriod } = usePeriod();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [items, setItems] = useState([]);
    const [transcodes, setTranscodes] = useState([]);
    const [salesPersons, setSalesPersons] = useState([]);
    const [paymentTerms, setPaymentTerms] = useState([]);
    const [allowedTops, setAllowedTops] = useState([]);

    // "sourceType": 'shipment' | 'manual'
    const [sourceType, setSourceType] = useState('shipment');

    const [formData, setFormData] = useState({
        doc_number: '',
        doc_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        transcode_id: '',
        partner_id: '',
        shipment_id: '',
        status: 'Draft',
        notes: '',
        items: [],
        tax_type: 'Exclude',
        sales_person_id: '',
        payment_term_id: '',
        currency_code: ''
    });
    const [currencies, setcurrencies] = useState([]);

    useEffect(() => {
        fetchData();
        fetchMasterData();
    }, [selectedPeriod]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/ar-invoices';
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
            const [custRes, shpRes, itemRes, transRes, spRes, ptRes, rateRes] = await Promise.all([
                fetch('/api/partners?type=Customer'),
                fetch('/api/shipments'),
                fetch('/api/items'),
                fetch('/api/transcodes'),
                fetch('/api/salespersons'),
                fetch('/api/payment-terms'),
                fetch('/api/currencies')
            ]);
            const custData = await custRes.json();
            const shpData = await shpRes.json();
            const itemData = await itemRes.json();
            const transData = await transRes.json();
            const spData = await spRes.json();
            const ptData = await ptRes.json();
            const rateData = await rateRes.json();

            if (custData.success) setCustomers(custData.data);
            if (shpData.success) {
                // Only show Approved shipments that are NOT fully billed
                setShipments(shpData.data.filter(s =>
                    s.status === 'Approved' &&
                    (parseFloat(s.total_billed || 0) < parseFloat(s.total_shipped || 0))
                ));
            }
            if (itemData.success) setItems(itemData.data);
            if (transData.success) {
                // Filter for AR Invoice transcode (nomortranscode === 8)
                setTranscodes(transData.data.filter(t => t.active === 'Y' && t.nomortranscode === 8));
            }
            if (spData.success) setSalesPersons(spData.data);
            if (ptData.success) setPaymentTerms(ptData.data);
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

    const handleSelectShipment = async (shpId) => {
        if (!shpId) {
            setFormData(prev => ({
                ...prev,
                shipment_id: '',
                partner_id: '',
                items: []
            }));
            return;
        }

        try {
            const response = await fetch(`/api/shipments/${shpId}`);
            const data = await response.json();
            if (data.success) {
                const shp = data.data;
                const shpDetails = shp.details || [];

                // Fetch allowed tops for the customer in shipment
                if (shp.partner_id) {
                    const custRes = await fetch(`/api/partners/${shp.partner_id}`);
                    const custData = await custRes.json();
                    if (custData.success && custData.data && custData.data.allowed_tops) {
                        setAllowedTops(custData.data.allowed_tops);
                    } else {
                        setAllowedTops([]);
                    }
                }

                setFormData(prev => ({
                    ...prev,
                    shipment_id: shp.id,
                    partner_id: shp.partner_id,
                    items: shpDetails
                        .map(d => {
                            const qtyShipped = parseFloat(d.quantity);
                            const qtyBilled = parseFloat(d.qty_billed || 0);
                            const remaining = qtyShipped - qtyBilled;
                            return {
                                item_id: d.item_id,
                                description: d.item_name || '',
                                quantity: remaining > 0 ? remaining : 0,
                                unit_price: parseFloat(d.unit_price) || 0,
                                amount: 0,
                                shipment_id: shp.id
                            };
                        })
                        .filter(item => item.quantity > 0),
                    sales_person_id: (shpDetails.length > 0 && shpDetails[0].sales_person_id) ? shpDetails[0].sales_person_id : '',
                    payment_term_id: (shpDetails.length > 0 && shpDetails[0].payment_term_id) ? shpDetails[0].payment_term_id : '',
                    tax_type: shp.tax_type || 'Exclude'
                }));
            }
        } catch (error) {
            console.error('Error fetching Shipment details:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingItem ? `/api/ar-invoices/${editingItem}` : '/api/ar-invoices';
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
            const response = await fetch(`/api/ar-invoices/${id}`);
            const data = await response.json();
            if (data.success) {
                const inv = data.data;
                setFormData({
                    doc_number: inv.doc_number,
                    doc_date: new Date(inv.doc_date).toISOString().split('T')[0],
                    due_date: inv.due_date ? new Date(inv.due_date).toISOString().split('T')[0] : '',
                    transcode_id: inv.transcode_id || '',
                    partner_id: inv.partner_id || '',
                    shipment_id: '',
                    status: inv.status,
                    notes: inv.notes || '',
                    sales_person_id: inv.sales_person_id || '',
                    payment_term_id: inv.payment_term_id || '',
                    items: inv.details.map(d => ({
                        item_id: d.item_id,
                        description: d.description,
                        quantity: parseFloat(d.quantity),
                        unit_price: parseFloat(d.unit_price),
                        amount: parseFloat(d.amount) || 0,
                        shipment_id: d.shipment_id || ''
                    })),
                    tax_type: inv.tax_type || 'Exclude',
                    sales_person_id: inv.sales_person_id || '',
                    payment_term_id: inv.payment_term_id || '',
                    currency_code: inv.currency_code || ''
                });

                // Also fetch allowed tops for the customer
                if (inv.partner_id) {
                    const custRes = await fetch(`/api/partners/${inv.partner_id}`);
                    const custData = await custRes.json();
                    if (custData.success && custData.data && custData.data.allowed_tops) {
                        setAllowedTops(custData.data.allowed_tops);
                    } else {
                        setAllowedTops([]);
                    }
                }

                setSourceType('manual');
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
            const response = await fetch(`/api/ar-invoices/${id}`, { method: 'DELETE' });
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

    const handlePost = async (id) => {
        if (!confirm('Post Invoice ini?')) return;
        try {
            const response = await fetch(`/api/ar-invoices/${id}/post`, { method: 'PUT' });
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

    const handleUnpost = async (id) => {
        if (!confirm('Unpost Invoice ini? Status kembali ke Draft.')) return;
        try {
            const response = await fetch(`/api/ar-invoices/${id}/unpost`, { method: 'PUT' });
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
        if (field === 'item_id') {
            const item = items.find(i => i.id === parseInt(value));
            if (item) newItems[index].description = item.name;
        }
        setFormData({ ...formData, items: newItems });
    };

    const resetForm = () => {
        setEditingItem(null);
        setSourceType('shipment');
        setAllowedTops([]);
        setFormData({
            doc_number: 'AUTO',
            doc_date: new Date().toISOString().split('T')[0],
            due_date: new Date().toISOString().split('T')[0],
            transcode_id: '',
            partner_id: '',
            shipment_id: '',
            status: 'Draft',
            notes: '',
            items: [],
            tax_type: 'Exclude',
            sales_person_id: '',
            payment_term_id: '',
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
                <h1 className="page-title">AR Invoice / Tagihan Penjualan</h1>
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
                                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
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
                                                checked={sourceType === 'shipment'}
                                                onChange={() => {
                                                    setSourceType('shipment');
                                                    setFormData(prev => ({ ...prev, shipment_id: '', items: [] }));
                                                }}
                                                disabled={editingItem || formData.status !== 'Draft'}
                                            />
                                            <span style={{ marginLeft: '5px' }}>Dari Shipment</span>
                                        </label>
                                        <label style={{ display: 'inline-flex', alignItems: 'center' }}>
                                            <input
                                                type="radio"
                                                name="sourceType"
                                                checked={sourceType === 'manual'}
                                                onChange={() => {
                                                    setSourceType('manual');
                                                    setFormData(prev => ({ ...prev, shipment_id: '', items: [] }));
                                                }}
                                                disabled={editingItem || formData.status !== 'Draft'}
                                            />
                                            <span style={{ marginLeft: '5px' }}>Input Manual</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                {sourceType === 'shipment' && (
                                    <div className="form-group">
                                        <label>Shipment (Active)</label>
                                        <select
                                            value={formData.shipment_id}
                                            onChange={(e) => handleSelectShipment(e.target.value)}
                                            disabled={editingItem || formData.status !== 'Draft'}
                                        >
                                            <option value="">-- Pilih Shipment --</option>
                                            {shipments.map(shp => (
                                                <option key={shp.id} value={shp.id}>
                                                    {shp.doc_number} - {shp.partner_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Customer</label>
                                    <select
                                        value={formData.partner_id}
                                        onChange={(e) => handleCustomerChange(e.target.value)}
                                        required
                                        disabled={formData.shipment_id || formData.status !== 'Draft'}
                                    >
                                        <option value="">-- Pilih Customer --</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Sales Person</label>
                                    <select
                                        value={formData.sales_person_id}
                                        onChange={(e) => setFormData({ ...formData, sales_person_id: e.target.value })}
                                        disabled={formData.status !== 'Draft'}
                                    >
                                        <option value="">-- Pilih Sales Person --</option>
                                        {salesPersons.map(sp => (
                                            <option key={sp.id} value={sp.id}>{sp.code} - {sp.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Term of Payment</label>
                                    <select
                                        value={formData.payment_term_id}
                                        onChange={(e) => setFormData({ ...formData, payment_term_id: e.target.value })}
                                        disabled={formData.status !== 'Draft'}
                                    >
                                        <option value="">-- Pilih Term --</option>
                                        {paymentTerms
                                            .filter(pt => allowedTops.length === 0 || allowedTops.includes(pt.id))
                                            .map(pt => (
                                                <option key={pt.id} value={pt.id}>{pt.code} - {pt.days} Hari</option>
                                            ))
                                        }
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
                                                    {sourceType === 'shipment' && !formData.shipment_id ? 'Pilih Shipment terlebih dahulu.' : 'Belum ada item.'}
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
                                                            disabled={formData.shipment_id || formData.status !== 'Draft'}
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
                                                                    disabled={formData.status !== 'Draft' || !!formData.shipment_id}
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
                                <th>No. Shipment</th>
                                <th>jth Tempo</th>
                                <th>Customer</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada AR Invoice</td>
                                </tr>
                            ) : (
                                invoices.map(inv => (
                                    <tr key={inv.id}>
                                        <td>{formatDate(inv.doc_date)}</td>
                                        <td><strong>{inv.doc_number}</strong></td>
                                        <td>{inv.shipment_number || '-'}</td>
                                        <td>{inv.due_date ? formatDate(inv.due_date) : '-'}</td>
                                        <td>{inv.partner_name || '-'}</td>
                                        <td>
                                            <span className={`badge ${inv.status === 'Draft' ? 'badge-warning' : 'badge-success'}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {inv.status === 'Draft' ? (
                                                <>
                                                    <button className="btn-icon" onClick={() => handlePost(inv.id)} title="Post" style={{ color: 'green', marginRight: '5px' }}>✅</button>
                                                    <button className="btn-icon" onClick={() => handleEdit(inv.id)} title="Edit" style={{ marginRight: '5px' }}>✏️</button>
                                                    <button className="btn-icon" onClick={() => handleDelete(inv.id)} title="Hapus">🗑️</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button className="btn-icon" onClick={() => handleUnpost(inv.id)} title="Unpost" style={{ color: 'orange', marginRight: '5px' }}>🔓</button>
                                                    <button className="btn-icon" onClick={() => handleEdit(inv.id)} title="Lihat Detail" style={{ color: 'blue' }}>👁️</button>
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

export default ARInvoiceList;


