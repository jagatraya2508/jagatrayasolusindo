import { useState, useEffect } from 'react';

function SalesPersonList() {
    const [salesPersons, setSalesPersons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [areas, setAreas] = useState([]);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        phone: '',
        email: '',
        sales_area_id: '',
        active: 'Y'
    });

    useEffect(() => {
        fetchData();
        fetchAreas();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/salespersons');
            const data = await response.json();
            if (data.success) {
                setSalesPersons(data.data);
            }
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const fetchAreas = async () => {
        try {
            const response = await fetch('/api/sales-areas');
            const data = await response.json();
            if (data.success) {
                setAreas(data.data);
            }
        } catch (error) {
            console.error('Error fetching areas:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingItem ? `/api/salespersons/${editingItem.id}` : '/api/salespersons';
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

    const handleEdit = (item) => {
        setEditingItem(item);
        setFormData({
            code: item.code,
            name: item.name,
            phone: item.phone || '',
            email: item.email || '',
            sales_area_id: item.sales_area_id || '',
            active: item.active || 'Y'
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus Sales Person ini?')) return;
        try {
            const response = await fetch(`/api/salespersons/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({ code: '', name: '', phone: '', email: '', sales_area_id: '', active: 'Y' });
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Master Sales Person</h1>
                <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingItem(null); resetForm(); }}>
                    + Tambah Sales Person
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editingItem ? 'Edit Sales Person' : 'Tambah Sales Person Baru'}</h3>
                            <button className="modal-close" onClick={() => { setShowForm(false); setEditingItem(null); }}>×</button>
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
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Sales Area</label>
                                    <select
                                        value={formData.sales_area_id}
                                        onChange={(e) => setFormData({ ...formData, sales_area_id: e.target.value })}
                                    >
                                        <option value="">-- Pilih Area --</option>
                                        {areas.map(a => (
                                            <option key={a.id} value={a.id}>{a.level}: {a.name}</option>
                                        ))}
                                    </select>
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
                                <th>Kode</th>
                                <th>Nama</th>
                                <th>Telepon</th>
                                <th>Email</th>
                                <th>Sales Area</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {salesPersons.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Belum ada data Sales Person
                                    </td>
                                </tr>
                            ) : (
                                salesPersons.map((sp) => (
                                    <tr key={sp.id}>
                                        <td><strong>{sp.code}</strong></td>
                                        <td>{sp.name}</td>
                                        <td>{sp.phone}</td>
                                        <td>{sp.email}</td>
                                        <td>{sp.sales_area_name || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`badge ${sp.active === 'Y' ? 'badge-success' : 'badge-warning'}`}>
                                                {sp.active === 'Y' ? 'Aktif' : 'Non-Aktif'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn-icon" onClick={() => handleEdit(sp)} title="Edit">✏️</button>
                                            <button className="btn-icon" onClick={() => handleDelete(sp.id)} title="Hapus">🗑️</button>
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

export default SalesPersonList;
