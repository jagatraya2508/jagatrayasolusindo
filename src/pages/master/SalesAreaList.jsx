import { useState, useEffect } from 'react';

function SalesAreaList() {
    const [areas, setAreas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        level: 'Country',
        parent_id: '',
        active: 'Y'
    });

    const levels = [
        { value: 'Country', label: 'Negara' },
        { value: 'Province', label: 'Provinsi' },
        { value: 'City', label: 'Kota' }
    ];

    useEffect(() => {
        fetchAreas();
    }, []);

    const fetchAreas = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/sales-areas');
            const data = await response.json();
            if (data.success) {
                setAreas(data.data);
            }
        } catch (error) {
            console.error('Error fetching sales areas:', error);
        }
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingItem ? `/api/sales-areas/${editingItem.id}` : '/api/sales-areas';
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
                fetchAreas();
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
            code: item.code,
            name: item.name,
            level: item.level,
            parent_id: item.parent_id || '',
            active: item.active || 'Y'
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus sales area ini?')) return;
        try {
            const response = await fetch(`/api/sales-areas/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchAreas();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            level: 'Country',
            parent_id: '',
            active: 'Y'
        });
    };

    const getParentOptions = () => {
        if (formData.level === 'Country') return [];
        if (formData.level === 'Province') {
            return areas.filter(a => a.level === 'Country' && a.id !== editingItem?.id);
        }
        if (formData.level === 'City') {
            return areas.filter(a => a.level === 'Province' && a.id !== editingItem?.id);
        }
        return [];
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Master Sales Area</h1>
                <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingItem(null); resetForm(); }}>
                    + Tambah Area
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editingItem ? 'Edit Sales Area' : 'Tambah Sales Area'}</h3>
                            <button className="modal-close" onClick={() => { setShowForm(false); setEditingItem(null); }}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Kode Area</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    required
                                    style={{ textTransform: 'uppercase' }}
                                    placeholder="Contoh: ID, JABAR, BND"
                                />
                            </div>
                            <div className="form-group">
                                <label>Nama Area</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Contoh: Indonesia, Jawa Barat, Bandung"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Tingkatan</label>
                                    <select
                                        value={formData.level}
                                        onChange={(e) => setFormData({ ...formData, level: e.target.value, parent_id: '' })}
                                        required
                                    >
                                        {levels.map(l => (
                                            <option key={l.value} value={l.value}>{l.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Induk Area (Parent)</label>
                                    <select
                                        value={formData.parent_id}
                                        onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                                        disabled={formData.level === 'Country'}
                                        required={formData.level !== 'Country'}
                                    >
                                        <option value="">-- Pilih Induk Area --</option>
                                        {getParentOptions().map(a => (
                                            <option key={a.id} value={a.id}>{a.level}: {a.name}</option>
                                        ))}
                                    </select>
                                </div>
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
                                <th>Nama Area</th>
                                <th>Tingkatan</th>
                                <th>Induk Area</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'center', width: '100px' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {areas.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Belum ada data sales area. Klik "Tambah Area" untuk menambahkan.
                                    </td>
                                </tr>
                            ) : (
                                areas.map((area) => (
                                    <tr key={area.id}>
                                        <td><strong>{area.code}</strong></td>
                                        <td>{area.name}</td>
                                        <td>
                                            <span className={`badge ${area.level === 'Country' ? 'badge-info' :
                                                    area.level === 'Province' ? 'badge-primary' : 'badge-success'
                                                }`}>
                                                {levels.find(l => l.value === area.level)?.label}
                                            </span>
                                        </td>
                                        <td>{area.parent_name || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`badge ${area.active === 'Y' ? 'badge-success' : 'badge-warning'}`}>
                                                {area.active === 'Y' ? 'Aktif' : 'Non-Aktif'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn-icon" onClick={() => handleEdit(area)} title="Edit">✏️</button>
                                            <button className="btn-icon" onClick={() => handleDelete(area.id)} title="Hapus">🗑️</button>
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

export default SalesAreaList;
