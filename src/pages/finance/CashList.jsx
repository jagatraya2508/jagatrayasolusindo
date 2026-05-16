import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePeriod } from '../../context/PeriodContext';
function CashList({ transactionType }) {
    const { token, user } = useAuth();
    const { selectedPeriod } = usePeriod();
    const [canApprove, setCanApprove] = useState(false);

    const [journals, setJournals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [cashAccounts, setCashAccounts] = useState([]);

    // Available transcodes for selection
    const [availableTranscodes, setAvailableTranscodes] = useState([]);
    const [outstandingAp, setOutstandingAp] = useState([]);
    const [outstandingAr, setOutstandingAr] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        doc_number: 'AUTO',
        doc_date: new Date().toISOString().split('T')[0],
        description: '',
        type: transactionType || 'OUT',
        transcode_id: '', // Selected Transcode ID
        main_account_id: '',
        details: [],
        is_giro: false,
        giro_number: '',
        giro_due_date: '',
        giro_bank_name: ''
    });

    useEffect(() => {
        // Reset and load when transactionType changes
        setAvailableTranscodes([]);
        setJournals([]);
        setFormData(prev => ({ ...prev, transcode_id: '', doc_number: 'AUTO', type: transactionType }));
        loadData();
        checkApprovalPermission();
    }, [transactionType, selectedPeriod]);

    const checkApprovalPermission = async () => {
        try {
            const txType = transactionType === 'IN' ? 'cash-in' : 'cash-out';
            const res = await fetch(`/api/approval-check/${txType}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setCanApprove(data.allowed === true);
        } catch { setCanApprove(false); }
    };

    useEffect(() => {
        fetchOutstandingInvoices();
    }, [formData.type]);

    // Generate number when transcode_id changes
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
        await fetchMasterData();
        await fetchJournals();
        setLoading(false);
    };

    const fetchMasterData = async () => {
        try {
            // Accounts
            const accRes = await fetch('/api/accounts');
            const accData = await accRes.json();
            if (accData.success) {
                setAccounts(accData.data);
                const cash = accData.data.filter(a =>
                    a.name.toLowerCase().includes('kas') ||
                    a.name.toLowerCase().includes('cash') ||
                    a.code.startsWith('01-1001')
                );
                setCashAccounts(cash);
            }

            // Transcodes
            const trRes = await fetch('/api/transcodes');
            const trData = await trRes.json();
            if (trData.success) {
                // Cash In = 10, Cash Out = 11 (nomortranscode)
                const targetNomor = transactionType === 'IN' ? 10 : 11;
                const filtered = trData.data.filter(t => t.nomortranscode === targetNomor);

                setAvailableTranscodes(filtered);

                // Auto-select if only one
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
                // We need to valid Transcode IDs to filter the list
                // Since fetchMasterData runs in parallel or before, we might need access to 'availableTranscodes' 
                // but state update is async. 
                // Better strategy: Filter journals that MATCH 'nomortranscode' logic.
                // But journals don't have 'nomortranscode' column joined usually? 
                // Let's rely on fetching transcodes first and storing their IDs.

                // However, simply showing ALL journals for now and filtering by known IDs is safer if we want to show history.
                // But we only want to show journals that correspond to CURRENT transactionType (IN vs OUT).
                // So we need to know valid IDs.

                // Re-fetch transcodes for filtering purposes (or use what we have if we chain promises properly)
                const trRes = await fetch('/api/transcodes');
                const trData = await trRes.json();
                if (trData.success) {
                    const targetNomor = transactionType === 'IN' ? 10 : 11;
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

            if (apData.success) setOutstandingAp(apData.data);
            if (arData.success) setOutstandingAr(arData.data);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
    };

    const handleCreate = () => {
        resetForm();
        setShowForm(true);
    };

    const resetForm = () => {
        // Default selection
        const defaultTranscode = availableTranscodes.length === 1 ? availableTranscodes[0].id : '';
        setFormData({
            doc_number: 'AUTO',
            doc_date: new Date().toISOString().split('T')[0],
            description: '',
            type: transactionType || 'OUT',
            transcode_id: defaultTranscode,
            main_account_id: cashAccounts.length > 0 ? cashAccounts[0].id : '',
            details: [],
            is_giro: false,
            giro_number: '',
            giro_due_date: ''
        });

        // Trigger number generation if default selected
        // Effect hook determines this
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
                // Don't reset amount or description
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

                // Determine Ref Type based on which list it was found in logic
                // But better to rely on Line context (Hutang vs Piutang)
                const coaId = newDetails[index]['coa_id'];
                const selectedAcc = accounts.find(a => a.id === parseInt(coaId));
                let type = '';
                if (selectedAcc?.name.toLowerCase().includes('hutang')) type = 'AP';
                else if (selectedAcc?.name.toLowerCase().includes('piutang')) type = 'AR';

                newDetails[index]['ref_type'] = type;

                // Set partner_id if not set
                if (inv.partner_id && !newDetails[index]['partner_id']) {
                    newDetails[index]['partner_id'] = inv.partner_id;
                }
            }
        }

        setFormData({ ...formData, details: newDetails });
    };

    // Update handleSubmit to handle Edit (PUT)
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.main_account_id) {
            alert('Pilih Akun Kas!');
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

        // Prepare details for POST/PUT
        const journalDetails = [];

        // 1. Contra lines (User inputs)
        formData.details.forEach(d => {
            const amt = parseFloat(d.amount) || 0;
            if (amt > 0) {
                const det = {
                    coa_id: d.coa_id,
                    description: d.description || formData.description,
                    debit: formData.type === 'OUT' ? amt : 0,
                    credit: formData.type === 'IN' ? amt : 0,
                    // Pass allocation info
                    ref_id: d.ref_id || null,
                    ref_type: d.ref_type || null
                };
                journalDetails.push(det);
            }
        });

        // 2. Main line (Cash Account)
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
            source_type: 'MANUAL', // Always manual for this form
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

            if (result.success) {
                const data = result.data;

                // Parse details to match form structure
                // Form expects "Contra" lines. Backend returns all lines (including Main).
                // We need to identify Main Account line vs Contra lines.
                // In generic Journal, it's hard. But for Cash Transaction, we assume:
                // Main Line = Line matching main_account_id (or logic based on Type)

                // Let's find the Main Line.
                // For Cash IN: Main is DEBIT. Contra is CREDIT.
                // For Cash OUT: Main is CREDIT. Contra is DEBIT.

                // However, we stored main_account_id in local state 'cashAccounts'.
                // Ideally we find the line that matches one of 'cashAccounts' AND matches the logic direction.

                // Simplification for now:
                // Find line with largest Value matching Type direction?
                // Or just filter out the main line if we can identify it.

                // Let's rely on what we saved. We saved Main line at the end usually. 
                // But DB order isn't guaranteed.

                // Strategy:
                // 1. Identify Main Account ID from the journal lines that is in `cashAccounts`.
                // 2. Set that as `main_account_id`.
                // 3. Set remaining lines as `details`.

                let mainAccId = '';
                const details = [];
                const type = transactionType; // Current view context (IN/OUT)

                // Find potential main account
                const cashIds = cashAccounts.map(c => c.id);
                const mainLine = data.details.find(d => cashIds.includes(d.coa_id));

                if (mainLine) {
                    mainAccId = mainLine.coa_id;
                }

                // Rest are details
                data.details.forEach(d => {
                    if (d.id === mainLine?.id) return; // Skip main line

                    // Determine amount
                    const amt = parseFloat(d.debit) || parseFloat(d.credit);
                    if (amt > 0) {
                        details.push({
                            coa_id: d.coa_id,
                            description: d.description,
                            amount: amt,
                            ref_id: d.ref_id || '',
                            ref_type: d.ref_type || '', // AP/AR
                            partner_id: '' // Need to infer? Or API should return it? API returns ref_type/id.
                            // We can re-fetch partner from ref_id logic or leave blank if lazy.
                            // Better: The 'ref_type/ref_id' logic in handleLineChange sets it. 
                            // But here we need to populate it for the dropdown to work.
                            // If ref_id exists, we can try to find it in outstanding lists? 
                            // Issue: Paid invoices are NOT in outstanding list anymore.
                            // So we can't show them in dropdown if we filter by "Outstanding".
                        });
                    }
                });

                // If editing a PAID transaction, the invoice is no longer "Outstanding".
                // So our "Period" / "Outstanding" dropdown won't show it.
                // This is a common issue. 
                // Fix: Fetch the specific Invoice info if ref_id exists?
                // Or just leave it as text?
                // For now, let's load what we can.

                setFormData({
                    id: data.id,
                    doc_number: data.doc_number,
                    doc_date: new Date(data.doc_date).toISOString().split('T')[0],
                    description: data.description,
                    type: type, // Keep context
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
                    <h1 className="page-title">Transaksi Kas {transactionType ? (transactionType === 'IN' ? 'Masuk' : 'Keluar') : ''}</h1>
                    <p className="text-subtitle">
                        Pencatatan kas {transactionType ? (transactionType === 'IN' ? 'masuk' : 'keluar') : 'masuk dan keluar'}
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
                            <h3>{formData.id ? 'Edit' : 'Baru'} Transaksi Kas {transactionType === 'IN' ? 'Masuk' : 'Keluar'}</h3>
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
                                    <label>Akun Kas</label>
                                    <select
                                        value={formData.main_account_id}
                                        onChange={e => setFormData({ ...formData, main_account_id: e.target.value })}
                                        required
                                        style={{ fontWeight: 'bold' }}
                                    >
                                        <option value="">-- Pilih Akun Kas --</option>
                                        {cashAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label>Keterangan Umum (Optional)</label>
                                    <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                </div>
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
                                                                    const partnerMap = new Map();
                                                                    targetList.forEach(inv => {
                                                                        if (!partnerMap.has(inv.partner_id)) {
                                                                            partnerMap.set(inv.partner_id, { name: inv.partner_name, balance: 0 });
                                                                        }
                                                                        partnerMap.get(inv.partner_id).balance += (parseFloat(inv.balance) || 0);
                                                                    });

                                                                    return [...partnerMap.entries()].map(([id, data]) => (
                                                                        <option key={id} value={id}>
                                                                            {data.name} (Total: {new Intl.NumberFormat('id-ID').format(data.balance)})
                                                                        </option>
                                                                    ));
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
                                                                {targetList
                                                                    .filter(inv => !row.partner_id || inv.partner_id === parseInt(row.partner_id))
                                                                    .map(inv => (
                                                                        <option key={inv.id} value={inv.id}>
                                                                            {inv.doc_number} - {new Date(inv.doc_date).toLocaleDateString()} ({new Intl.NumberFormat('id-ID').format(inv.balance)})
                                                                        </option>
                                                                    ))}
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

export default CashList;
