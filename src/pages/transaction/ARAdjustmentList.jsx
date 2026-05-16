import { useState, useEffect } from 'react';
import { usePeriod } from '../../context/PeriodContext';
import { useAuth } from '../../context/AuthContext';

function ARAdjustmentList({ adjustmentType = 'DEBIT' }) {
    const { selectedPeriod } = usePeriod();
    const { token } = useAuth();
    const [canApprove, setCanApprove] = useState(false);
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [transcodes, setTranscodes] = useState([]);
    const [invoices, setInvoices] = useState([]);

    const [formData, setFormData] = useState({
        doc_number: 'AUTO',
        doc_date: new Date().toISOString().split('T')[0],
        adjustment_type: adjustmentType,
        transcode_id: '',
        partner_id: '',
        counter_account_id: '',
        amount: 0,
        notes: '',
        status: 'Draft',
        allocate_to_invoice: 'N',
        allocations: [],
        currency_code: ''
    });
    const [currencies, setcurrencies] = useState([]);

    const title = adjustmentType === 'DEBIT' ? 'AR Debit Adjustment' : 'AR Credit Adjustment';
    const subtitle = adjustmentType === 'DEBIT' ? 'Menambah Piutang' : 'Mengurangi Piutang';

    useEffect(() => {
        fetchData();
        fetchMasterData();
        checkApprovalPermission();
    }, [selectedPeriod, adjustmentType]);

    const checkApprovalPermission = async () => {
        try {
            const txType = adjustmentType === 'DEBIT' ? 'ar-debit-adjustment' : 'ar-credit-adjustment';
            const res = await fetch(`/api/approval-check/${txType}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setCanApprove(data.allowed === true);
        } catch { setCanApprove(false); }
    };

    useEffect(() => {
        if (formData.partner_id && formData.allocate_to_invoice === 'Y') {
            fetchInvoices(formData.partner_id);
        }
    }, [formData.partner_id, formData.allocate_to_invoice]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/ar-adjustments';
            const params = new URLSearchParams();
            if (selectedPeriod) {
                params.append('startDate', new Date(selectedPeriod.start_date).toISOString().split('T')[0]);
                params.append('endDate', new Date(selectedPeriod.end_date).toISOString().split('T')[0]);
            }
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                setAdjustments(data.data.filter(a => a.adjustment_type === adjustmentType));
            }
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const fetchMasterData = async () => {
        try {
            const [custRes, accRes, transRes, rateRes] = await Promise.all([
                fetch('/api/partners?type=Customer'),
                fetch('/api/accounts'),
                fetch('/api/transcodes'),
                fetch('/api/currencies')
            ]);
            const custData = await custRes.json();
            const accData = await accRes.json();
            const transData = await transRes.json();
            const rateData = await rateRes.json();

            if (custData.success) setCustomers(custData.data);
            if (accData.success) setAccounts(accData.data);
            if (transData.success) {
                // Filter transcodes for AR adjustment (nomortranscode = 40 for DEBIT/IN, 41 for CREDIT/OUT)
                const transCodeNum = adjustmentType === 'DEBIT' ? 40 : 41;
                setTranscodes(transData.data.filter(t => t.active === 'Y' && t.nomortranscode === transCodeNum));
            }
            if (rateData.success) setcurrencies(rateData.data);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const fetchInvoices = async (partnerId) => {
        try {
            const response = await fetch(`/api/ar-invoices/for-allocation?partner_id=${partnerId}`);
            const data = await response.json();
            if (data.success) {
                setInvoices(data.data);
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
    };

    const generateNumber = async (code) => {
        try {
            const response = await fetch(`/api/transcodes/${code}/generate`);
            const data = await response.json();
            if (data.success) {
                setFormData(prev => ({ ...prev, doc_number: data.doc_number }));
            }
        } catch (error) {
            console.error('Error generating number:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate allocation total
        if (formData.allocate_to_invoice === 'Y') {
            const totalAllocated = formData.allocations.reduce((sum, a) => sum + parseFloat(a.allocated_amount || 0), 0);
            if (Math.abs(totalAllocated - parseFloat(formData.amount)) > 0.01) {
                alert('Total alokasi harus sama dengan jumlah adjustment!');
                return;
            }
        }

        try {
            const url = editingItem ? `/api/ar-adjustments/${editingItem}` : '/api/ar-adjustments';
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
                resetForm();
                fetchData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleEdit = async (id) => {
        try {
            const response = await fetch(`/api/ar-adjustments/${id}`);
            const data = await response.json();
            if (data.success) {
                const adj = data.data;
                setFormData({
                    doc_number: adj.doc_number,
                    doc_date: new Date(adj.doc_date).toISOString().split('T')[0],
                    adjustment_type: adj.adjustment_type || adj.type,
                    transcode_id: adj.transcode_id || '',
                    partner_id: adj.partner_id || '',
                    counter_account_id: adj.counter_account_id || '',
                    amount: parseFloat(adj.total_amount || adj.amount || 0),
                    notes: adj.description || adj.notes || '',
                    status: adj.status,
                    allocate_to_invoice: adj.allocate_to_invoice || 'N',
                    allocations: adj.allocations || [],
                    currency_code: adj.currency_code || ''
                });

                if (adj.partner_id) {
                    fetchInvoices(adj.partner_id);
                }
                setEditingItem(id);
                setShowForm(true);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus Adjustment ini?')) return;
        try {
            const response = await fetch(`/api/ar-adjustments/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleApprove = async (id) => {
        if (!confirm('Approve Adjustment ini?')) return;
        try {
            const response = await fetch(`/api/ar-adjustments/${id}/approve`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            } else {
                alert('Error: ' + (data.reason || data.error));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handlePost = async (id) => {
        if (!confirm('Post Adjustment ini?')) return;
        try {
            const response = await fetch(`/api/ar-adjustments/${id}/post`, { method: 'PUT' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleUnapprove = async (id) => {
        if (!confirm('Batalkan Approve Adjustment ini? Status akan kembali menjadi Draft.')) return;
        try {
            const response = await fetch(`/api/ar-adjustments/${id}/unapprove`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            } else {
                alert('Error: ' + (data.reason || data.error));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleUnpost = async (id) => {
        if (!confirm('Unpost Adjustment ini? Jurnal akan dihapus.')) return;
        try {
            const response = await fetch(`/api/ar-adjustments/${id}/unpost`, { method: 'PUT' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleAllocationChange = (invoiceId, amount) => {
        setFormData(prev => {
            const existing = prev.allocations.find(a => a.ar_invoice_id === invoiceId);
            if (existing) {
                return {
                    ...prev,
                    allocations: prev.allocations.map(a =>
                        a.ar_invoice_id === invoiceId ? { ...a, allocated_amount: parseFloat(amount) || 0 } : a
                    )
                };
            } else {
                return {
                    ...prev,
                    allocations: [...prev.allocations, { ar_invoice_id: invoiceId, allocated_amount: parseFloat(amount) || 0 }]
                };
            }
        });
    };

    const resetForm = () => {
        setEditingItem(null);
        setInvoices([]);
        setFormData({
            doc_number: 'AUTO',
            doc_date: new Date().toISOString().split('T')[0],
            adjustment_type: adjustmentType,
            transcode_id: '',
            partner_id: '',
            counter_account_id: '',
            amount: 0,
            notes: '',
            status: 'Draft',
            allocate_to_invoice: 'N',
            allocations: [],
            currency_code: ''
        });
    };

    

    const formatCurrency = (value) => {
        const code = formData.currency_code || 'IDR';
        try {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: code }).format(value || 0);
        } catch {
            return `${code} ${new Intl.NumberFormat('id-ID').format(value || 0)}`;
        }
    };

    const formatDate = (date) => new Date(date).toLocaleDateString('id-ID');
    const formatMoney = (amount) => formatCurrency(amount);

    const getStatusBadge = (status) => {
        const badges = {
            'Draft': 'badge-warning',
            'Approved': 'badge-info',
            'Posted': 'badge-success'
        };
        return badges[status] || 'badge-secondary';
    };

    const totalAllocated = formData.allocations.reduce((sum, a) => sum + parseFloat(a.allocated_amount || 0), 0);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{title}</h1>
                    <p style={{ color: '#666', margin: 0 }}>{subtitle}</p>
                </div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
                    + Buat Adjustment Baru
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal modal-large">
                        <div className="modal-header">
                            <h3>{editingItem ? 'Edit Adjustment' : 'Buat Adjustment Baru'}</h3>
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
                                        placeholder="Otomatis"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Tipe Transaksi</label>
                                    <select
                                        value={formData.transcode_id}
                                        onChange={(e) => {
                                            const selectedId = parseInt(e.target.value);
                                            const selectedTranscode = transcodes.find(t => t.id === selectedId);
                                            setFormData({ ...formData, transcode_id: selectedId });
                                            if (selectedTranscode) {
                                                generateNumber(selectedTranscode.code);
                                            }
                                        }}
                                        disabled={formData.status !== 'Draft'}
                                    >
                                        <option value="">-- Pilih Tipe --</option>
                                        {transcodes.map(t => (
                                            <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Tanggal</label>
                                    <input
                                        type="date"
                                        value={formData.doc_date}
                                        onChange={(e) => setFormData({ ...formData, doc_date: e.target.value })}
                                        required
                                        disabled={formData.status !== 'Draft'}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mata Uang / Kurs</label>
                                    <select
                                        value={formData.currency_code || ''}
                                        onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                                        disabled={formData.status !== 'Draft'}
                                    >
                                        <option value="">IDR (Default - Tanpa Kurs)</option>
                                        {currencies.filter(er => er.active === 'Y').map(er => (
                                            <option key={er.code} value={er.code}>
                                                {er.code} - {er.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Customer</label>
                                    <select
                                        value={formData.partner_id}
                                        onChange={(e) => {
                                            setFormData({ ...formData, partner_id: e.target.value, allocations: [] });
                                        }}
                                        required
                                        disabled={formData.status !== 'Draft'}
                                    >
                                        <option value="">-- Pilih Customer --</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Counter Account (COA)</label>
                                    <select
                                        value={formData.counter_account_id}
                                        onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}
                                        required
                                        disabled={formData.status !== 'Draft'}
                                    >
                                        <option value="">-- Pilih Akun Lawan --</option>
                                        {accounts.map(a => (
                                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Jumlah</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                        required
                                        disabled={formData.status !== 'Draft'}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Keterangan</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="2"
                                    disabled={formData.status !== 'Draft'}
                                />
                            </div>

                            {/* Invoice Allocation Section */}
                            <div className="form-section">
                                <div className="form-section-header">
                                    <h4>Alokasi ke Invoice</h4>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.allocate_to_invoice === 'Y'}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                allocate_to_invoice: e.target.checked ? 'Y' : 'N',
                                                allocations: e.target.checked ? formData.allocations : []
                                            })}
                                            disabled={formData.status !== 'Draft' || !formData.partner_id}
                                        />
                                        Alokasikan ke Invoice
                                    </label>
                                </div>

                                {formData.allocate_to_invoice === 'Y' && formData.partner_id && (
                                    <>
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>No. Invoice</th>
                                                    <th>Tanggal</th>
                                                    <th>Outstanding</th>
                                                    <th style={{ width: '150px' }}>Alokasi</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {invoices.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>
                                                            Tidak ada invoice outstanding untuk customer ini.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    invoices.map(inv => {
                                                        const allocation = formData.allocations.find(a => a.ar_invoice_id === inv.id);
                                                        return (
                                                            <tr key={inv.id}>
                                                                <td>{inv.doc_number}</td>
                                                                <td>{formatDate(inv.doc_date)}</td>
                                                                <td>{formatMoney(inv.outstanding_amount || inv.total_amount || 0)}</td>

                                                                <td>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="any"
                                                                        value={allocation?.allocated_amount || ''}
                                                                        onChange={(e) => handleAllocationChange(inv.id, e.target.value)}
                                                                        style={{ width: '100%' }}
                                                                        disabled={formData.status !== 'Draft'}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                                                    <td colSpan="3" style={{ textAlign: 'right' }}>Total Alokasi:</td>
                                                    <td style={{ color: Math.abs(totalAllocated - formData.amount) < 0.01 ? 'green' : 'red' }}>
                                                        {formatMoney(totalAllocated)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                        {Math.abs(totalAllocated - formData.amount) > 0.01 && (
                                            <p style={{ color: 'red', marginTop: '0.5rem' }}>
                                                ⚠️ Total alokasi ({formatMoney(totalAllocated)}) harus sama dengan jumlah adjustment ({formatMoney(formData.amount)})
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                                    {formData.status !== 'Draft' ? 'Tutup' : 'Batal'}
                                </button>
                                {formData.status === 'Draft' && (
                                    <button type="submit" className="btn btn-primary">
                                        {editingItem ? 'Update Adjustment' : 'Simpan Adjustment'}
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
                                <th>Tanggal</th>
                                <th>No. Dokumen</th>
                                <th>Customer</th>
                                <th>Jumlah</th>
                                <th>Counter Account</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {adjustments.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Belum ada Adjustment</td>
                                </tr>
                            ) : (
                                adjustments.map(adj => (
                                    <tr key={adj.id}>
                                        <td>{formatDate(adj.doc_date)}</td>
                                        <td><strong>{adj.doc_number}</strong></td>
                                        <td>{adj.partner_name || '-'}</td>
                                        <td>{formatMoney(adj.total_amount || adj.amount || 0)}</td>
                                        <td>{adj.counter_account_name || '-'}</td>
                                        <td>
                                            <span className={`badge ${getStatusBadge(adj.status)}`}>
                                                {adj.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div className="action-btn-group">
                                                {/* Group 1: Approval */}
                                                {((adj.status || '') === 'Draft' || (adj.status || '').startsWith('Pending')) && canApprove && (
                                                    <button className="btn-action approve" onClick={() => handleApprove(adj.id)} title="Approve">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                                        Approve
                                                    </button>
                                                )}
                                                {((adj.status || '').startsWith('Pending') || (adj.status || '') === 'Approved' || (adj.status || '') === 'Posted') && canApprove && (
                                                    <button className="btn-action unapprove" onClick={() => handleUnapprove(adj.id)} disabled={(adj.status || '') === 'Posted'} title={(adj.status || '') === 'Posted' ? 'Unpost dulu sebelum unapprove' : 'Unapprove'}>
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
                                                        Unapprove
                                                    </button>
                                                )}

                                                {/* Separator */}
                                                {((adj.status || '') === 'Approved' || (adj.status || '') === 'Posted') && canApprove && (
                                                    <span className="action-separator"></span>
                                                )}

                                                {/* Group 2: Posting */}
                                                {(adj.status || '') === 'Approved' && canApprove && (
                                                    <button className="btn-action post" onClick={() => handlePost(adj.id)} title="Post Transaksi">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                                                        Posting
                                                    </button>
                                                )}
                                                {(adj.status || '') === 'Posted' && canApprove && (
                                                    <button className="btn-action unpost" onClick={() => handleUnpost(adj.id)} title="Unpost">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                                                        Unpost
                                                    </button>
                                                )}

                                                {/* Separator */}
                                                <span className="action-separator"></span>

                                                {/* Group 3: Edit / Delete / Void / View */}
                                                {(adj.status || '') === 'Draft' && (
                                                    <button className="btn-action edit" onClick={() => handleEdit(adj.id)} title="Edit">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                                                        Edit
                                                    </button>
                                                )}
                                                {(adj.status || '') === 'Draft' && (
                                                    <button className="btn-action delete" onClick={() => handleDelete(adj.id)} title="Hapus">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                                        Hapus
                                                    </button>
                                                )}
                                                {((adj.status || '') === 'Draft' || (adj.status || '').startsWith('Pending') || (adj.status || '') === 'Approved') && (
                                                    <button className="btn-action void" onClick={() => handleDelete(adj.id)} title="Void Transaksi">
                                                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/></svg>
                                                        Void
                                                    </button>
                                                )}
                                                {(adj.status || '') !== 'Draft' && (
                                                    <button className="btn-action view" onClick={() => handleEdit(adj.id)} title="Lihat Detail">
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

export default ARAdjustmentList;


