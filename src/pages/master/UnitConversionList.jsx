import { useState, useEffect } from 'react';

function UnitConversionList() {
    const [conversions, setConversions] = useState([]);
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        conversion_code: '',
        from_unit_id: '',
        to_unit_id: '',
        conversion_factor: '',
        description: '',
        active: 'Y'
    });

    useEffect(() => {
        fetchConversions();
        fetchUnits();
    }, []);

    const fetchConversions = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/unit-conversions');
            const data = await response.json();
            if (data.success) {
                setConversions(data.data);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingItem ? `/api/unit-conversions/${editingItem.id}` : '/api/unit-conversions';
            const method = editingItem ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    conversion_factor: parseFloat(formData.conversion_factor)
                })
            });

            const data = await response.json();
            if (data.success) {
                alert(data.message);
                setShowForm(false);
                setEditingItem(null);
                resetForm();
                fetchConversions();
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
            conversion_code: item.conversion_code || '',
            from_unit_id: item.from_unit_id,
            to_unit_id: item.to_unit_id,
            conversion_factor: item.conversion_factor,
            description: item.description || '',
            active: item.active || 'Y'
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus konversi satuan ini?')) return;
        try {
            const response = await fetch(`/api/unit-conversions/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchConversions();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            conversion_code: '',
            from_unit_id: '',
            to_unit_id: '',
            conversion_factor: '',
            description: '',
            active: 'Y'
        });
    };

    const getUnitLabel = (id) => {
        const unit = units.find(u => u.id === parseInt(id));
        return unit ? `${unit.code} (${unit.name})` : '-';
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Konversi Satuan</h1>
                <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingItem(null); resetForm(); }}>
                    + Tambah Konversi
                </button>
            </div>

            {/* Info Card */}
            <div className="card" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4338ca' }}>
                    <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
                    <span style={{ fontSize: '0.9rem' }}>
                        Definisikan konversi antar satuan. Contoh: <strong>1 BOX = 12 PCS</strong>.
                        Konversi ini akan digunakan pada transaksi agar bisa input menggunakan satuan besar maupun kecil.
                    </span>
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editingItem ? 'Edit Konversi Satuan' : 'Tambah Konversi Satuan'}</h3>
                            <button className="modal-close" onClick={() => { setShowForm(false); setEditingItem(null); }}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Kode Konversi</label>
                                <input
                                    type="text"
                                    value={formData.conversion_code}
                                    onChange={(e) => setFormData({ ...formData, conversion_code: e.target.value.toUpperCase() })}
                                    placeholder="Contoh: BOX12, PACK06"
                                    required
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Dari Satuan (Satuan Besar)</label>
                                    <select
                                        value={formData.from_unit_id}
                                        onChange={(e) => setFormData({ ...formData, from_unit_id: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Pilih Satuan --</option>
                                        {units.map(u => (
                                            <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Ke Satuan (Satuan Kecil)</label>
                                    <select
                                        value={formData.to_unit_id}
                                        onChange={(e) => setFormData({ ...formData, to_unit_id: e.target.value })}
                                        required
                                    >
                                        <option value="">-- Pilih Satuan --</option>
                                        {units.map(u => (
                                            <option key={u.id} value={u.id}>{u.code} - {u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Faktor Konversi</label>
                                <input
                                    type="number"
                                    step="0.000001"
                                    min="0.000001"
                                    value={formData.conversion_factor}
                                    onChange={(e) => setFormData({ ...formData, conversion_factor: e.target.value })}
                                    placeholder="Contoh: 12 (artinya 1 satuan besar = 12 satuan kecil)"
                                    required
                                />
                                {formData.from_unit_id && formData.to_unit_id && formData.conversion_factor && (
                                    <div style={{
                                        marginTop: '0.5rem', padding: '0.5rem',
                                        backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
                                        borderRadius: '6px', color: '#166534', fontSize: '0.9rem'
                                    }}>
                                        ✅ <strong>1 {getUnitLabel(formData.from_unit_id)}</strong> = <strong>{formData.conversion_factor} {getUnitLabel(formData.to_unit_id)}</strong>
                                    </div>
                                )}
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Keterangan</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Keterangan (opsional)"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select
                                        value={formData.active}
                                        onChange={(e) => setFormData({ ...formData, active: e.target.value })}
                                    >
                                        <option value="Y">Aktif</option>
                                        <option value="N">Non-Aktif</option>
                                    </select>
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
                                <th>Kode Konversi</th>
                                <th>Dari Satuan</th>
                                <th style={{ textAlign: 'center', width: '50px' }}></th>
                                <th>Ke Satuan</th>
                                <th style={{ textAlign: 'center' }}>Faktor</th>
                                <th>Rumus Konversi</th>
                                <th>Keterangan</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'center', width: '100px' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {conversions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Belum ada data konversi satuan. Klik "Tambah Konversi" untuk menambahkan.
                                    </td>
                                </tr>
                            ) : (
                                conversions.map((conv) => (
                                    <tr key={conv.id}>
                                        <td>
                                            <strong>{conv.conversion_code}</strong>
                                        </td>
                                        <td>
                                            <span className="badge badge-info">{conv.from_unit_code}</span>
                                            <span style={{ marginLeft: '0.5rem', color: '#374151' }}>{conv.from_unit_name}</span>
                                        </td>
                                        <td style={{ textAlign: 'center', fontSize: '1.2rem', color: '#6366f1' }}>→</td>
                                        <td>
                                            <span className="badge badge-info">{conv.to_unit_code}</span>
                                            <span style={{ marginLeft: '0.5rem', color: '#374151' }}>{conv.to_unit_name}</span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <strong style={{ fontSize: '1.1rem', color: '#4338ca' }}>{parseFloat(conv.conversion_factor)}</strong>
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: '0.25rem 0.75rem', backgroundColor: '#f0fdf4',
                                                border: '1px solid #bbf7d0', borderRadius: '20px',
                                                fontSize: '0.85rem', color: '#166534'
                                            }}>
                                                1 {conv.from_unit_code} = {parseFloat(conv.conversion_factor)} {conv.to_unit_code}
                                            </span>
                                        </td>
                                        <td style={{ color: '#6b7280' }}>{conv.description || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`badge ${conv.active === 'Y' ? 'badge-success' : 'badge-warning'}`}>
                                                {conv.active === 'Y' ? 'Aktif' : 'Non-Aktif'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn-icon" onClick={() => handleEdit(conv)} title="Edit">✏️</button>
                                            <button className="btn-icon" onClick={() => handleDelete(conv.id)} title="Hapus">🗑️</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div >
        </div >
    );
}

export default UnitConversionList;
