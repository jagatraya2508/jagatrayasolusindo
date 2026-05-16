import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePeriod } from '../../context/PeriodContext';
function BankList({ transactionType }) {
    const { token, user } = useAuth();
    const { selectedPeriod } = usePeriod();
    const [canApprove, setCanApprove] = useState(false);

    const [journals, setJournals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [partners, setPartners] = useState([]);

    // Available transcodes
    const [availableTranscodes, setAvailableTranscodes] = useState([]);
    const [outstandingAp, setOutstandingAp] = useState([]);
    const [outstandingAr, setOutstandingAr] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        doc_number: 'AUTO',
        doc_date: new Date().toISOString().split('T')[0],
        description: '',
        type: transactionType || 'OUT',
        transcode_id: '',
        main_account_id: '',
        details: [],
        is_giro: false,
        giro_number: '',
        giro_due_date: '',
        giro_bank_name: ''
    });

    useEffect(() => {
        setAvailableTranscodes([]);
        setJournals([]);
        setFormData(prev => ({ ...prev, transcode_id: '', doc_number: 'AUTO', type: transactionType }));
        loadData();
        checkApprovalPermission();
    }, [transactionType, selectedPeriod]);

    const checkApprovalPermission = async () => {
        try {
            const txType = transactionType === 'IN' ? 'bank-in' : 'bank-out';
            const res = await fetch(`/api/approval-check/${txType}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setCanApprove(data.allowed === true);
        } catch { setCanApprove(false); }
    };

    // Removed standalone useEffect for fetchOutstandingInvoices to avoid race conditions
    // It is now called in loadData

    useEffect(() => {
        if (formData.transcode_id) {
            const tr = availableTranscodes.find(t => t.id === parseInt(formData.transcode_id));
            if (tr) {
                generateNumber(tr.code);
            }
        }
    }, [formData.transcode_id]);

    const loadData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchMasterData(),
                fetchJournals(),
                fetchOutstandingInvoices()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
        }
        setLoading(false);
    };

    const fetchMasterData = async () => {
        try {
            // Accounts
            const accRes = await fetch('/api/accounts');
            const accData = await accRes.json();
            if (accData.success) {
                setAccounts(accData.data);
                const bank = accData.data.filter(a =>
                    a.name.toLowerCase().includes('bank') ||
                    a.code.includes('1002')
                );
                setBankAccounts(bank);
            }

            // Partners
            const partnerRes = await fetch('/api/partners');
            const partnerData = await partnerRes.json();
            if (partnerData.success) {
                setPartners(partnerData.data);
            }

            // Transcodes
            const trRes = await fetch('/api/transcodes');
            const trData = await trRes.json();
            if (trData.success) {
                // Bank In = 12, Bank Out = 13 (nomortranscode)
                const targetNomor = transactionType === 'IN' ? 12 : 13;
                const filtered = trData.data.filter(t => t.nomortranscode === targetNomor);

                setAvailableTranscodes(filtered);

                if (filtered.length === 1) {
                    setFormData(prev => ({ ...prev, transcode_id: filtered[0].id }));
                }
            }
        } catch (error) {
            console.error('Error master data:', error);
        }
    };

    const fetchJournals = async () => {
        try {
            let url = '/api/journals?source_type=MANUAL';
            if (selectedPeriod) {
                url += `&period_id=${selectedPeriod.id}`;
            }
            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                const trRes = await fetch('/api/transcodes');
                const trData = await trRes.json();
                if (trData.success) {
                    const targetNomor = transactionType === 'IN' ? 12 : 13;
                    const validIds = trData.data.filter(t => t.nomortranscode === targetNomor).map(t => t.id);

                    const filtered = result.data.filter(j => validIds.includes(j.transcode_id));
                    setJournals(filtered);
                }
            }
        } catch (error) {
            console.error('Error:', error);
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



    const fetchOutstandingInvoices = async () => {
        try {
            const [apRes, arRes] = await Promise.all([
                fetch('/api/invoices/outstanding?type=AP'),
                fetch('/api/invoices/outstanding?type=AR')
            ]);

            const apData = await apRes.json();
            const arData = await arRes.json();

            const apList = apData.success ? apData.data : [];
            const arList = arData.success ? arData.data : [];

            setOutstandingAp(apList);
            setOutstandingAr(arList);

            return { ap: apList, ar: arList };
        } catch (error) {
            console.error('Error fetching invoices:', error);
            return { ap: [], ar: [] };
        }
    };

    const handleCreate = () => {
        resetForm();
        setShowForm(true);
        fetchOutstandingInvoices();
    };

    const resetForm = () => {
        const defaultTranscode = availableTranscodes.length === 1 ? availableTranscodes[0].id : '';
        setFormData({
            doc_number: 'AUTO',
            doc_date: new Date().toISOString().split('T')[0],
            description: '',
            type: transactionType || 'OUT',
            transcode_id: defaultTranscode,
            main_account_id: bankAccounts.length > 0 ? bankAccounts[0].id : '',
            details: [],
            is_giro: false,
            giro_number: '',
            giro_due_date: ''
        });
    };

    const handleAddLine = () => {
        setFormData(prev => ({
            ...prev,
            details: [...prev.details, { coa_id: '', description: '', amount: 0, ref_id: '', ref_type: '', partner_id: '' }]
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

        // Reset Partner and Invoice if COA changes to NON-AP/AR
        if (field === 'coa_id') {
            const selectedAcc = accounts.find(a => a.id === parseInt(value));
            const isAllocatable = selectedAcc && (
                selectedAcc.name.toLowerCase().includes('hutang') ||
                selectedAcc.name.toLowerCase().includes('piutang')
            );

            if (!isAllocatable) {
                newDetails[index]['partner_id'] = '';
                newDetails[index]['ref_id'] = '';
                newDetails[index]['ref_type'] = '';
                // Don't reset amount or description, user might just want to pay expense
            }
        }

        // Reset Invoice if Partner changes
        if (field === 'partner_id') {
            newDetails[index]['ref_id'] = '';
            newDetails[index]['amount'] = 0;
            newDetails[index]['description'] = '';
        }

        // Allocation Logic
        if (field === 'ref_id' && value) {
            // Find in either list
            const inv = outstandingAp.find(i => i.id === parseInt(value)) || outstandingAr.find(i => i.id === parseInt(value));
            if (inv) {
                newDetails[index]['amount'] = inv.balance;
                newDetails[index]['description'] = `Payment for ${inv.doc_number}`;

                const coaId = newDetails[index]['coa_id'];
                const selectedAcc = accounts.find(a => a.id === parseInt(coaId));
                let type = '';
                if (selectedAcc?.name.toLowerCase().includes('hutang')) type = 'AP';
                else if (selectedAcc?.name.toLowerCase().includes('piutang')) type = 'AR';

                newDetails[index]['ref_type'] = type;

                // Set partner_id if not set (though it should be set by now via UI, but for safety)
                if (inv.partner_id && !newDetails[index]['partner_id']) {
                    newDetails[index]['partner_id'] = inv.partner_id;
                }
            }
        }

        setFormData({ ...formData, details: newDetails });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.main_account_id) {
            alert('Pilih Akun Bank!');
            return;
        }

        if (!formData.transcode_id) {
            alert('Pilih Tipe Transaksi!');
            return;
        }

        const totalAmount = formData.details.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

        if (totalAmount <= 0) {
            alert('Total nominal harus lebih dari 0');
            return;
        }

        const journalDetails = [];

        // 1. Contra lines
        formData.details.forEach(d => {
            const amt = parseFloat(d.amount) || 0;
            if (amt > 0) {
                journalDetails.push({
                    coa_id: d.coa_id,
                    description: d.description || formData.description,
                    debit: formData.type === 'OUT' ? amt : 0,
                    credit: formData.type === 'IN' ? amt : 0,
                    // Pass allocation info
                    ref_id: d.ref_id || null,
                    ref_type: d.ref_type || null
                });
            }
        });

        // 2. Main line (Bank Account)
        journalDetails.push({
            coa_id: formData.main_account_id,
            description: formData.description,
            debit: formData.type === 'IN' ? totalAmount : 0,
            credit: formData.type === 'OUT' ? totalAmount : 0
        });

        const payload = {
            doc_number: formData.doc_number,
            doc_date: formData.doc_date,
            description: formData.description,
            transcode_id: parseInt(formData.transcode_id),
            source_type: 'MANUAL',
            details: journalDetails,
            is_giro: formData.is_giro ? 1 : 0,
            giro_number: formData.giro_number,
            giro_due_date: formData.giro_due_date,
            giro_bank_name: formData.giro_bank_name || null
        };

        try {
            let response;
            if (formData.id) {
                // Update
                response = await fetch(`/api/journals/${formData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // Create
                response = await fetch('/api/journals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const result = await response.json();
            if (result.success) {
                alert(formData.id ? 'Transaksi berhasil diupdate' : 'Transaksi berhasil dikirim');
                setShowForm(false);
                loadData();
            } else {
                alert('Gagal menyimpan: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving journal:', error);
            alert('Terjadi kesalahan saat menyimpan transaksi.');
        }
    };

    const handleEdit = async (journal) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/journals/${journal.id}`);
            const result = await response.json();

            // Fetch fresh invoices for lookup
            const { ap, ar } = await fetchOutstandingInvoices();

            if (result.success) {
                const data = result.data;

                let mainAccId = '';
                const details = [];
                const type = transactionType;

                // Find potential main account
                const bankIds = bankAccounts.map(c => c.id);
                const mainLine = data.details.find(d => bankIds.includes(d.coa_id));

                if (mainLine) {
                    mainAccId = mainLine.coa_id;
                }

                // Rest are details
                data.details.forEach(d => {
                    if (d.id === mainLine?.id) return;

                    const amt = parseFloat(d.debit) || parseFloat(d.credit);
                    if (amt > 0) {
                        let partnerId = d.partner_id || '';
                        if (!partnerId && d.ref_id) {
                            const inv = ap.find(i => i.id == d.ref_id) || ar.find(i => i.id == d.ref_id);
                            if (inv) partnerId = inv.partner_id;
                        }

                        details.push({
                            coa_id: d.coa_id,
                            description: d.description,
                            amount: amt,
                            ref_id: d.ref_id || '',
                            ref_type: d.ref_type || '',
                            partner_id: partnerId,
                            ref_doc_number: d.ref_doc_number,
                            partner_name: d.partner_name
                        });
                    }
                });

                setFormData({
                    id: data.id,
                    doc_number: data.doc_number,
                    doc_date: new Date(data.doc_date).toISOString().split('T')[0],
                    description: data.description,
                    type: type,
                    transcode_id: data.transcode_id,
                    main_account_id: mainAccId,
                    details: details,
                    is_giro: data.is_giro === 1,
                    giro_number: data.giro_number || '',
                    giro_due_date: data.giro_due_date ? new Date(data.giro_due_date).toISOString().split('T')[0] : '',
                    giro_bank_name: data.giro_bank_name || ''
                });

                setShowForm(true);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching details:', error);
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;
        try {
            const response = await fetch(`/api/journals/${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.success) {
                loadData();
            } else {
                alert('Gagal menghapus: ' + result.error);
            }
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan saat menghapus.');
        }
    };

    const handleApprove = async (id) => {
        if (!confirm('Apakah Anda yakin ingin menyetujui transaksi ini?')) return;
        try {
            const response = await fetch(`/api/journals/${id}/approve`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                loadData();
            } else {
                alert('Gagal menyetujui: ' + (result.reason || result.error));
            }
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan saat menyetujui.');
        }
    };

    const handleUnapprove = async (id) => {
        if (!confirm('Apakah Anda yakin ingin membatalkan persetujuan transaksi ini?')) return;
        try {
            const response = await fetch(`/api/journals/${id}/unapprove`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                loadData();
            } else {
                alert('Gagal membatalkan persetujuan: ' + (result.reason || result.error));
            }
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan saat membatalkan persetujuan.');
        }
    };

    const handlePost = async (id) => {
        if (!confirm('Apakah Anda yakin ingin mem-posting transaksi ini?')) return;
        try {
            const response = await fetch(`/api/journals/${id}/post`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                loadData();
            } else {
                alert('Gagal posting: ' + (result.reason || result.error));
            }
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan saat mem-posting.');
        }
    };

    const handleUnpost = async (id) => {
        if (!confirm('Apakah Anda yakin ingin membatalkan posting transaksi ini?')) return;
        try {
            const response = await fetch(`/api/journals/${id}/unpost`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                loadData();
            } else {
                alert('Gagal unpost: ' + (result.reason || result.error));
            }
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan saat unpost.');
        }
    };

    const handleVoid = async (id) => {
        if (!confirm('Apakah Anda yakin ingin melakukan Void (pembatalan) transaksi ini?\nTindakan ini tidak dapat dikembalikan dan akan membatalkan alokasi pembayaran!')) return;
        try {
            const response = await fetch(`/api/journals/${id}/void`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                loadData();
            } else {
                alert('Gagal void: ' + (result.reason || result.error));
            }
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan saat void.');
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
    };

    const formatDate = (date) => new Date(date).toLocaleDateString('id-ID');

    return (
        <div className="report-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Transaksi Bank {transactionType ? (transactionType === 'IN' ? 'Masuk' : 'Keluar') : ''}</h1>
                    <p className="text-subtitle">
                        Pencatatan bank {transactionType ? (transactionType === 'IN' ? 'masuk' : 'keluar') : 'masuk dan keluar'}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={handleCreate}>
                    + Transaksi Baru
                </button>
            </div>

            {showForm && (
                <div className="modal-overlay">
                    <div className="modal modal-large">
                        <div className="modal-header">
                            <h3>{formData.id ? 'Edit' : 'Baru'} Transaksi Bank {transactionType === 'IN' ? 'Masuk' : 'Keluar'}</h3>
                            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>No. Dokumen</label>
                                    <input type="text" value={formData.doc_number} readOnly className="form-control" style={{ backgroundColor: '#f0f0f0' }} />
                                </div>
                                <div className="form-group">
                                    <label>Tanggal</label>
                                    <input type="date" value={formData.doc_date} onChange={e => setFormData({ ...formData, doc_date: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Tipe Transaksi</label>
                                    {availableTranscodes.length > 0 ? (
                                        <select
                                            value={formData.transcode_id}
                                            onChange={e => setFormData({ ...formData, transcode_id: e.target.value })}
                                            required
                                            style={{ fontWeight: 'bold' }}
                                        >
                                            <option value="">-- Pilih Tipe Transaksi --</option>
                                            {availableTranscodes.map(tr => (
                                                <option key={tr.id} value={tr.id}>{tr.code} - {tr.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div style={{ padding: '0.5rem', color: 'red' }}>Tidak ada tipe transaksi tersedia</div>
                                    )}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Akun Bank</label>
                                    <select
                                        value={formData.main_account_id}
                                        onChange={e => setFormData({ ...formData, main_account_id: e.target.value })}
                                        required
                                        style={{ fontWeight: 'bold' }}
                                    >
                                        <option value="">-- Pilih Akun Bank --</option>
                                        {bankAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label>Keterangan Umum (Optional)</label>
                                    <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                                    <input type="checkbox" id="is_giro" checked={formData.is_giro} onChange={e => setFormData({ ...formData, is_giro: e.target.checked })} />
                                    <label htmlFor="is_giro" style={{ marginBottom: 0 }}>Gunakan Giro/Cek</label>
                                </div>
                                {formData.is_giro && (
                                    <>
                                        <div className="form-group">
                                            <label>Nama Bank</label>
                                            <input type="text" value={formData.giro_bank_name} onChange={e => setFormData({ ...formData, giro_bank_name: e.target.value })} placeholder="Nama Bank" />
                                        </div>
                                        <div className="form-group">
                                            <label>Nomor Giro/Cek</label>
                                            <input type="text" value={formData.giro_number} onChange={e => setFormData({ ...formData, giro_number: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label>Jatuh Tempo</label>
                                            <input type="date" value={formData.giro_due_date} onChange={e => setFormData({ ...formData, giro_due_date: e.target.value })} />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="form-section">
                                <div className="form-section-header">
                                    <h4>Rincian {formData.type === 'IN' ? 'Penerimaan' : 'Pengeluaran'}</h4>
                                    <button type="button" className="btn btn-outline btn-sm" onClick={handleAddLine}>+ Tambah Baris</button>
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '25%' }}>Akun Lawan (Contra)</th>
                                            <th style={{ width: '25%' }}>{formData.type === 'IN' ? 'Customer' : 'Supplier'}</th>
                                            <th style={{ width: '25%' }}>Alokasi Invoice</th>
                                            <th>Keterangan</th>
                                            <th style={{ width: '150px', textAlign: 'right' }}>Nominal</th>
                                            <th style={{ width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {formData.details.length === 0 ? (
                                            <tr><td colSpan="6" style={{ textAlign: 'center', color: '#999' }}>Klik Tambah Baris untuk input rincian</td></tr>
                                        ) : (
                                            formData.details.map((row, idx) => {
                                                const selectedAcc = accounts.find(a => a.id === parseInt(row.coa_id));
                                                const isHutang = selectedAcc && selectedAcc.name.toLowerCase().includes('hutang');
                                                const isPiutang = selectedAcc && selectedAcc.name.toLowerCase().includes('piutang');
                                                const isAllocatable = isHutang || isPiutang;

                                                let targetList = [];
                                                if (isHutang) targetList = outstandingAp;
                                                else if (isPiutang) targetList = outstandingAr;

                                                return (
                                                    <tr key={idx}>
                                                        <td>
                                                            <select value={row.coa_id} onChange={e => handleLineChange(idx, 'coa_id', e.target.value)} required style={{ width: '100%' }}>
                                                                <option value="">-- Pilih Akun --</option>
                                                                {accounts.map(acc => (
                                                                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                value={row.partner_id || ''}
                                                                onChange={e => handleLineChange(idx, 'partner_id', e.target.value)}
                                                                style={{ width: '100%' }}
                                                                disabled={!isAllocatable}
                                                            >
                                                                <option value="">-- Pilih Partner --</option>
                                                                {(() => {
                                                                    const partnerBalanceMap = new Map();
                                                                    const outstandingIds = new Set();
                                                                    const mergedPartners = [...partners];

                                                                    targetList.forEach(inv => {
                                                                        const bal = parseFloat(inv.balance) || 0;
                                                                        outstandingIds.add(inv.partner_id);
                                                                        if (partnerBalanceMap.has(inv.partner_id)) {
                                                                            partnerBalanceMap.set(inv.partner_id, partnerBalanceMap.get(inv.partner_id) + bal);
                                                                        } else {
                                                                            partnerBalanceMap.set(inv.partner_id, bal);
                                                                        }

                                                                        // Inject missing partner from outstanding list
                                                                        if (!mergedPartners.find(p => p.id === inv.partner_id)) {
                                                                            mergedPartners.push({
                                                                                id: inv.partner_id,
                                                                                name: inv.partner_name || `Partner #${inv.partner_id}`
                                                                            });
                                                                        }
                                                                    });

                                                                    // Filter: Only outstanding OR currently selected
                                                                    const selectedId = parseInt(row.partner_id);

                                                                    // Inject selected if still missing
                                                                    if (selectedId && !mergedPartners.find(p => p.id === selectedId)) {
                                                                        mergedPartners.push({
                                                                            id: selectedId,
                                                                            name: row.partner_name || `Partner #${selectedId} (Deleted)`
                                                                        });
                                                                    }

                                                                    const filteredPartners = mergedPartners.filter(p =>
                                                                        outstandingIds.has(p.id) || (selectedId && p.id === selectedId)
                                                                    );

                                                                    return filteredPartners.map(p => {
                                                                        const bal = partnerBalanceMap.get(p.id) || 0;
                                                                        let label = p.name;
                                                                        if (bal > 0) {
                                                                            label += ` (Total: ${new Intl.NumberFormat('id-ID').format(bal)})`;
                                                                        } else if (p.id === selectedId) {
                                                                            label += ` (History)`;
                                                                        }

                                                                        return (
                                                                            <option key={p.id} value={p.id}>
                                                                                {label}
                                                                            </option>
                                                                        );
                                                                    });
                                                                })()}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                value={row.ref_id || ''}
                                                                onChange={e => handleLineChange(idx, 'ref_id', e.target.value)}
                                                                style={{ width: '100%' }}
                                                                disabled={!isAllocatable || !row.partner_id}
                                                            >
                                                                <option value="">-- Tanpa Alokasi --</option>
                                                                {(() => {
                                                                    const pId = parseInt(row.partner_id);
                                                                    const filtered = targetList.filter(inv => !pId || inv.partner_id === pId);
                                                                    const options = filtered.map(inv => (
                                                                        <option key={inv.id} value={inv.id}>
                                                                            {inv.doc_number} - {new Date(inv.doc_date).toLocaleDateString()} ({new Intl.NumberFormat('id-ID').format(inv.balance)})
                                                                        </option>
                                                                    ));

                                                                    if (row.ref_id && !filtered.find(inv => inv.id == row.ref_id)) {
                                                                        options.unshift(
                                                                            <option key="selected_ref" value={row.ref_id}>
                                                                                {row.ref_doc_number || `Ref #${row.ref_id}`} (Selected)
                                                                            </option>
                                                                        );
                                                                    }
                                                                    return options;
                                                                })()}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <input type="text" value={row.description} onChange={e => handleLineChange(idx, 'description', e.target.value)} />
                                                        </td>
                                                        <td>
                                                            <input type="number" min="0" value={row.amount} onChange={e => handleLineChange(idx, 'amount', parseFloat(e.target.value) || 0)} style={{ textAlign: 'right' }} required />
                                                        </td>
                                                        <td>
                                                            <button type="button" className="btn-icon" onClick={() => handleRemoveLine(idx)}>🗑️</button>
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                                            <td colSpan="4" style={{ textAlign: 'right' }}>Total:</td>
                                            <td style={{ textAlign: 'right' }}>
                                                {formatMoney(formData.details.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0))}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Batal</button>
                                <button type="submit" className="btn btn-primary">{formData.id ? 'Simpan Perubahan' : 'Simpan Transaksi'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="card">
                {loading ? <div className="loading"><div className="loading-spinner"></div><p>Memuat...</p></div> : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No. Dokumen</th>
                                <th>Tanggal</th>
                                <th>Keterangan</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th style={{ width: '120px' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {journals.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1rem' }}>Belum ada transaksi</td></tr>
                            ) : (
                                journals.map(j => {
                                    // Use backend total_amount if available, else calc from details
                                    const total = j.total_amount ? parseFloat(j.total_amount) : (j.details ? j.details.reduce((sum, d) => sum + (parseFloat(d.debit) || 0), 0) : 0);
                                    return (
                                        <tr key={j.id}>

                                            <td><strong>{j.doc_number}</strong></td>
                                            <td>{formatDate(j.doc_date)}</td>
                                            <td>{j.description}</td>
                                            <td style={{ textAlign: 'right' }}>{formatMoney(total)}</td>
                                            <td><span className={`badge ${j.status === 'Draft' ? 'badge-warning' : (j.status === 'Voided' ? 'badge-danger' : (j.status.startsWith('Pending') ? 'badge-info' : (j.status === 'Approved' ? 'badge-primary' : 'badge-success')))}`}>{j.status}</span></td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div className="action-btn-group">
                                                    {/* Group 1: Approval */}
                                                    {(j.status === 'Draft' || j.status.startsWith('Pending')) && canApprove && (
                                                        <button className="btn-action approve" onClick={() => handleApprove(j.id)} title="Approve">
                                                            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                                            Approve
                                                        </button>
                                                    )}
                                                    {(j.status.startsWith('Pending') || j.status === 'Approved' || j.status === 'Posted') && canApprove && (
                                                        <button className="btn-action unapprove" onClick={() => handleUnapprove(j.id)} disabled={j.status === 'Posted'} title={j.status === 'Posted' ? 'Unpost dulu sebelum unapprove' : 'Unapprove'}>
                                                            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
                                                            Unapprove
                                                        </button>
                                                    )}

                                                    {/* Separator */}
                                                    {(j.status === 'Approved' || j.status === 'Posted') && canApprove && (
                                                        <span className="action-separator"></span>
                                                    )}

                                                    {/* Group 2: Posting */}
                                                    {j.status === 'Approved' && canApprove && (
                                                        <button className="btn-action post" onClick={() => handlePost(j.id)} title="Post Transaksi">
                                                            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                                                            Posting
                                                        </button>
                                                    )}
                                                    {j.status === 'Posted' && canApprove && (
                                                        <button className="btn-action unpost" onClick={() => handleUnpost(j.id)} title="Unpost">
                                                            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                                                            Unpost
                                                        </button>
                                                    )}

                                                    {/* Separator */}
                                                    <span className="action-separator"></span>

                                                    {/* Group 3: Edit / Delete / Void / View */}
                                                    {j.status === 'Draft' && (
                                                        <button className="btn-action edit" onClick={() => handleEdit(j)} title="Edit">
                                                            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                                                            Edit
                                                        </button>
                                                    )}
                                                    {j.status === 'Draft' && (
                                                        <button className="btn-action delete" onClick={() => handleDelete(j.id)} title="Hapus">
                                                            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                                            Hapus
                                                        </button>
                                                    )}
                                                    {(j.status === 'Draft' || j.status.startsWith('Pending') || j.status === 'Approved') && (
                                                        <button className="btn-action void" onClick={() => handleVoid(j.id)} title="Void Transaksi">
                                                            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/></svg>
                                                            Void
                                                        </button>
                                                    )}
                                                    {j.status !== 'Draft' && (
                                                        <button className="btn-action view" onClick={() => handleEdit(j)} title="Lihat Detail">
                                                            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                                                            Detail
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default BankList;
