import { useState, useEffect } from 'react';

function SubWarehouseList() {
    const [subWarehouses, setSubWarehouses] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingSubWarehouse, setEditingSubWarehouse] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        warehouse_id: '',
        parent_id: '',
        active: 'Y'
    });

    useEffect(() => {
        fetchSubWarehouses();
        fetchWarehouses();
    }, []);

    const fetchSubWarehouses = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/sub-warehouses');
            const data = await response.json();
            if (data.success) {
                setSubWarehouses(data.data);
            }
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const fetchWarehouses = async () => {
        try {
            const response = await fetch('/api/warehouses');
            const data = await response.json();
            if (data.success) {
                setWarehouses(data.data);
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingSubWarehouse ? `/api/sub-warehouses/${editingSubWarehouse.id}` : '/api/sub-warehouses';
            const method = editingSubWarehouse ? 'PUT' : 'POST';

            const submitData = {
                ...formData,
                parent_id: formData.parent_id ? parseInt(formData.parent_id) : null,
                warehouse_id: formData.warehouse_id ? parseInt(formData.warehouse_id) : null
            };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData)
            });

            const data = await response.json();
            if (data.success) {
                alert(data.message);
                setShowForm(false);
                setEditingSubWarehouse(null);
                resetForm();
                fetchSubWarehouses();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleEdit = (sw) => {
        setEditingSubWarehouse(sw);
        setFormData({
            code: sw.code,
            name: sw.name,
            warehouse_id: sw.warehouse_id || '',
            parent_id: sw.parent_id || '',
            active: sw.active || 'Y'
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus Sub Warehouse ini?')) return;
        try {
            const response = await fetch(`/api/sub-warehouses/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchSubWarehouses();
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
            warehouse_id: '',
            parent_id: '',
            active: 'Y'
        });
    };

    // Get only Level 1 sub warehouses (those without parent) for parent dropdown
    const parentOptions = subWarehouses.filter(sw => !sw.parent_id);

    // When parent is selected, auto-fill warehouse_id
    const handleParentChange = (parentId) => {
        if (parentId) {
            const parent = subWarehouses.find(sw => sw.id === parseInt(parentId));
            setFormData(prev => ({
                ...prev,
                parent_id: parentId,
                warehouse_id: parent ? parent.warehouse_id : prev.warehouse_id
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                parent_id: '',
                warehouse_id: ''
            }));
        }
    };

    // Build tree structure for display
    const buildTree = () => {
        const roots = subWarehouses.filter(sw => !sw.parent_id);
        const children = subWarehouses.filter(sw => sw.parent_id);

        const rows = [];
        roots.forEach(root => {
            rows.push({ ...root, level: 1 });
            children
                .filter(c => c.parent_id === root.id)
                .forEach(child => {
                    rows.push({ ...child, level: 2 });
                });
        });

        // Also include orphans (children whose parent might not exist)
        const addedIds = new Set(rows.map(r => r.id));
        subWarehouses.forEach(sw => {
            if (!addedIds.has(sw.id)) {
                rows.push({ ...sw, level: sw.parent_id ? 2 : 1 });
            }
        });

        return rows;
    };

    const treeRows = buildTree();

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Master Sub Warehouse</h1>
                <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingSubWarehouse(null); resetForm(); }}>
                    + Tambah Sub Warehouse
                </button>
            </div>

            {/* Info */}
            <div style={{
                background: 'linear-gradient(135deg, #ebf4ff 0%, #e8eaf6 100%)',
                border: '1px solid #90caf9',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                color: '#1565c0'
            }}>
                <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
                <span>Sub Warehouse mendukung <strong>2 level</strong> hierarki. Sub Warehouse Level 2 akan otomatis mengikuti Warehouse dari parent-nya.</span>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editingSubWarehouse ? 'Edit Sub Warehouse' : 'Tambah Sub Warehouse Baru'}</h3>
                            <button className="modal-close" onClick={() => { setShowForm(false); setEditingSubWarehouse(null); }}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Parent Sub Warehouse <span style={{ fontSize: '0.8rem', color: '#999' }}>(Kosongkan jika Level 1)</span></label>
                                <select
                                    value={formData.parent_id}
                                    onChange={(e) => handleParentChange(e.target.value)}
                                >
                                    <option value="">-- Tidak ada (Level 1) --</option>
                                    {parentOptions
                                        .filter(sw => !editingSubWarehouse || sw.id !== editingSubWarehouse.id)
                                        .map(sw => (
                                            <option key={sw.id} value={sw.id}>[{sw.code}] {sw.name}</option>
                                        ))}
                                </select>
                            </div>
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
                                <label>Nama Sub Warehouse</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Warehouse {formData.parent_id ? <span style={{ fontSize: '0.8rem', color: '#4caf50' }}>(otomatis dari parent)</span> : ''}</label>
                                <select
                                    value={formData.warehouse_id}
                                    onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                                    required
                                    disabled={!!formData.parent_id}
                                    style={formData.parent_id ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}}
                                >
                                    <option value="">-- Pilih Warehouse --</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.description}</option>
                                    ))}
                                </select>
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
                                <button type="submit" className="btn btn-primary">{editingSubWarehouse ? 'Update' : 'Simpan'}</button>
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
                                <th>Nama Sub Warehouse</th>
                                <th>Parent</th>
                                <th>Warehouse</th>
                                <th>Level</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {treeRows.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Belum ada data Sub Warehouse
                                    </td>
                                </tr>
                            ) : (
                                treeRows.map((sw) => (
                                    <tr key={sw.id} style={sw.level === 2 ? { backgroundColor: '#f8f9ff' } : {}}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {sw.level === 2 && (
                                                    <span style={{ color: '#90a4ae', marginLeft: '1rem' }}>└─</span>
                                                )}
                                                <strong>{sw.code}</strong>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={sw.level === 2 ? { paddingLeft: '1.5rem' } : {}}>
                                                {sw.name}
                                            </span>
                                        </td>
                                        <td>
                                            {sw.parent_name ? (
                                                <span style={{
                                                    background: '#e3f2fd',
                                                    color: '#1565c0',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.85rem'
                                                }}>
                                                    {sw.parent_name}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#999' }}>-</span>
                                            )}
                                        </td>
                                        <td>{sw.warehouse_name || '-'}</td>
                                        <td>
                                            <span style={{
                                                background: sw.level === 1 ? '#e8f5e9' : '#fff3e0',
                                                color: sw.level === 1 ? '#2e7d32' : '#e65100',
                                                padding: '2px 10px',
                                                borderRadius: '12px',
                                                fontSize: '0.8rem',
                                                fontWeight: '600'
                                            }}>
                                                Level {sw.level}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${sw.active === 'Y' ? 'badge-success' : 'badge-danger'}`}>
                                                {sw.active === 'Y' ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn-icon" onClick={() => handleEdit(sw)} title="Edit">✏️</button>
                                            <button className="btn-icon" onClick={() => handleDelete(sw.id)} title="Hapus">🗑️</button>
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

export default SubWarehouseList;
