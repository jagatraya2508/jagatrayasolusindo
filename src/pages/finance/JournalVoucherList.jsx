import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePeriod } from '../../context/PeriodContext';
function JournalVoucherList() {
    const { token, user } = useAuth();
    const { selectedPeriod } = usePeriod();
    const [canApprove, setCanApprove] = useState(false);

    const [journals, setJournals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [accounts, setAccounts] = useState([]);

    // Hardcoded for now, but ideally fetched. confirmed ID=9 is JV
    const [jvTranscodeId, setJvTranscodeId] = useState(9);
    const [transcodeInfo, setTranscodeInfo] = useState(null);

    const [formData, setFormData] = useState({
        doc_number: 'AUTO',
        doc_date: new Date().toISOString().split('T')[0],
        description: '',
        status: 'Draft',
        details: []
    });

    useEffect(() => {
        fetchJournals();
        fetchMasterData();
        checkApprovalPermission();
    }, [selectedPeriod]);

    const checkApprovalPermission = async () => {
        try {
            const res = await fetch(`/api/approval-check/journal-voucher`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setCanApprove(data.allowed === true);
        } catch { setCanApprove(false); }
    };

    const fetchJournals = async () => {
        setLoading(true);
        try {
            // Fetch all journals for now. Ideally filter by transcode_id on backend if volume is huge.
            // But API returns all. We filter in frontend or improve API.
            // API doesn't support transcode filter yet, but supports source_type='MANUAL'.
            let url = '/api/journals?source_type=MANUAL';
            if (selectedPeriod) {
                url += `&period_id=${selectedPeriod.id}`;
            }
            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                // Filter only Journal Voucher records (transcode_id 9)
                // Or maybe show all MANUAL journals? Let's check user intent. 
                // "Journal Voucher" usually means general journals.
                setJournals(result.data.filter(j => j.transcode_id === 9));
            }
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const fetchMasterData = async () => {
        try {
            const accRes = await fetch('/api/accounts');
            const accData = await accRes.json();
            if (accData.success) setAccounts(accData.data);

            const trRes = await fetch('/api/transcodes');
            const trData = await trRes.json();
            if (trData.success) {
                const jvTr = trData.data.find(t => t.nomortranscode === 9); // 9 is JV
                if (jvTr) {
                    setJvTranscodeId(jvTr.id);
                    setTranscodeInfo(jvTr);
                }
            }
        } catch (error) {
            console.error('Error master data:', error);
        }
    };

    const generateNumber = async () => {
        if (!transcodeInfo) return;
        try {
            const response = await fetch(`/api/transcodes/${transcodeInfo.code}/generate`);
            const data = await response.json();
            if (data.success) {
                setFormData(prev => ({ ...prev, doc_number: data.doc_number }));
            }
        } catch (error) {
            console.error('Error generating number:', error);
        }
    };

    const handleCreate = () => {
        resetForm();
        setShowForm(true);
        if (transcodeInfo && formData.doc_number === 'AUTO') {
            generateNumber();
        }
    };

    const handleEdit = async (journal) => {
        try {
            const response = await fetch(`/api/journals/${journal.id}`);
            const data = await response.json();
            if (data.success) {
                const jv = data.data;
                setFormData({
                    doc_number: jv.doc_number,
                    doc_date: new Date(jv.doc_date).toISOString().split('T')[0],
                    description: jv.description,
                    status: jv.status,
                    details: jv.details.map(d => ({
                        coa_id: d.coa_id,
                        description: d.description,
                        debit: parseFloat(d.debit),
                        credit: parseFloat(d.credit)
                    }))
                });
                setEditingItem(journal.id);
                setShowForm(true);
            }
        } catch (error) {
            alert('Error fetching details: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus Jurnal ini?')) return;
        try {
            const response = await fetch(`/api/journals/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                fetchJournals();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleApprove = async (id) => {
        if (!confirm('Approve Jurnal ini?')) return;
        try {
            const response = await fetch(`/api/journals/${id}/approve`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchJournals();
            } else {
                alert('Error: ' + (data.reason || data.error));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleUnapprove = async (id) => {
        if (!confirm('Unapprove Jurnal ini?')) return;
        try {
            const response = await fetch(`/api/journals/${id}/unapprove`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchJournals();
            } else {
                alert('Error: ' + (data.reason || data.error));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handlePost = async (id) => {
        if (!confirm('Post Jurnal ini?')) return;
        try {
            const response = await fetch(`/api/journals/${id}/post`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchJournals();
            } else {
                alert('Error: ' + (data.reason || data.error));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleUnpost = async (id) => {
        if (!confirm('Unpost Jurnal ini?')) return;
        try {
            const response = await fetch(`/api/journals/${id}/unpost`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchJournals();
            } else {
                alert('Error: ' + (data.reason || data.error));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleVoid = async (id) => {
        if (!confirm('Void Jurnal ini?\nTindakan ini permanen!')) return;
        try {
            const response = await fetch(`/api/journals/${id}/void`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchJournals();
            } else {
                alert('Error: ' + (data.reason || data.error));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Final balance check
        const totalDebit = formData.details.reduce((sum, d) => sum + (parseFloat(d.debit) || 0), 0);
        const totalCredit = formData.details.reduce((sum, d) => sum + (parseFloat(d.credit) || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            alert(`Jurnal tidak balance! Debit: ${formatMoney(totalDebit)}, Credit: ${formatMoney(totalCredit)}`);
            return;
        }

        try {
            const url = editingItem ? `/api/journals/${editingItem}` : '/api/journals';
            const method = editingItem ? 'PUT' : 'POST';

            const payload = {
                ...formData,
                transcode_id: jvTranscodeId
            };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (data.success) {
                alert(data.message);
                setShowForm(false);
                fetchJournals();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleAddLine = () => {
        setFormData(prev => ({
            ...prev,
            details: [...prev.details, { coa_id: '', description: '', debit: 0, credit: 0 }]
        }));
    };

    const handleRemoveLine = (index) => {
        setFormData(prev => ({
            ...prev,
            details: prev.details.filter((_, i) => i !== index)
        }));
    };

    const handleLineChange = (index, field, value) => {
        const newDetails = [...formData.details];
        newDetails[index][field] = value;
        setFormData({ ...formData, details: newDetails });
    };

    const resetForm = () => {
        setEditingItem(null);
        setFormData({
            doc_number: 'AUTO',
            doc_date: new Date().toISOString().split('T')[0],
            description: '',
            status: 'Draft',
            details: []
        });
        if (transcodeInfo) {
            generateNumber();
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
    };

    const formatDate = (date) => new Date(date).toLocaleDateString('id-ID');

    // Display helpers
    const totalDebit = formData.details.reduce((sum, d) => sum + (parseFloat(d.debit) || 0), 0);
    const totalCredit = formData.details.reduce((sum, d) => sum + (parseFloat(d.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.01;

    return (
        <div className="report-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Jurnal Voucher (JV)</h1>
                    <p className="text-subtitle">Input dan kelola jurnal umum manual</p>
                </div>
                <button className="btn btn-primary" onClick={handleCreate}>
                    + Buat Jurnal Baru
                </button>
            </div>

            {/* Modal Form */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal modal-large" style={{ maxWidth: '900px' }}>
                        <div className="modal-header">
                            <h3>{editingItem ? 'Edit Jurnal Voucher' : 'Buat Jurnal Voucher'}</h3>
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
                                        className="form-control"
                                        style={{ backgroundColor: '#f0f0f0' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Tanggal</label>
                                    <input
                                        type="date"
                                        value={formData.doc_date}
                                        onChange={e => setFormData({ ...formData, doc_date: e.target.value })}
                                        required
                                        disabled={formData.status !== 'Draft'}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label>Deskripsi</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        required
                                        disabled={formData.status !== 'Draft'}
                                        placeholder="Keterangan jurnal..."
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <div className="form-section-header">
                                    <h4>Detail Jurnal</h4>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={handleAddLine} disabled={formData.status !== 'Draft'}>
                                        + Tambah Baris
                                    </button>
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '30%' }}>Akun</th>
                                            <th>Keterangan</th>
                                            <th style={{ width: '15%', textAlign: 'right' }}>Debit</th>
                                            <th style={{ width: '15%', textAlign: 'right' }}>Kredit</th>
                                            <th style={{ width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.details.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', color: '#999', padding: '1rem' }}>
                                                    Belum ada baris jurnal
                                                </td>
                                            </tr>
                                        ) : (
                                            formData.details.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <select
                                                            value={row.coa_id}
                                                            onChange={e => handleLineChange(idx, 'coa_id', e.target.value)}
                                                            required
                                                            disabled={formData.status !== 'Draft'}
                                                            style={{ width: '100%' }}
                                                        >
                                                            <option value="">-- Pilih Akun --</option>
                                                            {accounts.map(acc => (
                                                                <option key={acc.id} value={acc.id}>
                                                                    {acc.code} - {acc.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={row.description}
                                                            onChange={e => handleLineChange(idx, 'description', e.target.value)}
                                                            placeholder="Keterangan baris..."
                                                            disabled={formData.status !== 'Draft'}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={row.debit}
                                                            onChange={e => {
                                                                handleLineChange(idx, 'debit', parseFloat(e.target.value) || 0);
                                                                if (parseFloat(e.target.value) > 0) handleLineChange(idx, 'credit', 0);
                                                            }}
                                                            style={{ textAlign: 'right' }}
                                                            disabled={formData.status !== 'Draft'}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={row.credit}
                                                            onChange={e => {
                                                                handleLineChange(idx, 'credit', parseFloat(e.target.value) || 0);
                                                                if (parseFloat(e.target.value) > 0) handleLineChange(idx, 'debit', 0);
                                                            }}
                                                            style={{ textAlign: 'right' }}
                                                            disabled={formData.status !== 'Draft'}
                                                        />
                                                    </td>
                                                    <td>
                                                        <button type="button" className="btn-icon" onClick={() => handleRemoveLine(idx)} disabled={formData.status !== 'Draft'}>
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                                            <td colSpan="2" style={{ textAlign: 'right' }}>Total:</td>
                                            <td style={{ textAlign: 'right', color: isBalanced ? 'green' : 'red' }}>
                                                {formatMoney(totalDebit)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: isBalanced ? 'green' : 'red' }}>
                                                {formatMoney(totalCredit)}
                                            </td>
                                            <td></td>
                                        </tr>
                                        {!isBalanced && (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', color: 'red', fontWeight: 'bold' }}>
                                                    Jurnal tidak balance! Selisih: {formatMoney(Math.abs(totalDebit - totalCredit))}
                                                </td>
                                            </tr>
                                        )}
                                    </tfoot>
                                </table>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                                    Batal
                                </button>
                                {formData.status === 'Draft' && (
                                    <button type="submit" className="btn btn-primary" disabled={!isBalanced || formData.details.length === 0}>
                                        Simpan Jurnal
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
                                <th>No. Dokumen</th>
                                <th>Tanggal</th>
                                <th>Deskripsi</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {journals.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Belum ada Jurnal Voucher
                                    </td>
                                </tr>
                            ) : (
                                journals.map(jv => (
                                    <tr key={jv.id}>
                                        <td><strong>{jv.doc_number}</strong></td>
                                        <td>{formatDate(jv.doc_date)}</td>
                                        <td>{jv.description}</td>
                                        <td>
                                            <span className={`badge ${(jv.status || '') === 'Draft' ? 'badge-warning' : ((jv.status || '') === 'Voided' ? 'badge-danger' : ((jv.status || '').startsWith('Pending') ? 'badge-info' : ((jv.status || '') === 'Approved' ? 'badge-primary' : 'badge-success')))}`}>
                                                {jv.status || 'Draft'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div className="action-btn-group">
                                                {/* Group 1: Approval */}
                                                {((jv.status || '') === 'Draft' || (jv.status || '').startsWith('Pending')) && canApprove && (
                                                    <button className="btn-action approve" onClick={() => handleApprove(jv.id)} title="Approve">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                                        Approve
                                                    </button>
                                                )}
                                                {((jv.status || '').startsWith('Pending') || (jv.status || '') === 'Approved' || (jv.status || '') === 'Posted') && canApprove && (
                                                    <button className="btn-action unapprove" onClick={() => handleUnapprove(jv.id)} disabled={(jv.status || '') === 'Posted'} title={(jv.status || '') === 'Posted' ? 'Unpost dulu sebelum unapprove' : 'Unapprove'}>
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
                                                        Unapprove
                                                    </button>
                                                )}

                                                {/* Separator */}
                                                {((jv.status || '') === 'Approved' || (jv.status || '') === 'Posted') && canApprove && (
                                                    <span className="action-separator"></span>
                                                )}

                                                {/* Group 2: Posting */}
                                                {(jv.status || '') === 'Approved' && canApprove && (
                                                    <button className="btn-action post" onClick={() => handlePost(jv.id)} title="Post Transaksi">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                                                        Posting
                                                    </button>
                                                )}
                                                {(jv.status || '') === 'Posted' && canApprove && (
                                                    <button className="btn-action unpost" onClick={() => handleUnpost(jv.id)} title="Unpost">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                                                        Unpost
                                                    </button>
                                                )}

                                                {/* Separator */}
                                                <span className="action-separator"></span>

                                                {/* Group 3: Edit / Delete / Void / View */}
                                                {(jv.status || '') === 'Draft' && (
                                                    <button className="btn-action edit" onClick={() => handleEdit(jv)} title="Edit">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                                                        Edit
                                                    </button>
                                                )}
                                                {(jv.status || '') === 'Draft' && (
                                                    <button className="btn-action delete" onClick={() => handleDelete(jv.id)} title="Hapus">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                                        Hapus
                                                    </button>
                                                )}
                                                {((jv.status || '') === 'Draft' || (jv.status || '').startsWith('Pending') || (jv.status || '') === 'Approved') && (
                                                    <button className="btn-action void" onClick={() => handleVoid(jv.id)} title="Void Transaksi">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/></svg>
                                                        Void
                                                    </button>
                                                )}
                                                {(jv.status || '') !== 'Draft' && (
                                                    <button className="btn-action view" onClick={() => handleEdit(jv)} title="Lihat Detail">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                                                        Detail
                                                    </button>
                                                )}
                                            </div>
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

export default JournalVoucherList;
