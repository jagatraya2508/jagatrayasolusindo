import { useState, useEffect } from 'react';

function CoaList() {
    const [accounts, setAccounts] = useState([]);
    const [accountGroups, setAccountGroups] = useState([]);
    const [entities, setEntities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEntity, setFilterEntity] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        type: 'ASSET',
        level: 1,
        parent_id: '',
        group_id: '',
        entity_id: '',
        active: 'Y'
    });
    const [segmentCount, setSegmentCount] = useState(1);
    const [showSettings, setShowSettings] = useState(false);
    const [codeSegments, setCodeSegments] = useState(['']);

    // Copy COA states
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [copySource, setCopySource] = useState('');
    const [copyTarget, setCopyTarget] = useState('');
    const [copyPreview, setCopyPreview] = useState(null);
    const [copyLoading, setCopyLoading] = useState(false);

    const accountTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

    // Segment labels based on segment count
    const getSegmentLabels = () => {
        switch (segmentCount) {
            case 1: return ['Kode Akun'];
            case 2: return ['Tipe', 'Nomor'];
            case 3: return ['Tipe', 'Group COA', 'Nomor'];
            case 4: return ['Tipe', 'Group COA', 'Sub Group', 'Nomor'];
            case 5: return ['Tipe', 'Group COA', 'Sub Group', 'Detail', 'Nomor'];
            default: return Array(segmentCount).fill('Segment');
        }
    };

    useEffect(() => {
        const savedSegments = localStorage.getItem('coa_segment_count');
        if (savedSegments) {
            const parsed = parseInt(savedSegments);
            if (parsed >= 1 && parsed <= 5) {
                setSegmentCount(parsed);
            }
        }
        fetchAccounts();
        fetchAccountGroups();
        fetchEntities();
    }, []);

    useEffect(() => {
        if (editingAccount && editingAccount.code) {
            const parts = editingAccount.code.split('.');
            const count = segmentCount || 1;
            const newSegments = Array(count).fill('');
            parts.forEach((p, i) => { if (i < count) newSegments[i] = p; });
            setCodeSegments(newSegments);
        } else {
            setCodeSegments(Array(segmentCount || 1).fill(''));
        }
    }, [editingAccount, segmentCount, showForm]);

    const fetchAccountGroups = async () => {
        try {
            const response = await fetch('/api/account-groups');
            const data = await response.json();
            if (data.success) {
                setAccountGroups(data.data);
            }
        } catch (error) {
            console.error('Error fetching account groups:', error);
        }
    };

    const fetchEntities = async () => {
        try {
            const response = await fetch('/api/entities');
            const data = await response.json();
            if (data.success) {
                setEntities(data.data);
            }
        } catch (error) {
            console.error('Error fetching entities:', error);
        }
    };

    const handleSegmentChange = (index, value) => {
        const newSegments = [...codeSegments];
        newSegments[index] = value;
        setCodeSegments(newSegments);

        // Update formData.code immediately with dot separator
        const joinedCode = newSegments.filter(s => s).join('.');
        setFormData(prev => ({ ...prev, code: joinedCode }));
    };

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/accounts');
            const data = await response.json();
            if (data.success) {
                setAccounts(data.data);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
        setLoading(false);
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const filteredAccounts = accounts.filter(acc => {
        const matchSearch = acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            acc.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchEntity = filterEntity ? (acc.code === filterEntity || acc.code.startsWith(filterEntity + '.')) : true;
        return matchSearch && matchEntity;
    });

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            type: 'ASSET',
            level: 1,
            parent_id: '',
            group_id: '',
            entity_id: '',
            active: 'Y'
        });
        setCodeSegments(Array(segmentCount || 1).fill(''));
        setEditingAccount(null);
    };

    const handleEdit = (account) => {
        setEditingAccount(account);
        setFormData({
            code: account.code,
            name: account.name,
            type: account.type,
            level: account.level,
            parent_id: account.parent_id || '',
            group_id: account.group_id || '',
            entity_id: account.entity_id || '',
            active: account.active
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Apakah Anda yakin ingin menghapus akun ini?')) return;

        try {
            const response = await fetch(`/api/accounts/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchAccounts();
            } else {
                alert('Gagal menghapus: ' + data.error);
            }
        } catch (error) {
            console.error('Error deleting account:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Join segments with dot separator to form the final code
        const finalCode = codeSegments.join('.');
        const dataToSubmit = { ...formData, code: finalCode };

        try {
            const url = editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts';
            const method = editingAccount ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToSubmit)
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                setShowForm(false);
                resetForm();
                fetchAccounts();
            } else {
                alert('Gagal menyimpan: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error saving account:', error);
            alert('Terjadi kesalahan saat menyimpan data.');
        }
    };

    const saveSettings = () => {
        localStorage.setItem('coa_segment_count', segmentCount);
        setShowSettings(false);
        // Reset current segments to match new count
        setCodeSegments(Array(segmentCount).fill(''));
        alert(`Konfigurasi tersimpan: ${segmentCount} Segment`);
    };

    const segmentLabels = getSegmentLabels();

    // Render segment input based on type
    const renderSegmentInput = (index) => {
        const label = segmentLabels[index];
        const value = codeSegments[index] || '';

        // If this is the "Tipe" segment, show Entity dropdown
        if (label === 'Tipe' && entities.length > 0) {
            return (
                <select
                    value={value}
                    onChange={(e) => handleSegmentChange(index, e.target.value)}
                    required
                    style={{ width: '100%', textAlign: 'center', padding: '0.5rem' }}
                >
                    <option value="">-- Pilih Entity --</option>
                    {entities.map(ent => (
                        <option key={ent.id} value={ent.code}>{ent.code} - {ent.name}</option>
                    ))}
                </select>
            );
        }

        // If this is the "Group COA" segment and we have account groups, show dropdown
        if (label === 'Group COA' && accountGroups.length > 0) {
            return (
                <select
                    value={value}
                    onChange={(e) => handleSegmentChange(index, e.target.value)}
                    required
                    style={{ width: '100%', textAlign: 'center', padding: '0.5rem' }}
                >
                    <option value="">-- Pilih --</option>
                    {accountGroups.map(grp => (
                        <option key={grp.id} value={grp.code}>{grp.code} - {grp.description}</option>
                    ))}
                </select>
            );
        }

        // Default text input
        return (
            <input
                type="text"
                value={value}
                onChange={(e) => handleSegmentChange(index, e.target.value)}
                required
                placeholder={label}
                style={{ width: '100%', textAlign: 'center' }}
            />
        );
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Chart of Accounts</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className="btn btn-outline"
                        onClick={() => setShowSettings(true)}
                    >
                        ⚙️ Konfigurasi
                    </button>
                    <button
                        className="btn btn-outline"
                        onClick={() => { setCopySource(''); setCopyTarget(''); setCopyPreview(null); setShowCopyModal(true); }}
                        style={{ borderColor: '#6366f1', color: '#6366f1' }}
                    >
                        📋 Copy COA
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => { resetForm(); setShowForm(true); }}
                    >
                        + Tambah Akun
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="search-bar" style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
                    <select
                        value={filterEntity}
                        onChange={(e) => setFilterEntity(e.target.value)}
                        style={{ 
                            maxWidth: '250px',
                            padding: '0.75rem 1rem',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            backgroundColor: '#fff',
                            outline: 'none'
                        }}
                    >
                        <option value="">-- Semua Entity --</option>
                        {entities.map(ent => (
                            <option key={ent.id} value={ent.code}>{ent.code} - {ent.name}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        placeholder="Cari akun..."
                        value={searchTerm}
                        onChange={handleSearch}
                        style={{ 
                            flex: 1,
                            padding: '0.75rem 1rem',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            outline: 'none'
                        }}
                    />
                </div>

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
                                <th>Nama Akun</th>
                                <th>Tipe</th>
                                <th>Level</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAccounts.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '1rem' }}>
                                        Tidak ada data yang ditemukan.
                                    </td>
                                </tr>
                            ) : (
                                filteredAccounts.map(account => (
                                    <tr key={account.id}>
                                        <td>{account.code}</td>
                                        <td style={{ paddingLeft: `${(account.level - 1) * 1.5}rem` }}>
                                            {account.level > 1 && '└─ '}
                                            <strong>{account.name}</strong>
                                        </td>
                                        <td>{account.type}</td>
                                        <td>{account.level}</td>
                                        <td>
                                            <span className={`badge ${account.active === 'Y' ? 'badge-success' : 'badge-danger'}`}>
                                                {account.active === 'Y' ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleEdit(account)}
                                                title="Edit"
                                                style={{ marginRight: '0.5rem' }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleDelete(account.id)}
                                                title="Hapus"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3>Konfigurasi COA</h3>
                            <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
                        </div>
                        <div style={{ padding: '1rem' }}>
                            <div className="form-group">
                                <label>Jumlah Segment Kode Akun</label>
                                <select
                                    value={segmentCount}
                                    onChange={(e) => setSegmentCount(parseInt(e.target.value))}
                                    style={{ width: '100%', padding: '0.5rem' }}
                                >
                                    <option value={1}>1 Segment (Contoh: 1000)</option>
                                    <option value={2}>2 Segment (Contoh: 01.1000)</option>
                                    <option value={3}>3 Segment (Contoh: 01.GRP.001)</option>
                                    <option value={4}>4 Segment (Contoh: 01.GRP.SUB.001)</option>
                                    <option value={5}>5 Segment (Contoh: 01.GRP.SUB.DTL.001)</option>
                                </select>
                            </div>
                            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                                <strong>Preview Format:</strong>
                                <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '1.1rem' }}>
                                    {segmentLabels.map((lbl, i) => (
                                        <span key={i}>
                                            <span style={{
                                                padding: '2px 8px',
                                                backgroundColor: '#e0e0e0',
                                                borderRadius: '4px',
                                                margin: '2px'
                                            }}>
                                                {lbl}
                                            </span>
                                            {i < segmentLabels.length - 1 && <span style={{ margin: '0 4px' }}>.</span>}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="form-actions" style={{ marginTop: '1rem' }}>
                                <button className="btn btn-primary" onClick={saveSettings}>Simpan Pengaturan</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editingAccount ? 'Edit Akun' : 'Tambah Akun Baru'}</h3>
                            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Kode Akun ({segmentCount} Segment)</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {codeSegments.map((seg, index) => (
                                        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ minWidth: '100px', fontSize: '0.9rem', color: '#666' }}>
                                                {segmentLabels[index]}:
                                            </span>
                                            <div style={{ flex: 1 }}>
                                                {renderSegmentInput(index)}
                                            </div>
                                            {index < segmentCount - 1 && (
                                                <span style={{ fontWeight: 'bold', color: '#999' }}>.</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
                                    Preview: <strong>{codeSegments.filter(s => s).join('.') || '(kosong)'}</strong>
                                </p>
                            </div>
                            <div className="form-group">
                                <label>Nama Akun</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Contoh: KAS BESAR"
                                />
                            </div>
                            <div className="form-group">
                                <label>Tipe</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                >
                                    {accountTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Level</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={formData.level}
                                        onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
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
                            </div>
                            <div className="form-group">
                                <label>Parent Account (Induk)</label>
                                <select
                                    value={formData.parent_id}
                                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                                >
                                    <option value="">-- Tidak ada (Level 1) --</option>
                                    {accounts
                                        .filter(acc => acc.id !== editingAccount?.id)
                                        .map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.code} - {acc.name}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Copy COA Modal */}
            {showCopyModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '750px' }}>
                        <div className="modal-header">
                            <h3>📋 Copy Chart of Accounts</h3>
                            <button className="modal-close" onClick={() => setShowCopyModal(false)}>×</button>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                Copy seluruh struktur COA dari satu Entity ke Entity lain. Segment pertama (Entity) akan diganti otomatis.
                            </p>

                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Source Entity (Sumber)</label>
                                    <select
                                        value={copySource}
                                        onChange={(e) => { setCopySource(e.target.value); setCopyPreview(null); }}
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd' }}
                                    >
                                        <option value="">-- Pilih Entity Sumber --</option>
                                        {entities.map(ent => (
                                            <option key={ent.id} value={ent.code}>{ent.code} - {ent.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ fontSize: '1.5rem', paddingBottom: '0.5rem', color: '#6366f1' }}>→</div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Target Entity (Tujuan)</label>
                                    <select
                                        value={copyTarget}
                                        onChange={(e) => { setCopyTarget(e.target.value); setCopyPreview(null); }}
                                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ddd' }}
                                    >
                                        <option value="">-- Pilih Entity Tujuan --</option>
                                        {entities.filter(e => e.code !== copySource).map(ent => (
                                            <option key={ent.id} value={ent.code}>{ent.code} - {ent.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    className="btn btn-outline"
                                    onClick={async () => {
                                        if (!copySource || !copyTarget) {
                                            alert('Pilih Source dan Target Entity terlebih dahulu');
                                            return;
                                        }
                                        setCopyLoading(true);
                                        try {
                                            const resp = await fetch('/api/accounts/preview-copy-coa', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ source_entity_code: copySource, target_entity_code: copyTarget })
                                            });
                                            const data = await resp.json();
                                            if (data.success) {
                                                setCopyPreview(data.data);
                                            } else {
                                                alert('Error: ' + data.error);
                                            }
                                        } catch (err) {
                                            alert('Error: ' + err.message);
                                        }
                                        setCopyLoading(false);
                                    }}
                                    disabled={copyLoading || !copySource || !copyTarget}
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    {copyLoading ? '⏳' : '🔍'} Preview
                                </button>
                            </div>

                            {/* Preview Results */}
                            {copyPreview && (
                                <div>
                                    {/* Summary Cards */}
                                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                        <div style={{
                                            flex: 1, padding: '1rem', borderRadius: '8px',
                                            background: 'linear-gradient(135deg, #dbeafe, #eff6ff)',
                                            border: '1px solid #93c5fd', textAlign: 'center'
                                        }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2563eb' }}>{copyPreview.total_source}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#3b82f6' }}>Total Akun Source</div>
                                        </div>
                                        <div style={{
                                            flex: 1, padding: '1rem', borderRadius: '8px',
                                            background: 'linear-gradient(135deg, #dcfce7, #f0fdf4)',
                                            border: '1px solid #86efac', textAlign: 'center'
                                        }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#16a34a' }}>{copyPreview.will_copy}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#22c55e' }}>Akan Di-copy</div>
                                        </div>
                                        <div style={{
                                            flex: 1, padding: '1rem', borderRadius: '8px',
                                            background: 'linear-gradient(135deg, #fef3c7, #fffbeb)',
                                            border: '1px solid #fcd34d', textAlign: 'center'
                                        }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#d97706' }}>{copyPreview.will_skip}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>Akan Di-skip</div>
                                        </div>
                                    </div>

                                    {/* Preview Table */}
                                    <div style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                        <table className="data-table" style={{ marginBottom: 0 }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>Kode Sumber</th>
                                                    <th style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>→ Kode Tujuan</th>
                                                    <th style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>Nama Akun</th>
                                                    <th style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>Tipe</th>
                                                    <th style={{ position: 'sticky', top: 0, background: '#f9fafb', textAlign: 'center' }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {copyPreview.preview.map((item, idx) => (
                                                    <tr key={idx} style={{
                                                        backgroundColor: item.status === 'skip' ? '#fefce8' : 'transparent',
                                                        opacity: item.status === 'skip' ? 0.7 : 1
                                                    }}>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.source_code}</td>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#6366f1', fontWeight: '600' }}>{item.target_code}</td>
                                                        <td>{item.name}</td>
                                                        <td>{item.type}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            {item.status === 'copy' ? (
                                                                <span className="badge badge-success">✓ Copy</span>
                                                            ) : (
                                                                <span className="badge badge-warning" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>⚠ Skip</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => setShowCopyModal(false)}
                                >
                                    Batal
                                </button>
                                {copyPreview && copyPreview.will_copy > 0 && (
                                    <button
                                        className="btn btn-primary"
                                        disabled={copyLoading}
                                        onClick={async () => {
                                            if (!confirm(`Yakin ingin menyalin ${copyPreview.will_copy} akun dari entity ${copySource} ke entity ${copyTarget}?`)) return;
                                            setCopyLoading(true);
                                            try {
                                                const resp = await fetch('/api/accounts/copy-coa', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ source_entity_code: copySource, target_entity_code: copyTarget })
                                                });
                                                const data = await resp.json();
                                                if (data.success) {
                                                    alert(data.message);
                                                    setShowCopyModal(false);
                                                    fetchAccounts();
                                                } else {
                                                    alert('Error: ' + data.error);
                                                }
                                            } catch (err) {
                                                alert('Error: ' + err.message);
                                            }
                                            setCopyLoading(false);
                                        }}
                                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                                    >
                                        {copyLoading ? '⏳ Menyalin...' : `📋 Copy ${copyPreview.will_copy} Akun`}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CoaList;
