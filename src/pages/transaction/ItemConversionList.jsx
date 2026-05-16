import { useState, useEffect } from 'react';
import { usePeriod } from '../../context/PeriodContext';
import { useAuth } from '../../context/AuthContext';

function ItemConversionList() {
    const { selectedPeriod } = usePeriod();
    const { token } = useAuth();
    const [canApprove, setCanApprove] = useState(false);
    const [conversions, setConversions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [warehouses, setWarehouses] = useState([]); // Kept for reference if needed
    const [locations, setLocations] = useState([]);
    const [items, setItems] = useState([]);
    const [transcodes, setTranscodes] = useState([]);

    const [formData, setFormData] = useState({
        doc_number: 'AUTO',
        doc_date: new Date().toISOString().split('T')[0],
        transcode_id: '',
        notes: '',
        status: 'Draft',
        inputItems: [],
        outputItems: []
    });

    useEffect(() => {
        fetchData();
        fetchMasterData();
        checkApprovalPermission();
    }, [selectedPeriod]);

    const checkApprovalPermission = async () => {
        try {
            const res = await fetch('/api/approval-check/item-conversion', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setCanApprove(data.allowed === true);
        } catch { setCanApprove(false); }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/item-conversions';
            const params = new URLSearchParams();
            if (selectedPeriod) {
                params.append('startDate', new Date(selectedPeriod.start_date).toISOString().split('T')[0]);
                params.append('endDate', new Date(selectedPeriod.end_date).toISOString().split('T')[0]);
            }
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                setConversions(data.data);
            }
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const fetchMasterData = async () => {
        try {
            const [whRes, locRes, itemRes, transRes] = await Promise.all([
                fetch('/api/warehouses'),
                fetch('/api/locations'),
                fetch('/api/items'),
                fetch('/api/transcodes')
            ]);
            const whData = await whRes.json();
            const locData = await locRes.json();
            const itemData = await itemRes.json();
            const transData = await transRes.json();

            if (whData.success) setWarehouses(whData.data);
            if (locData.success) setLocations(locData.data);
            if (itemData.success) setItems(itemData.data);
            if (transData.success) {
                // Filter transcodes for item conversion (nomortranscode = 50)
                setTranscodes(transData.data.filter(t => t.active === 'Y' && t.nomortranscode === 50));
            }
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
            }
        } catch (error) {
            console.error('Error generating number:', error);
        }
    };

    const fetchAverageCost = async (itemId, warehouseId) => {
        try {
            const response = await fetch(`/api/items/${itemId}/average-cost?warehouse_id=${warehouseId}`);
            const data = await response.json();
            return data.average_cost || 0;
        } catch (error) {
            console.error('Error fetching average cost:', error);
            return 0;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingItem ? `/api/item-conversions/${editingItem}` : '/api/item-conversions';
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
        try {
            const response = await fetch(`/api/item-conversions/${id}`);
            const data = await response.json();
            if (data.success) {
                const conv = data.data;
                const inputItems = conv.details.filter(d => d.detail_type === 'INPUT').map(d => ({
                    item_id: d.item_id,
                    quantity: parseFloat(d.quantity),
                    unit_cost: parseFloat(d.unit_cost),
                    amount: parseFloat(d.amount),
                    notes: d.notes || '',
                    location_id: d.location_id || ''
                }));
                const outputItems = conv.details.filter(d => d.detail_type === 'OUTPUT').map(d => ({
                    item_id: d.item_id,
                    quantity: parseFloat(d.quantity),
                    unit_cost: parseFloat(d.unit_cost),
                    amount: parseFloat(d.amount),
                    notes: d.notes || '',
                    location_id: d.location_id || ''
                }));

                setFormData({
                    doc_number: conv.doc_number,
                    doc_date: new Date(conv.doc_date).toISOString().split('T')[0],
                    transcode_id: conv.transcode_id || '',
                    notes: conv.notes || '',
                    status: conv.status,
                    inputItems,
                    outputItems
                });
                setEditingItem(id);
                setShowForm(true);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus Konversi ini?')) return;
        try {
            const response = await fetch(`/api/item-conversions/${id}`, { method: 'DELETE' });
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

    const handleApprove = async (id) => {
        if (!confirm('Are you sure you want to approve this conversion?')) return;
        try {
            const response = await fetch(`/api/item-conversions/${id}/approve`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handlePost = async (id) => {
        if (!confirm('Post Konversi ini? Stok akan diupdate.')) return;
        try {
            const response = await fetch(`/api/item-conversions/${id}/post`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handleUnpost = async (id) => {
        if (!confirm('Unpost Konversi ini? Stok akan dikembalikan dan jurnal dihapus.')) return;
        try {
            const response = await fetch(`/api/item-conversions/${id}/unpost`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handleUnapprove = async (id) => {
        if (!confirm('Are you sure you want to unapprove this conversion?')) return;
        try {
            const response = await fetch(`/api/item-conversions/${id}/unapprove`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
            else { alert('Error: ' + (data.reason || data.error)); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handleAddInputItem = () => {
        setFormData(prev => ({
            ...prev,
            inputItems: [...prev.inputItems, { item_id: '', quantity: 1, unit_cost: 0, amount: 0, notes: '', location_id: '' }]
        }));
    };

    const handleAddOutputItem = () => {
        setFormData(prev => ({
            ...prev,
            outputItems: [...prev.outputItems, { item_id: '', quantity: 1, unit_cost: 0, amount: 0, notes: '', location_id: '' }]
        }));
    };

    const handleRemoveInputItem = (index) => {
        setFormData(prev => ({
            ...prev,
            inputItems: prev.inputItems.filter((_, i) => i !== index)
        }));
    };

    const handleRemoveOutputItem = (index) => {
        setFormData(prev => ({
            ...prev,
            outputItems: prev.outputItems.filter((_, i) => i !== index)
        }));
    };

    const handleInputItemChange = async (index, field, value) => {
        const newItems = [...formData.inputItems];
        newItems[index][field] = value;

        // Auto-fetch average cost when item or location changes
        if ((field === 'item_id' || field === 'location_id') && newItems[index].item_id && newItems[index].location_id) {
            // Find warehouse from location
            const loc = locations.find(l => l.id == newItems[index].location_id);
            if (loc && loc.warehouse_id) {
                const avgCost = await fetchAverageCost(newItems[index].item_id, loc.warehouse_id);
                newItems[index].unit_cost = avgCost;
                newItems[index].amount = parseFloat(newItems[index].quantity || 0) * avgCost;
            }
        }

        // Recalculate amount
        if (field === 'quantity' || field === 'unit_cost') {
            newItems[index].amount = parseFloat(newItems[index].quantity || 0) * parseFloat(newItems[index].unit_cost || 0);
        }

        setFormData({ ...formData, inputItems: newItems });
    };

    const handleOutputItemChange = (index, field, value) => {
        const newItems = [...formData.outputItems];
        newItems[index][field] = value;

        // Recalculate amount
        if (field === 'quantity' || field === 'unit_cost') {
            newItems[index].amount = parseFloat(newItems[index].quantity || 0) * parseFloat(newItems[index].unit_cost || 0);
        }

        setFormData({ ...formData, outputItems: newItems });
    };

    // Auto-calculate output cost based on total input cost
    const handleDistributeOutputCost = () => {
        const totalInputCost = calculateTotalInput();
        const totalOutputQty = formData.outputItems.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);

        if (totalOutputQty > 0) {
            const costPerUnit = totalInputCost / totalOutputQty;
            const newOutputItems = formData.outputItems.map(item => ({
                ...item,
                unit_cost: costPerUnit,
                amount: parseFloat(item.quantity || 0) * costPerUnit
            }));
            setFormData(prev => ({ ...prev, outputItems: newOutputItems }));
        }
    };

    const resetForm = () => {
        setEditingItem(null);
        setFormData({
            doc_number: 'AUTO',
            doc_date: new Date().toISOString().split('T')[0],
            transcode_id: '',
            notes: '',
            status: 'Draft',
            inputItems: [],
            outputItems: []
        });
    };

    const formatDate = (date) => new Date(date).toLocaleDateString('id-ID');
    const formatMoney = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);

    const calculateTotalInput = () => {
        return formData.inputItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    };

    const calculateTotalOutput = () => {
        return formData.outputItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    };

    const getStatusBadge = (status) => {
        const badges = {
            'Draft': 'badge-warning',
            'Posted': 'badge-success'
        };
        return badges[status] || 'badge-secondary';
    };

    const renderItemSection = (type, items, handleChange, handleAdd, handleRemove) => (
        <div className="form-section" style={{ marginBottom: '1.5rem' }}>
            <div className="form-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: 0 }}>{type === 'input' ? '📥 Item Input (Bahan)' : '📤 Item Output (Hasil)'}</h4>
                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleAdd}
                    disabled={formData.status !== 'Draft'}
                >
                    + Tambah Item
                </button>
            </div>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th style={{ width: '100px' }}>Qty</th>
                        <th style={{ width: '150px' }}>Unit Cost</th>
                        <th style={{ width: '150px' }}>Total</th>
                        <th style={{ width: '50px' }}></th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>
                                Belum ada item.
                            </td>
                        </tr>
                    ) : (
                        items.map((item, idx) => (
                            <tr key={idx}>
                                <td>
                                    <select
                                        value={item.item_id}
                                        onChange={(e) => handleChange(idx, 'item_id', e.target.value)}
                                        style={{ width: '100%' }}
                                        disabled={formData.status !== 'Draft'}
                                        required
                                    >
                                        <option value="">-- Pilih Item --</option>
                                        {items.length > 0 && items.map(i => (
                                            <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="0.0001"
                                        step="any"
                                        value={item.quantity}
                                        onChange={(e) => handleChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
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
                                        value={item.unit_cost}
                                        onChange={(e) => handleChange(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                                        required
                                        style={{ width: '100%' }}
                                        disabled={formData.status !== 'Draft'}
                                    />
                                </td>
                                <td>
                                    {formatMoney(item.amount || 0)}
                                </td>
                                <td>
                                    <button type="button" className="btn-icon" onClick={() => handleRemove(idx)} disabled={formData.status !== 'Draft'}>🗑️</button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
                <tfoot>
                    <tr style={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                        <td colSpan="3" style={{ textAlign: 'right' }}>Total {type === 'input' ? 'Input' : 'Output'}:</td>
                        <td>{formatMoney(type === 'input' ? calculateTotalInput() : calculateTotalOutput())}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Konversi Item</h1>
                    <p style={{ color: '#666', margin: 0 }}>Proses produksi sederhana: gabung/pecah item</p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                    + Buat Konversi Baru
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal modal-large" style={{ maxWidth: '1000px' }}>
                        <div className="modal-header">
                            <h3>{editingItem ? 'Edit Konversi' : 'Buat Konversi Baru'}</h3>
                            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>No. Dokumen</label>
                                    <input
                                        type="text"
                                        value={formData.doc_number}
                                        readOnly
                                        placeholder="Otomatis"
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
                                    <label>Tanggal</label>
                                    <input
                                        type="date"
                                        value={formData.doc_date}
                                        onChange={(e) => setFormData({ ...formData, doc_date: e.target.value })}
                                        required
                                        disabled={formData.status !== 'Draft'}
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group" style={{ width: '100%' }}>
                                    <label>Keterangan</label>
                                    <input
                                        type="text"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        disabled={formData.status !== 'Draft'}
                                    />
                                </div>
                            </div>

                            {/* Item Input Section */}
                            <div className="form-section" style={{ marginBottom: '1.5rem' }}>
                                <div className="form-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', backgroundColor: '#e3f2fd', padding: '0.5rem', borderRadius: '4px' }}>
                                    <h4 style={{ margin: 0, color: '#1565c0' }}>📥 Item Input (Bahan - Stok akan berkurang)</h4>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={handleAddInputItem}
                                        disabled={formData.status !== 'Draft'}
                                    >
                                        + Tambah Bahan
                                    </button>
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th style={{ width: '200px' }}>Lokasi</th>
                                            <th style={{ width: '100px' }}>Qty</th>
                                            <th style={{ width: '150px' }}>Unit Cost (Avg)</th>
                                            <th style={{ width: '150px' }}>Total</th>
                                            <th style={{ width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.inputItems.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>
                                                    Tambahkan item bahan yang akan dikonversi.
                                                </td>
                                            </tr>
                                        ) : (
                                            formData.inputItems.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <select
                                                            value={item.item_id}
                                                            onChange={(e) => handleInputItemChange(idx, 'item_id', e.target.value)}
                                                            style={{ width: '100%' }}
                                                            disabled={formData.status !== 'Draft'}
                                                            required
                                                        >
                                                            <option value="">-- Pilih Item --</option>
                                                            {items.map(i => (
                                                                <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={item.location_id}
                                                            onChange={(e) => handleInputItemChange(idx, 'location_id', e.target.value)}
                                                            style={{ width: '100%' }}
                                                            disabled={formData.status !== 'Draft'}
                                                            required
                                                        >
                                                            <option value="">-- Pilih Lokasi --</option>
                                                            {locations.map(l => (
                                                                <option key={l.id} value={l.id}>{l.code} - {l.description || l.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0.0001"
                                                            step="any"
                                                            value={item.quantity}
                                                            onChange={(e) => handleInputItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
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
                                                            value={item.unit_cost}
                                                            onChange={(e) => handleInputItemChange(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                                                            required
                                                            style={{ width: '100%' }}
                                                            disabled={formData.status !== 'Draft'}
                                                        />
                                                    </td>
                                                    <td>{formatMoney(item.amount || 0)}</td>
                                                    <td>
                                                        <button type="button" className="btn-icon" onClick={() => handleRemoveInputItem(idx)} disabled={formData.status !== 'Draft'}>🗑️</button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ fontWeight: 'bold', backgroundColor: '#e3f2fd' }}>
                                            <td colSpan="4" style={{ textAlign: 'right' }}>Total Biaya Bahan:</td>
                                            <td>{formatMoney(calculateTotalInput())}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Item Output Section */}
                            <div className="form-section" style={{ marginBottom: '1.5rem' }}>
                                <div className="form-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', backgroundColor: '#e8f5e9', padding: '0.5rem', borderRadius: '4px' }}>
                                    <h4 style={{ margin: 0, color: '#2e7d32' }}>📤 Item Output (Hasil - Stok akan bertambah)</h4>
                                    <div>
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            onClick={handleDistributeOutputCost}
                                            disabled={formData.status !== 'Draft' || formData.outputItems.length === 0}
                                            style={{ marginRight: '0.5rem' }}
                                            title="Distribusikan total biaya bahan ke semua output berdasarkan kuantitas"
                                        >
                                            🔄 Hitung Biaya
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline"
                                            onClick={handleAddOutputItem}
                                            disabled={formData.status !== 'Draft'}
                                        >
                                            + Tambah Hasil
                                        </button>
                                    </div>
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th style={{ width: '200px' }}>Lokasi</th>
                                            <th style={{ width: '100px' }}>Qty</th>
                                            <th style={{ width: '150px' }}>Unit Cost</th>
                                            <th style={{ width: '150px' }}>Total</th>
                                            <th style={{ width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.outputItems.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>
                                                    Tambahkan item hasil konversi.
                                                </td>
                                            </tr>
                                        ) : (
                                            formData.outputItems.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <select
                                                            value={item.item_id}
                                                            onChange={(e) => handleOutputItemChange(idx, 'item_id', e.target.value)}
                                                            style={{ width: '100%' }}
                                                            disabled={formData.status !== 'Draft'}
                                                            required
                                                        >
                                                            <option value="">-- Pilih Item --</option>
                                                            {items.map(i => (
                                                                <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={item.location_id}
                                                            onChange={(e) => handleOutputItemChange(idx, 'location_id', e.target.value)}
                                                            style={{ width: '100%' }}
                                                            disabled={formData.status !== 'Draft'}
                                                            required
                                                        >
                                                            <option value="">-- Pilih Lokasi --</option>
                                                            {locations.map(l => (
                                                                <option key={l.id} value={l.id}>{l.code} - {l.description || l.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0.0001"
                                                            step="any"
                                                            value={item.quantity}
                                                            onChange={(e) => handleOutputItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
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
                                                            value={item.unit_cost}
                                                            onChange={(e) => handleOutputItemChange(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                                                            required
                                                            style={{ width: '100%' }}
                                                            disabled={formData.status !== 'Draft'}
                                                        />
                                                    </td>
                                                    <td>{formatMoney(item.amount || 0)}</td>
                                                    <td>
                                                        <button type="button" className="btn-icon" onClick={() => handleRemoveOutputItem(idx)} disabled={formData.status !== 'Draft'}>🗑️</button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ fontWeight: 'bold', backgroundColor: '#e8f5e9' }}>
                                            <td colSpan="4" style={{ textAlign: 'right' }}>Total Nilai Output:</td>
                                            <td>{formatMoney(calculateTotalOutput())}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Summary */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: '1rem',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '4px',
                                marginBottom: '1rem'
                            }}>
                                <div>
                                    <strong>Total Input:</strong> {formatMoney(calculateTotalInput())}
                                </div>
                                <div>
                                    <strong>Total Output:</strong> {formatMoney(calculateTotalOutput())}
                                </div>
                                <div style={{
                                    color: calculateTotalOutput() - calculateTotalInput() >= 0 ? 'green' : 'red'
                                }}>
                                    <strong>Selisih:</strong> {formatMoney(calculateTotalOutput() - calculateTotalInput())}
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                                    {formData.status !== 'Draft' ? 'Tutup' : 'Batal'}
                                </button>
                                {formData.status === 'Draft' && (
                                    <button type="submit" className="btn btn-primary">
                                        {editingItem ? 'Update Konversi' : 'Simpan Konversi'}
                                    </button>
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
                                <th style={{ textAlign: 'right' }}>Input</th>
                                <th style={{ textAlign: 'right' }}>Output</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {conversions.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada Konversi Item</td>
                                </tr>
                            ) : (
                                conversions.map(conv => (
                                    <tr key={conv.id}>
                                        <td>{formatDate(conv.doc_date)}</td>
                                        <td><strong>{conv.doc_number}</strong></td>
                                        <td style={{ textAlign: 'right' }}>{formatMoney(parseFloat(conv.total_input_amount) || 0)}</td>
                                        <td style={{ textAlign: 'right' }}>{formatMoney(parseFloat(conv.total_output_amount) || 0)}</td>
                                        <td>
                                            <span className={`badge ${conv.status === 'Draft' ? 'badge-warning' : (conv.status.startsWith('Pending') ? 'badge-info' : conv.status === 'Approved' ? 'badge-primary' : 'badge-success')}`} style={conv.status === 'Approved' ? { background: '#10b981', color: 'white' } : {}}>
                                                {conv.status === 'Approved' ? '✅ Approved' : conv.status === 'Posted' ? '✓ Posted' : conv.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {conv.status === 'Draft' || conv.status.startsWith('Pending') ? (
                                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                    {canApprove && <button className="btn-icon" onClick={() => handleApprove(conv.id)} title="Approve" style={{ color: 'green' }}>✅</button>}
                                                    {conv.status === 'Draft' && <button className="btn-icon" onClick={() => handleEdit(conv.id)} title="Edit">✏️</button>}
                                                    {conv.status === 'Draft' && <button className="btn-icon" onClick={() => handleDelete(conv.id)} title="Hapus">🗑️</button>}
                                                    {conv.status.startsWith('Pending') && <button className="btn-icon" onClick={() => handleUnapprove(conv.id)} title="Unapprove" style={{ color: 'orange' }}>↩️</button>}
                                                </div>
                                            ) : conv.status === 'Approved' ? (
                                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                    {canApprove && <button className="btn-icon" onClick={() => handlePost(conv.id)} title="Post" style={{ color: 'purple' }}>📤</button>}
                                                    <button className="btn-icon" onClick={() => handleUnapprove(conv.id)} title="Unapprove" style={{ color: 'orange' }}>↩️</button>
                                                    <button className="btn-icon" onClick={() => handleEdit(conv.id)} title="Lihat Detail" style={{ color: 'blue' }}>👁️</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                    <button className="btn-icon" onClick={() => handleUnpost(conv.id)} title="Unpost" style={{ color: 'gray' }}>🔓</button>
                                                    <button className="btn-icon" onClick={() => handleEdit(conv.id)} title="Lihat Detail" style={{ color: 'blue' }}>👁️</button>
                                                </div>
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

export default ItemConversionList;


