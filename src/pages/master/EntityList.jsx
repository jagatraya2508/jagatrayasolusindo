import { useState, useEffect } from 'react';

function EntityList() {
    const [entities, setEntities] = useState([]);
    const [businessTypes, setBusinessTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingEntity, setEditingEntity] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        address: '',
        phone: '',
        email: '',
        tax_id: '',
        active: 'Y',
        business_type_id: ''
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [entRes, btRes] = await Promise.all([
                fetch('/api/entities'),
                fetch('/api/business-types')
            ]);
            
            const entData = await entRes.json();
            const btData = await btRes.json();
            
            if (entData.success) setEntities(entData.data);
            if (btData.success) setBusinessTypes(btData.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
        setLoading(false);
    };

    const fetchEntities = async () => {
        try {
            const response = await fetch('/api/entities');
            const data = await response.json();
            if (data.success) {
                setEntities(data.data);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingEntity ? `/api/entities/${editingEntity.id}` : '/api/entities';
            const method = editingEntity ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (data.success) {
                alert(data.message);
                setShowForm(false);
                setEditingEntity(null);
                resetForm();
                fetchEntities();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleEdit = (entity) => {
        setEditingEntity(entity);
        setFormData({
            code: entity.code,
            name: entity.name,
            address: entity.address || '',
            phone: entity.phone || '',
            email: entity.email || '',
            tax_id: entity.tax_id || '',
            active: entity.active || 'Y',
            business_type_id: entity.business_type_id || ''
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus Entity ini?')) return;
        try {
            const response = await fetch(`/api/entities/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchEntities();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            address: '',
            phone: '',
            email: '',
            tax_id: '',
            active: 'Y',
            business_type_id: ''
        });
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Master Entity</h1>
                <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingEntity(null); resetForm(); }}>
                    + Tambah Entity
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editingEntity ? 'Edit Entity' : 'Tambah Entity Baru'}</h3>
                            <button className="modal-close" onClick={() => { setShowForm(false); setEditingEntity(null); }}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Kode</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Nama</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Alamat</label>
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    rows="3"
                                />
                            </div>
                            <div className="form-group">
                                <label>Jenis Usaha</label>
                                <select
                                    value={formData.business_type_id}
                                    onChange={(e) => setFormData({ ...formData, business_type_id: e.target.value })}
                                >
                                    <option value="">-- Pilih Jenis Usaha --</option>
                                    {businessTypes.map((bt) => (
                                        <option key={bt.id} value={bt.id}>{bt.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Telepon</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>NPWP / Tax ID</label>
                                <input
                                    type="text"
                                    value={formData.tax_id}
                                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={formData.active}
                                    onChange={(e) => setFormData({ ...formData, active: e.target.value })}
                                >
                                    <option value="Y">Active</option>
                                    <option value="N">Inactive</option>
                                </select>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">{editingEntity ? 'Update' : 'Simpan'}</button>
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
                                <th>Nama</th>
                                <th>Jenis Usaha</th>
                                <th>Alamat</th>
                                <th>Telepon</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entities.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Belum ada data Entity
                                    </td>
                                </tr>
                            ) : (
                                entities.map((entity) => (
                                    <tr key={entity.id}>
                                        <td><strong>{entity.code}</strong></td>
                                        <td>{entity.name}</td>
                                        <td>{entity.business_type_name || '-'}</td>
                                        <td>{entity.address}</td>
                                        <td>{entity.phone}</td>
                                        <td>
                                            <span className={`badge ${entity.active === 'Y' ? 'badge-success' : 'badge-danger'}`}>
                                                {entity.active === 'Y' ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn-icon" onClick={() => handleEdit(entity)} title="Edit">✏️</button>
                                            <button className="btn-icon" onClick={() => handleDelete(entity.id)} title="Hapus">🗑️</button>
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

export default EntityList;
