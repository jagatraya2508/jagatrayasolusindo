import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

function CrmQuotationList() {
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const { user } = useAuth();

    const initialFormData = {
        opportunity_id: '', customer_id: '', customer_name: '',
        quotation_date: new Date().toISOString().substring(0, 10), valid_until: '',
        subtotal: 0, discount_pct: 0, discount_amount: 0, tax_pct: 11, tax_amount: 0,
        total: 0, currency_code: 'IDR', status: 'Draft', notes: '', price_list_id: '',
        items: [{ item_id: '', item_code: '', description: '', qty: 1, unit: '', unit_price: 0, discount_pct: 0, total_price: 0 }]
    };
    const [formData, setFormData] = useState(initialFormData);
    const [opportunities, setOpportunities] = useState([]);

    const statusOptions = ['Draft', 'Sent', 'Accepted', 'Rejected'];
    const statusColors = { Draft: '#6b7280', Sent: '#3182ce', Accepted: '#38a169', Rejected: '#e53e3e' };

    const [masterItems, setMasterItems] = useState([]);
    const [priceLists, setPriceLists] = useState([]);
    const [selectedPriceListDetails, setSelectedPriceListDetails] = useState([]);

    useEffect(() => { fetchData(); fetchOpportunities(); fetchMasterItems(); fetchPriceLists(); }, [filterStatus]);

    const fetchMasterItems = async () => {
        try {
            const response = await fetch('/api/items');
            const data = await response.json();
            if (data.success) {
                setMasterItems(data.data.filter(i => i.active !== 'N'));
            }
        } catch (error) { console.error('Error fetching master items:', error); }
    };

    const fetchPriceLists = async () => {
        try {
            const response = await fetch('/api/price-lists-active', { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const data = await response.json();
            if (data.success) setPriceLists(data.data);
        } catch (error) { console.error('Error fetching price lists:', error); }
    };

    const getToken = () => localStorage.getItem('token');

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/crm/quotations?';
            if (filterStatus) url += `status=${filterStatus}&`;
            if (searchTerm) url += `search=${searchTerm}&`;
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const data = await response.json();
            if (data.success) setQuotations(data.data);
        } catch (error) { console.error('Error:', error); }
        setLoading(false);
    };

    const fetchOpportunities = async () => {
        try {
            const response = await fetch('/api/crm/opportunities', { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const data = await response.json();
            if (data.success) setOpportunities(data.data);
        } catch (error) { console.error('Error:', error); }
    };

    const loadQuotation = async (id) => {
        try {
            const response = await fetch(`/api/crm/quotations/${id}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const data = await response.json();
            if (data.success) {
                const q = data.data;
                setEditingItem(q);
                setFormData({
                    opportunity_id: q.opportunity_id || '', customer_id: q.customer_id || '',
                    customer_name: q.customer_name || '',
                    quotation_date: q.quotation_date ? q.quotation_date.substring(0, 10) : '',
                    valid_until: q.valid_until ? q.valid_until.substring(0, 10) : '',
                    subtotal: q.subtotal || 0, discount_pct: q.discount_pct || 0, discount_amount: q.discount_amount || 0,
                    tax_pct: q.tax_pct || 0, tax_amount: q.tax_amount || 0, total: q.total || 0,
                    currency_code: q.currency_code || 'IDR', status: q.status || 'Draft', notes: q.notes || '',
                    price_list_id: q.price_list_id || '',
                    items: (q.items && q.items.length > 0) ? q.items.map(i => ({
                        item_id: i.item_id || '', item_code: i.item_code || '', description: i.description || '', qty: i.qty || 1,
                        unit: i.unit || '', unit_price: i.unit_price || 0, discount_pct: i.discount_pct || 0,
                        total_price: i.total_price || 0
                    })) : [{ item_id: '', item_code: '', description: '', qty: 1, unit: '', unit_price: 0, discount_pct: 0, total_price: 0 }]
                });
                setShowForm(true);
            }
        } catch (error) { console.error('Error:', error); }
    };

    const recalculate = (items, discPct, taxPct) => {
        const subtotal = items.reduce((sum, it) => sum + parseFloat(it.total_price || 0), 0);
        const discAmount = subtotal * (parseFloat(discPct || 0) / 100);
        const afterDisc = subtotal - discAmount;
        const taxAmount = afterDisc * (parseFloat(taxPct || 0) / 100);
        const total = afterDisc + taxAmount;
        return { subtotal, discount_amount: discAmount, tax_amount: taxAmount, total };
    };

    const updateItem = (index, field, value) => {
        const newItems = [...formData.items];
        
        if (field === 'item_id') {
            const selectedItem = masterItems.find(i => String(i.id) === String(value));
            let unitPrice = selectedItem ? (selectedItem.standard_price || 0) : 0;
            let discPctItem = 0;
            
            // Check price from Price List if selected
            if (formData.price_list_id && selectedPriceListDetails.length > 0) {
                const plDetail = selectedPriceListDetails.find(pl => String(pl.item_id) === String(value));
                if (plDetail) {
                    unitPrice = parseFloat(plDetail.price) || unitPrice;
                    discPctItem = parseFloat(plDetail.discount_percent) || 0;
                }
            }
            
            newItems[index] = {
                ...newItems[index],
                item_id: value,
                item_code: selectedItem ? selectedItem.code : '',
                description: selectedItem ? selectedItem.name : '',
                unit: selectedItem ? selectedItem.unit : '',
                unit_price: unitPrice,
                discount_pct: discPctItem,
            };
        } else {
            newItems[index] = { ...newItems[index], [field]: value };
        }
        
        // Recalculate item total
        const qty = parseFloat(newItems[index].qty || 0);
        const unitPrice = parseFloat(newItems[index].unit_price || 0);
        const itemDisc = parseFloat(newItems[index].discount_pct || 0);
        newItems[index].total_price = qty * unitPrice * (1 - itemDisc / 100);
        const calc = recalculate(newItems, formData.discount_pct, formData.tax_pct);
        setFormData({ ...formData, items: newItems, ...calc });
    };

    const addItem = () => {
        setFormData({ ...formData, items: [...formData.items, { item_id: '', item_code: '', description: '', qty: 1, unit: '', unit_price: 0, discount_pct: 0, total_price: 0 }] });
    };

    const removeItem = (index) => {
        if (formData.items.length <= 1) return;
        const newItems = formData.items.filter((_, i) => i !== index);
        const calc = recalculate(newItems, formData.discount_pct, formData.tax_pct);
        setFormData({ ...formData, items: newItems, ...calc });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingItem ? `/api/crm/quotations/${editingItem.id}` : '/api/crm/quotations';
            const method = editingItem ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (data.success) { alert(data.message); setShowForm(false); setEditingItem(null); setFormData(initialFormData); fetchData(); }
            else alert('Error: ' + data.error);
        } catch (error) { alert('Error: ' + error.message); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus Quotation ini?')) return;
        try {
            const response = await fetch(`/api/crm/quotations/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } });
            const data = await response.json();
            if (data.success) { alert(data.message); fetchData(); }
        } catch (error) { alert('Error: ' + error.message); }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('id-ID').format(val || 0);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📋 CRM - Quotation</h1>
                <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingItem(null); setFormData(initialFormData); }}>
                    + Buat Quotation
                </button>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="text" placeholder="Cari nomor, customer..." value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                        style={{ flex: 1, minWidth: '200px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                        style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                        <option value="">Semua Status</option>
                        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="btn btn-outline" onClick={fetchData}>🔍 Cari</button>
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <h3>{editingItem ? 'Edit Quotation' : 'Buat Quotation Baru'}</h3>
                            <button className="modal-close" onClick={() => { setShowForm(false); setEditingItem(null); }}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Customer / Nama Perusahaan *</label>
                                    <input type="text" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Opportunity Terkait</label>
                                    <select value={formData.opportunity_id} onChange={(e) => setFormData({ ...formData, opportunity_id: e.target.value })}>
                                        <option value="">-- Pilih --</option>
                                        {opportunities.map(o => <option key={o.id} value={o.id}>{o.opp_no} - {o.title}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Tanggal Quotation *</label>
                                    <input type="date" value={formData.quotation_date} onChange={(e) => setFormData({ ...formData, quotation_date: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Berlaku Sampai</label>
                                    <input type="date" value={formData.valid_until} onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                                        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Price List (Daftar Harga)</label>
                                    <select value={formData.price_list_id || ''}
                                        onChange={async (e) => {
                                            const val = e.target.value;
                                            if (val) {
                                                try {
                                                    const plRes = await fetch(`/api/price-lists/${val}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
                                                    const plData = await plRes.json();
                                                    if (plData.success && plData.data) {
                                                        const plDetails = plData.data.details || [];
                                                        setSelectedPriceListDetails(plDetails);
                                                        
                                                        const updatedDetails = formData.details.map(d => {
                                                            if (!d.item_id) return d;
                                                            const plItem = plDetails.find(p => p.item_id === parseInt(d.item_id));
                                                            if (plItem) {
                                                                return { ...d, unit_price: parseFloat(plItem.price) || 0, discount_percent: parseFloat(plItem.discount_percent) || 0 };
                                                            }
                                                            return d;
                                                        });
                                                        setFormData(prev => ({ ...prev, price_list_id: val, details: updatedDetails }));
                                                    } else {
                                                        setFormData(prev => ({ ...prev, price_list_id: val }));
                                                    }
                                                } catch (err) { 
                                                    console.error('Error fetching price list', err);
                                                    setFormData(prev => ({ ...prev, price_list_id: val }));
                                                }
                                            } else {
                                                setSelectedPriceListDetails([]);
                                                const updatedDetails = formData.details.map(d => {
                                                    if (!d.item_id) return d;
                                                    const stdItem = items.find(i => i.id === parseInt(d.item_id));
                                                    if (stdItem) {
                                                        return { ...d, unit_price: parseFloat(stdItem.standard_price) || 0, discount_percent: 0 };
                                                    }
                                                    return d;
                                                });
                                                setFormData(prev => ({ ...prev, price_list_id: val, details: updatedDetails }));
                                            }
                                        }}
                                        style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                                        <option value="">-- Harga Standar --</option>
                                        {priceLists.map(pl => (
                                            <option key={pl.id} value={pl.id}>{pl.code} - {pl.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div style={{ marginTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h4 style={{ margin: 0 }}>Detail Item</h4>
                                    <button type="button" className="btn btn-outline" onClick={addItem} style={{ fontSize: '0.85rem' }}>+ Tambah Baris</button>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f3f4f6' }}>
                                            <th style={{ padding: '0.5rem', border: '1px solid #d1d5db', width: '20%' }}>Item (Opsional)</th>
                                            <th style={{ padding: '0.5rem', border: '1px solid #d1d5db', width: '25%' }}>Deskripsi</th>
                                            <th style={{ padding: '0.5rem', border: '1px solid #d1d5db', width: '8%' }}>Qty</th>
                                            <th style={{ padding: '0.5rem', border: '1px solid #d1d5db', width: '8%' }}>Satuan</th>
                                            <th style={{ padding: '0.5rem', border: '1px solid #d1d5db', width: '15%' }}>Harga Satuan</th>
                                            <th style={{ padding: '0.5rem', border: '1px solid #d1d5db', width: '8%' }}>Disc %</th>
                                            <th style={{ padding: '0.5rem', border: '1px solid #d1d5db', width: '12%' }}>Total</th>
                                            <th style={{ padding: '0.5rem', border: '1px solid #d1d5db', width: '4%' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td style={{ padding: '0.3rem', border: '1px solid #d1d5db' }}>
                                                    <select
                                                        value={item.item_id || ''}
                                                        onChange={(e) => updateItem(idx, 'item_id', e.target.value)}
                                                        style={{ width: '100%', padding: '0.3rem', border: '1px solid #e5e7eb', borderRadius: '4px' }}
                                                    >
                                                        <option value="">-- Manual --</option>
                                                        {masterItems.map(mi => (
                                                            <option key={mi.id} value={mi.id}>{mi.code} - {mi.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td style={{ padding: '0.3rem', border: '1px solid #d1d5db' }}>
                                                    <input type="text" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} style={{ width: '100%', padding: '0.3rem', border: '1px solid #e5e7eb', borderRadius: '4px' }} required />
                                                </td>
                                                <td style={{ padding: '0.3rem', border: '1px solid #d1d5db' }}>
                                                    <input type="number" value={item.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)} style={{ width: '100%', padding: '0.3rem', border: '1px solid #e5e7eb', borderRadius: '4px', textAlign: 'right' }} />
                                                </td>
                                                <td style={{ padding: '0.3rem', border: '1px solid #d1d5db' }}>
                                                    <input type="text" value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} style={{ width: '100%', padding: '0.3rem', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
                                                </td>
                                                <td style={{ padding: '0.3rem', border: '1px solid #d1d5db' }}>
                                                    <input type="number" value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} style={{ width: '100%', padding: '0.3rem', border: '1px solid #e5e7eb', borderRadius: '4px', textAlign: 'right' }} />
                                                </td>
                                                <td style={{ padding: '0.3rem', border: '1px solid #d1d5db' }}>
                                                    <input type="number" value={item.discount_pct} onChange={(e) => updateItem(idx, 'discount_pct', e.target.value)} style={{ width: '100%', padding: '0.3rem', border: '1px solid #e5e7eb', borderRadius: '4px', textAlign: 'right' }} />
                                                </td>
                                                <td style={{ padding: '0.3rem', border: '1px solid #d1d5db', textAlign: 'right', fontWeight: '600' }}>
                                                    {formatCurrency(item.total_price)}
                                                </td>
                                                <td style={{ padding: '0.3rem', border: '1px solid #d1d5db', textAlign: 'center' }}>
                                                    <button type="button" onClick={() => removeItem(idx)} style={{ color: '#e53e3e', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals */}
                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <div style={{ width: '300px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                                        <span>Subtotal:</span><strong>Rp {formatCurrency(formData.subtotal)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', alignItems: 'center' }}>
                                        <span>Diskon (%):</span>
                                        <input type="number" value={formData.discount_pct} onChange={(e) => {
                                            const calc = recalculate(formData.items, e.target.value, formData.tax_pct);
                                            setFormData({ ...formData, discount_pct: e.target.value, ...calc });
                                        }} style={{ width: '60px', padding: '0.2rem', textAlign: 'right', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                                        <span>Diskon:</span><span>- Rp {formatCurrency(formData.discount_amount)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', alignItems: 'center' }}>
                                        <span>PPN (%):</span>
                                        <input type="number" value={formData.tax_pct} onChange={(e) => {
                                            const calc = recalculate(formData.items, formData.discount_pct, e.target.value);
                                            setFormData({ ...formData, tax_pct: e.target.value, ...calc });
                                        }} style={{ width: '60px', padding: '0.2rem', textAlign: 'right', border: '1px solid #d1d5db', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0' }}>
                                        <span>PPN:</span><span>Rp {formatCurrency(formData.tax_amount)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '2px solid #1a202c', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                        <span>TOTAL:</span><span>Rp {formatCurrency(formData.total)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label>Catatan</label>
                                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">{editingItem ? 'Update' : 'Simpan'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="card">
                {loading ? (
                    <div className="loading"><div className="loading-spinner"></div><p>Memuat data...</p></div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No. Quotation</th>
                                <th>Customer</th>
                                <th>Tanggal</th>
                                <th>Berlaku s/d</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotations.length === 0 ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada data Quotation</td></tr>
                            ) : (
                                quotations.map((item) => (
                                    <tr key={item.id}>
                                        <td><strong>{item.quot_no}</strong></td>
                                        <td>{item.customer_name}</td>
                                        <td>{item.quotation_date ? new Date(item.quotation_date).toLocaleDateString('id-ID') : '-'}</td>
                                        <td>{item.valid_until ? new Date(item.valid_until).toLocaleDateString('id-ID') : '-'}</td>
                                        <td style={{ textAlign: 'right' }}>Rp {formatCurrency(item.total)}</td>
                                        <td>
                                            <span style={{
                                                padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600',
                                                backgroundColor: `${statusColors[item.status]}20`, color: statusColors[item.status]
                                            }}>{item.status}</span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn-icon" onClick={() => loadQuotation(item.id)} title="Edit">✏️</button>
                                            <button className="btn-icon" onClick={() => handleDelete(item.id)} title="Hapus">🗑️</button>
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

export default CrmQuotationList;
