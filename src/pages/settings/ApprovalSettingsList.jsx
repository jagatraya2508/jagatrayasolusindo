import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const ApprovalSettingsList = () => {
    const { token } = useAuth();
    const [settings, setSettings] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedSetting, setSelectedSetting] = useState(null);
    const [showLogModal, setShowLogModal] = useState(false);
    const [logs, setLogs] = useState([]);
    const [logFilter, setLogFilter] = useState('');

    // Add approver form
    const [approverForm, setApproverForm] = useState({
        user_id: '',
        approval_level: 1,
        min_amount: 0,
        max_amount: 999999999999
    });

    // Edit approver
    const [editingApprover, setEditingApprover] = useState(null);

    useEffect(() => {
        fetchSettings();
        fetchUsers();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/approval-settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) setSettings(data.data);
        } catch (error) {
            console.error('Error fetching approval settings:', error);
        }
        setLoading(false);
    };

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) setUsers(data.data.filter(u => u.active === 'Y'));
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const handleUpdateSetting = async (setting, updates) => {
        try {
            const payload = {
                require_approval: setting.require_approval,
                active: setting.active,
                description: setting.description,
                approval_mode: setting.approval_mode,
                max_levels: setting.max_levels,
                ...updates
            };
            const response = await fetch(`/api/approval-settings/${setting.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) fetchSettings();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleToggleRequireApproval = (setting) => {
        handleUpdateSetting(setting, { require_approval: setting.require_approval === 'Y' ? 'N' : 'Y' });
    };

    const handleUpdateMode = (setting, mode) => {
        handleUpdateSetting(setting, { approval_mode: mode });
    };

    const handleUpdateMaxLevels = (setting, max_levels) => {
        handleUpdateSetting(setting, { max_levels: max_levels });
    };

    const handleOpenConfig = (setting) => {
        setSelectedSetting(setting);
        setApproverForm({ user_id: '', approval_level: 1, min_amount: 0, max_amount: 999999999999 });
        setEditingApprover(null);
        setShowModal(true);
    };

    const handleAddApprover = async (e) => {
        e.preventDefault();
        if (!approverForm.user_id) {
            alert('Pilih user terlebih dahulu');
            return;
        }
        try {
            const response = await fetch(`/api/approval-settings/${selectedSetting.id}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(approverForm)
            });
            const data = await response.json();
            if (data.success) {
                setApproverForm({ user_id: '', approval_level: 1, min_amount: 0, max_amount: 999999999999 });
                fetchSettings();
                // Refresh selected setting
                setTimeout(() => {
                    fetchSettings().then(() => {
                        // Will be updated via useEffect
                    });
                }, 300);
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleUpdateApprover = async (approverId) => {
        if (!editingApprover) return;
        try {
            const response = await fetch(`/api/approval-users/${approverId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editingApprover)
            });
            const data = await response.json();
            if (data.success) {
                setEditingApprover(null);
                fetchSettings();
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleRemoveApprover = async (approverId) => {
        if (!confirm('Hapus approver ini?')) return;
        try {
            const response = await fetch(`/api/approval-users/${approverId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) fetchSettings();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleViewLogs = async (transType) => {
        try {
            const url = transType
                ? `/api/approval-logs?transaction_type=${transType}`
                : '/api/approval-logs';
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setLogs(data.data);
                setLogFilter(transType || '');
                setShowLogModal(true);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    // Keep selectedSetting in sync with settings
    useEffect(() => {
        if (selectedSetting) {
            const updated = settings.find(s => s.id === selectedSetting.id);
            if (updated) setSelectedSetting(updated);
        }
    }, [settings]);

    const formatMoney = (amount) => {
        const val = parseFloat(amount) || 0;
        if (val >= 999999999999) return '∞ (Tak Terbatas)';
        return new Intl.NumberFormat('id-ID').format(val);
    };

    const formatDate = (d) => {
        if (!d) return '-';
        return new Date(d).toLocaleString('id-ID', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Group settings by category
    const groupedSettings = () => {
        const groups = {
            'Pembelian': ['purchase-order', 'receiving', 'ap-invoice'],
            'Penjualan': ['sales-order', 'shipment', 'ar-invoice'],
            'Keuangan': ['cash-in', 'cash-out', 'bank-in', 'bank-out', 'journal-voucher'],
            'Adjustment': ['inventory-adjustment-in', 'inventory-adjustment-out', 'item-conversion',
                'ap-debit-adjustment', 'ap-credit-adjustment', 'ar-debit-adjustment', 'ar-credit-adjustment'],
            'Lainnya': ['location-transfer']
        };

        const result = {};
        for (const [group, types] of Object.entries(groups)) {
            result[group] = settings.filter(s => types.includes(s.transaction_type));
        }
        // Add any uncategorized
        const allCategorized = Object.values(groups).flat();
        const uncategorized = settings.filter(s => !allCategorized.includes(s.transaction_type));
        if (uncategorized.length > 0) {
            result['Lainnya'] = [...(result['Lainnya'] || []), ...uncategorized];
        }
        return result;
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Pengaturan Approval</h1>
                    <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                        Kelola siapa yang boleh approve setiap tipe transaksi
                    </p>
                </div>
                <button className="btn btn-outline" onClick={() => handleViewLogs('')}>
                    📋 Lihat Log Approval
                </button>
            </div>

            {loading ? (
                <div className="loading">
                    <div className="loading-spinner"></div>
                    <p>Memuat data...</p>
                </div>
            ) : (
                Object.entries(groupedSettings()).map(([group, items]) => {
                    if (items.length === 0) return null;
                    return (
                        <div key={group} className="card" style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{
                                margin: '0 0 1rem 0',
                                padding: '0.75rem 1rem',
                                backgroundColor: 'var(--sidebar-bg-from, #2d3748)',
                                color: 'white',
                                borderRadius: '8px 8px 0 0',
                                fontSize: '1rem',
                                marginTop: '-1rem',
                                marginLeft: '-1rem',
                                marginRight: '-1rem',
                            }}>
                                {group}
                            </h3>
                            <table className="data-table" style={{ fontSize: '0.9rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '200px' }}>Tipe Transaksi</th>
                                        <th>Deskripsi</th>
                                        <th style={{ width: '130px', textAlign: 'center' }}>Wajib Approval</th>
                                        <th style={{ width: '150px', textAlign: 'center' }}>Mode / Max Level</th>
                                        <th style={{ width: '300px' }}>Approver</th>
                                        <th style={{ width: '120px', textAlign: 'center' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(setting => (
                                        <tr key={setting.id}>
                                            <td>
                                                <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                    {setting.transaction_type}
                                                </span>
                                            </td>
                                            <td><strong>{setting.description}</strong></td>
                                            <td style={{ textAlign: 'center' }}>
                                                <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={setting.require_approval === 'Y'}
                                                        onChange={() => handleToggleRequireApproval(setting)}
                                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                    />
                                                    <span className={`badge ${setting.require_approval === 'Y' ? 'badge-success' : 'badge-warning'}`}
                                                        style={{ fontSize: '0.75rem' }}>
                                                        {setting.require_approval === 'Y' ? 'Ya' : 'Tidak'}
                                                    </span>
                                                </label>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {setting.require_approval === 'Y' && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                                                        <select
                                                            value={setting.approval_mode || 'any'}
                                                            onChange={(e) => handleUpdateMode(setting, e.target.value)}
                                                            style={{ fontSize: '0.8rem', padding: '0.2rem', width: '100px' }}
                                                        >
                                                            <option value="any">Salah Satu (Any)</option>
                                                            <option value="sequential">Berurutan</option>
                                                        </select>
                                                        {setting.approval_mode === 'sequential' && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
                                                                <span style={{color: '#666'}}>Total Level:</span>
                                                                <input
                                                                    type="number" min="1" max="5"
                                                                    value={setting.max_levels || 1}
                                                                    onChange={(e) => handleUpdateMaxLevels(setting, parseInt(e.target.value) || 1)}
                                                                    style={{ width: '45px', padding: '0.2rem', fontSize: '0.8rem', textAlign: 'center' }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {setting.users && setting.users.length > 0 ? (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                        {setting.users.map(u => (
                                                            <span key={u.id}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.3rem',
                                                                    padding: '0.2rem 0.6rem',
                                                                    backgroundColor: '#e2e8f0',
                                                                    borderRadius: '20px',
                                                                    fontSize: '0.8rem',
                                                                    border: '1px solid #cbd5e0'
                                                                }}>
                                                                <span>👤</span>
                                                                <span>{u.full_name || u.username}</span>
                                                                {u.approval_level > 1 && (
                                                                    <span style={{
                                                                        backgroundColor: '#4299e1',
                                                                        color: 'white',
                                                                        borderRadius: '50%',
                                                                        width: '18px',
                                                                        height: '18px',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontSize: '0.7rem'
                                                                    }}>
                                                                        L{u.approval_level}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#999', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                                        {setting.require_approval === 'Y'
                                                            ? '⚠️ Belum ada approver (semua bisa approve)'
                                                            : '— Tidak diperlukan'}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => handleOpenConfig(setting)}
                                                        title="Konfigurasi Approver"
                                                        style={{ fontSize: '1.1rem' }}
                                                    >
                                                        ⚙️
                                                    </button>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => handleViewLogs(setting.transaction_type)}
                                                        title="Lihat Log"
                                                        style={{ fontSize: '1.1rem' }}
                                                    >
                                                        📋
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })
            )}

            {/* Config Modal */}
            {showModal && selectedSetting && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '800px' }}>
                        <div className="modal-header">
                            <h3>Konfigurasi Approver — {selectedSetting.description}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {/* Info Badge */}
                            <div style={{
                                padding: '0.75rem 1rem',
                                backgroundColor: '#ebf8ff',
                                border: '1px solid #90cdf4',
                                borderRadius: '8px',
                                marginBottom: '1rem',
                                fontSize: '0.85rem',
                                color: '#2b6cb0'
                            }}>
                                💡 <strong>Tips:</strong> Jika <em>Wajib Approval</em> aktif tapi tidak ada approver terdaftar,
                                maka <strong>semua user</strong> tetap bisa approve (backward compatible). 
                                Jika ada approver terdaftar, hanya user tersebut yang bisa approve.
                                Super Admin selalu bisa approve tanpa perlu didaftarkan.
                            </div>

                            {/* Add Approver Form */}
                            <form onSubmit={handleAddApprover} style={{
                                padding: '1rem',
                                backgroundColor: '#f7fafc',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                marginBottom: '1rem'
                            }}>
                                <h4 style={{ margin: '0 0 0.75rem 0' }}>+ Tambah Approver</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 140px 140px auto', gap: '0.5rem', alignItems: 'end' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '0.8rem' }}>User</label>
                                        <select
                                            value={approverForm.user_id}
                                            onChange={e => setApproverForm({ ...approverForm, user_id: e.target.value })}
                                            required
                                            style={{ fontSize: '0.85rem' }}
                                        >
                                            <option value="">-- Pilih User --</option>
                                            {users.filter(u => {
                                                // Don't show users already assigned
                                                return !selectedSetting.users?.find(au => au.user_id === u.id);
                                            }).map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.full_name || u.username} ({u.role_name || '-'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '0.8rem' }}>Level</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="5"
                                            value={approverForm.approval_level}
                                            onChange={e => setApproverForm({ ...approverForm, approval_level: parseInt(e.target.value) || 1 })}
                                            style={{ fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '0.8rem' }}>Min. Nominal</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={approverForm.min_amount}
                                            onChange={e => setApproverForm({ ...approverForm, min_amount: parseFloat(e.target.value) || 0 })}
                                            style={{ fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label style={{ fontSize: '0.8rem' }}>Max. Nominal</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={approverForm.max_amount}
                                            onChange={e => setApproverForm({ ...approverForm, max_amount: parseFloat(e.target.value) || 999999999999 })}
                                            style={{ fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                        + Tambah
                                    </button>
                                </div>
                            </form>

                            {/* Current Approvers */}
                            <h4>Daftar Approver Saat Ini</h4>
                            <table className="data-table" style={{ fontSize: '0.85rem' }}>
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th style={{ width: '70px', textAlign: 'center' }}>Level</th>
                                        <th style={{ width: '150px', textAlign: 'right' }}>Min. Nominal</th>
                                        <th style={{ width: '150px', textAlign: 'right' }}>Max. Nominal</th>
                                        <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(!selectedSetting.users || selectedSetting.users.length === 0) ? (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: '#999' }}>
                                                Belum ada approver terdaftar
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedSetting.users.map(u => (
                                            <tr key={u.id}>
                                                <td>
                                                    <strong>{u.full_name || u.username}</strong>
                                                    <br />
                                                    <small style={{ color: '#666' }}>{u.username}</small>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {editingApprover?.id === u.id ? (
                                                        <input
                                                            type="number" min="1" max="5"
                                                            value={editingApprover.approval_level}
                                                            onChange={e => setEditingApprover({ ...editingApprover, approval_level: parseInt(e.target.value) || 1 })}
                                                            style={{ width: '50px', fontSize: '0.85rem' }}
                                                        />
                                                    ) : (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            backgroundColor: '#4299e1', color: 'white', borderRadius: '50%',
                                                            width: '26px', height: '26px', fontSize: '0.8rem', fontWeight: 'bold'
                                                        }}>
                                                            {u.approval_level}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {editingApprover?.id === u.id ? (
                                                        <input
                                                            type="number" min="0"
                                                            value={editingApprover.min_amount}
                                                            onChange={e => setEditingApprover({ ...editingApprover, min_amount: parseFloat(e.target.value) || 0 })}
                                                            style={{ width: '120px', fontSize: '0.85rem', textAlign: 'right' }}
                                                        />
                                                    ) : (
                                                        formatMoney(u.min_amount)
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {editingApprover?.id === u.id ? (
                                                        <input
                                                            type="number" min="0"
                                                            value={editingApprover.max_amount}
                                                            onChange={e => setEditingApprover({ ...editingApprover, max_amount: parseFloat(e.target.value) || 999999999999 })}
                                                            style={{ width: '120px', fontSize: '0.85rem', textAlign: 'right' }}
                                                        />
                                                    ) : (
                                                        formatMoney(u.max_amount)
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {editingApprover?.id === u.id ? (
                                                        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                                                            <button className="btn-icon" onClick={() => handleUpdateApprover(u.id)} title="Simpan" style={{ color: 'green' }}>💾</button>
                                                            <button className="btn-icon" onClick={() => setEditingApprover(null)} title="Batal">❌</button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                                                            <button className="btn-icon" onClick={() => setEditingApprover({
                                                                id: u.id,
                                                                approval_level: u.approval_level,
                                                                min_amount: parseFloat(u.min_amount) || 0,
                                                                max_amount: parseFloat(u.max_amount) || 999999999999
                                                            })} title="Edit">✏️</button>
                                                            <button className="btn-icon" onClick={() => handleRemoveApprover(u.id)} title="Hapus">🗑️</button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="form-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Log Modal */}
            {showLogModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '900px' }}>
                        <div className="modal-header">
                            <h3>Log Approval {logFilter ? `— ${logFilter}` : '(Semua)'}</h3>
                            <button className="modal-close" onClick={() => setShowLogModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            <table className="data-table" style={{ fontSize: '0.85rem' }}>
                                <thead style={{ position: 'sticky', top: 0 }}>
                                    <tr>
                                        <th>Waktu</th>
                                        <th>Tipe</th>
                                        <th>No. Dokumen</th>
                                        <th>Aksi</th>
                                        <th>User</th>
                                        <th>Catatan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                                                Belum ada log approval
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map(log => (
                                            <tr key={log.id}>
                                                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                                                <td>
                                                    <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                                                        {log.transaction_type}
                                                    </span>
                                                </td>
                                                <td><strong>{log.doc_number || '-'}</strong></td>
                                                <td>
                                                    <span className={`badge ${log.action === 'APPROVE' ? 'badge-success' : 'badge-warning'}`}
                                                        style={{ fontSize: '0.75rem' }}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td>{log.user_name || '-'}</td>
                                                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {log.notes || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="form-actions">
                            <button type="button" className="btn btn-outline" onClick={() => setShowLogModal(false)}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApprovalSettingsList;
