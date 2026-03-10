import { useState, useEffect } from 'react';

function ItemList() {
    const [items, setItems] = useState([]);
    const [units, setUnits] = useState([]);
    const [conversions, setConversions] = useState([]); // New state for conversion codes
    const [unitConversions, setUnitConversions] = useState([]); // New state for full conversion data
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [groups, setGroups] = useState([]);
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [models, setModels] = useState([]);
    const [formData, setFormData] = useState({
        code: '', name: '', unit: '', standard_cost: 0, standard_price: 0,
        group_id: '', category_id: '', brand_id: '', model_id: '', conversion_code: ''
    });

    useEffect(() => {
        fetchItems();
        fetchUnits();
        fetchDropdowns();
        fetchConversions();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const [gRes, cRes, bRes, mRes] = await Promise.all([
                fetch('/api/item-groups'), fetch('/api/item-categories'),
                fetch('/api/item-brands'), fetch('/api/item-models')
            ]);
            const [g, c, b, m] = await Promise.all([gRes.json(), cRes.json(), bRes.json(), mRes.json()]);
            if (g.success) setGroups(g.data.filter(x => x.active === 'Y'));
            if (c.success) setCategories(c.data.filter(x => x.active === 'Y'));
            if (b.success) setBrands(b.data.filter(x => x.active === 'Y'));
            if (m.success) setModels(m.data.filter(x => x.active === 'Y'));
        } catch (err) { console.error('Error fetching dropdowns:', err); }
    };

    const fetchItems = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/items');
            const data = await response.json();
            if (data.success) {
                setItems(data.data);
            }
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const fetchUnits = async () => {
        try {
            const response = await fetch('/api/units');
            const data = await response.json();
            if (data.success) {
                setUnits(data.data);
            }
        } catch (error) {
            console.error('Error fetching units:', error);
        }
    };

    const fetchConversions = async () => {
        try {
            const response = await fetch('/api/unit-conversions');
            const data = await response.json();
            if (data.success) {
                // Extract unique conversion codes
                const activeConversions = data.data.filter(c => c.active === 'Y');
                const uniqueCodes = [...new Set(activeConversions.map(c => c.conversion_code))];
                setConversions(uniqueCodes);
                setUnitConversions(activeConversions);
            }
        } catch (error) {
            console.error('Error fetching conversions:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items';
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
                fetchItems();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData({
            code: item.code, name: item.name, unit: item.unit || '',
            standard_cost: item.standard_cost || 0, standard_price: item.standard_price || 0,
            group_id: item.group_id || '', category_id: item.category_id || '',
            brand_id: item.brand_id || '', model_id: item.model_id || '',
            conversion_code: item.conversion_code || ''
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus item ini?')) return;
        try {
            const response = await fetch(`/api/items/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchItems();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({ code: '', name: '', unit: '', standard_cost: 0, standard_price: 0, group_id: '', category_id: '', brand_id: '', model_id: '', conversion_code: '' });
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value || 0);
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Master Item</h1>
                <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingItem(null); resetForm(); }}>
                    + Tambah Item
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editingItem ? 'Edit Item' : 'Tambah Item Baru'}</h3>
                            <button className="modal-close" onClick={() => { setShowForm(false); setEditingItem(null); }}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Kode Item</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Nama Item</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Kode Konversi (Opsional)</label>
                                    <select
                                        value={formData.conversion_code || ''}
                                        onChange={e => setFormData({ ...formData, conversion_code: e.target.value, unit: '' })}
                                    >
                                        <option value="">-- Tidak Ada --</option>
                                        {conversions.map(code => <option key={code} value={code}>{code}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Satuan Base</label>
                                    <select
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Pilih Satuan --</option>
                                        {(() => {
                                            if (formData.conversion_code) {
                                                const relatedConversions = unitConversions.filter(c => c.conversion_code === formData.conversion_code);
                                                const relatedUnits = new Set();
                                                relatedConversions.forEach(c => {
                                                    relatedUnits.add(c.from_unit_code);
                                                    relatedUnits.add(c.to_unit_code);
                                                });
                                                return units.filter(u => relatedUnits.has(u.code)).map(u => (
                                                    <option key={u.id} value={u.code}>{u.code} - {u.name}</option>
                                                ));
                                            }
                                            return units.map(u => (
                                                <option key={u.id} value={u.code}>{u.code} - {u.name}</option>
                                            ));
                                        })()}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Group</label>
                                    <select value={formData.group_id} onChange={e => setFormData({ ...formData, group_id: e.target.value })}>
                                        <option value="">-- Tanpa Group --</option>
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.code} - {g.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Category</label>
                                    <select value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })}>
                                        <option value="">-- Tanpa Category --</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Brand</label>
                                    <select value={formData.brand_id} onChange={e => setFormData({ ...formData, brand_id: e.target.value })}>
                                        <option value="">-- Tanpa Brand --</option>
                                        {brands.map(b => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Model</label>
                                    <select value={formData.model_id} onChange={e => setFormData({ ...formData, model_id: e.target.value })}>
                                        <option value="">-- Tanpa Model --</option>
                                        {models.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Harga Beli (Cost)</label>
                                    <input
                                        type="number"
                                        value={formData.standard_cost}
                                        onChange={(e) => setFormData({ ...formData, standard_cost: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Harga Jual (Price)</label>
                                    <input
                                        type="number"
                                        value={formData.standard_price}
                                        onChange={(e) => setFormData({ ...formData, standard_price: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
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
                    <div className="loading">
                        <div className="loading-spinner"></div>
                        <p>Memuat data...</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Kode</th>
                                <th>Nama Item</th>
                                <th>Group</th>
                                <th>Category</th>
                                <th>Brand</th>
                                <th>Model</th>
                                <th>Satuan</th>
                                <th>Kode Konv.</th>
                                <th style={{ textAlign: 'right' }}>Harga Beli</th>
                                <th style={{ textAlign: 'right' }}>Harga Jual</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Belum ada data item
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr key={item.id}>
                                        <td><strong>{item.code}</strong></td>
                                        <td>{item.name}</td>
                                        <td>{item.group_name || '-'}</td>
                                        <td>{item.category_name || '-'}</td>
                                        <td>{item.brand_name || '-'}</td>
                                        <td>{item.model_name || '-'}</td>
                                        <td><span className="badge badge-info">{item.unit}</span></td>
                                        <td>{item.conversion_code ? <strong>{item.conversion_code}</strong> : '-'}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.standard_cost)}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.standard_price)}</td>
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            <button className="btn-icon" onClick={() => handleEdit(item)} title="Edit">✏️</button>
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

export default ItemList;
