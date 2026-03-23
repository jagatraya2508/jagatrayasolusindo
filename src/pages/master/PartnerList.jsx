import { useState, useEffect } from 'react';

function PartnerList({ type }) {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [editingPartner, setEditingPartner] = useState(null);
    const [paymentTerms, setPaymentTerms] = useState([]);
    const [leads, setLeads] = useState([]);
    const [salesPersons, setSalesPersons] = useState([]);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        type: type,
        address: '',
        phone: '',
        credit_limit: 0,
        check_overdue: 'N',
        allowed_tops: [],
        sales_person_name: '',
        npwp_number: '',
        npwp_address: '',
        lead_id: '',
        sales_person_id: ''
    });
    const [systemSettings, setSystemSettings] = useState({});

    useEffect(() => {
        fetchPartners();
        fetchSystemSettings();
        fetchPaymentTerms(); // Fetch for both Customer and Supplier
        if (type === 'Customer') {
            fetchLeads();
            fetchSalesPersons();
        }
    }, [type]);

    const getToken = () => localStorage.getItem('token');
    
    const fetchLeads = async () => {
        try {
            const response = await fetch('/api/crm/leads', { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const data = await response.json();
            if (data.success) {
                setLeads(data.data.filter(l => l.status !== 'Lost'));
            }
        } catch (error) {
            console.error('Error fetching leads:', error);
        }
    };

    const fetchSalesPersons = async () => {
        try {
            const response = await fetch('/api/salespersons');
            const data = await response.json();
            if (data.success) {
                setSalesPersons(data.data.filter(sp => sp.active === 'Y'));
            }
        } catch (error) {
            console.error('Error fetching sales persons:', error);
        }
    };

    const fetchPaymentTerms = async () => {
        try {
            const response = await fetch('/api/payment-terms');
            const data = await response.json();
            if (data.success) {
                setPaymentTerms(data.data);
            }
        } catch (error) {
            console.error('Error fetching payment terms:', error);
        }
    };

    const fetchSystemSettings = async () => {
        try {
            const response = await fetch('/api/system-settings');
            const data = await response.json();
            if (data.success && data.data) {
                setSystemSettings(data.data);
            }
        } catch (error) {
            console.error('Error fetching system settings:', error);
        }
    };

    const fetchPartners = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/partners?type=${type}`);
            const data = await response.json();
            if (data.success) {
                setPartners(data.data);
            }
        } catch (error) {
            console.error('Error:', error);
        }
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingPartner ? `/api/partners/${editingPartner.id}` : '/api/partners';
            const method = editingPartner ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, type })
            });

            const data = await response.json();
            if (data.success) {
                alert(data.message);
                setShowForm(false);
                setEditingPartner(null);
                resetForm();
                fetchPartners();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleEdit = async (partner) => {
        let allowed_tops = [];
        try {
            const response = await fetch(`/api/partners/${partner.id}`);
            const data = await response.json();
            if (data.success && data.data && data.data.allowed_tops) {
                allowed_tops = data.data.allowed_tops;
            }
        } catch (e) { console.error('Error fetching partner details for TOPs', e); }

        setEditingPartner(partner);
        setFormData({
            code: partner.code,
            name: partner.name,
            type: partner.type,
            address: partner.address || '',
            phone: partner.phone || '',
            credit_limit: partner.credit_limit || 0,
            check_overdue: partner.check_overdue || 'N',
            allowed_tops: allowed_tops,
            sales_person_name: partner.sales_person_name || '',
            npwp_number: partner.npwp_number || '',
            npwp_address: partner.npwp_address || '',
            lead_id: partner.lead_id || '',
            sales_person_id: partner.sales_person_id || ''
        });
        setActiveTab('general');
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm(`Yakin ingin menghapus ${type} ini?`)) return;
        try {
            const response = await fetch(`/api/partners/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchPartners();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({ code: '', name: '', type: type, address: '', phone: '', credit_limit: 0, check_overdue: 'N', allowed_tops: [], sales_person_name: '', npwp_number: '', npwp_address: '', lead_id: '', sales_person_id: '' });
        setActiveTab('general');
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Master {type}</h1>
                <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingPartner(null); resetForm(); }}>
                    + Tambah {type}
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal modal-large">
                        <div className="modal-header">
                            <h3>{editingPartner ? `Edit ${type}` : `Tambah ${type} Baru`}</h3>
                            <button className="modal-close" onClick={() => { setShowForm(false); setEditingPartner(null); }}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            {/* Tabs Navigation */}
                            <div className="tabs" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('general')}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        borderBottom: activeTab === 'general' ? '2px solid #3b82f6' : '2px solid transparent',
                                        color: activeTab === 'general' ? '#3b82f6' : '#64748b',
                                        fontWeight: activeTab === 'general' ? '600' : '400',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Informasi Umum
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('tax')}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        borderBottom: activeTab === 'tax' ? '2px solid #3b82f6' : '2px solid transparent',
                                        color: activeTab === 'tax' ? '#3b82f6' : '#64748b',
                                        fontWeight: activeTab === 'tax' ? '600' : '400',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Pajak / NPWP
                                </button>
                            </div>

                            {activeTab === 'general' && (
                                <div>
                                    {type === 'Customer' && (
                                        <div className="form-row">
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label>Tampilkan / Tarik Data dari Lead (Opsional)</label>
                                                <select
                                                    value={formData.lead_id || ''}
                                                    onChange={(e) => {
                                                        const selectedLeadId = e.target.value;
                                                        if (!selectedLeadId) {
                                                            setFormData({ ...formData, lead_id: '' });
                                                            return;
                                                        }
                                                        const lead = leads.find(l => l.id == selectedLeadId);
                                                        if (lead) {
                                                            setFormData({
                                                                ...formData,
                                                                lead_id: lead.id,
                                                                name: lead.company_name || formData.name,
                                                                phone: lead.phone || formData.phone,
                                                                address: lead.address || formData.address
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <option value="">-- Tidak Tarik dari Lead --</option>
                                                    {leads.map(lead => (
                                                        <option key={lead.id} value={lead.id}>{lead.company_name} ({lead.contact_name}) - {lead.status}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                    <div className="form-row">
                                        <div className="form-group">
                                    <label>Kode</label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        required={
                                            (type === 'Customer' && systemSettings.CUSTOMER_ID_MODE !== 'AUTO') ||
                                            (type === 'Supplier' && systemSettings.SUPPLIER_ID_MODE !== 'AUTO') ||
                                            editingPartner !== null
                                        }
                                        disabled={
                                            !editingPartner &&
                                            ((type === 'Customer' && systemSettings.CUSTOMER_ID_MODE === 'AUTO') ||
                                                (type === 'Supplier' && systemSettings.SUPPLIER_ID_MODE === 'AUTO'))
                                        }
                                        placeholder={
                                            !editingPartner &&
                                                ((type === 'Customer' && systemSettings.CUSTOMER_ID_MODE === 'AUTO') ||
                                                    (type === 'Supplier' && systemSettings.SUPPLIER_ID_MODE === 'AUTO'))
                                                ? '[AUTO-GENERATED]' : ''
                                        }
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Nama {type}</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            {type === 'Customer' && (
                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Sales Person</label>
                                        <select
                                            value={formData.sales_person_id || ''}
                                            onChange={(e) => {
                                                const sp_id = e.target.value;
                                                const sp = salesPersons.find(s => s.id == sp_id);
                                                setFormData({ ...formData, sales_person_id: sp_id, sales_person_name: sp ? sp.name : '' });
                                            }}
                                        >
                                            <option value="">-- Pilih Sales Person --</option>
                                            {salesPersons.map(sp => (
                                                <option key={sp.id} value={sp.id}>{sp.code} - {sp.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {type === 'Supplier' && (
                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Nama Sales</label>
                                        <input
                                            type="text"
                                            value={formData.sales_person_name}
                                            onChange={(e) => setFormData({ ...formData, sales_person_name: e.target.value })}
                                            placeholder="Masukkan nama sales supplier"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="form-row">
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label>Alamat</label>
                                    <textarea
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        rows="2"
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
                            </div>

                            <div className="form-section">
                                <h4 style={{ marginBottom: '1rem', color: '#444', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Pengaturan Financial & TOP</h4>
                                {type === 'Customer' && (
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Credit Limit (Rp)</label>
                                            <input
                                                type="number"
                                                value={formData.credit_limit}
                                                onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                                                min="0"
                                                step="1000"
                                            />
                                        </div>
                                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.75rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: 0 }}>
                                                <input
                                                    type="checkbox"
                                                    style={{ width: 'auto', outline: 'none', margin: 0 }}
                                                    checked={formData.check_overdue === 'Y'}
                                                    onChange={(e) => setFormData({ ...formData, check_overdue: e.target.checked ? 'Y' : 'N' })}
                                                />
                                                <span>Blokir jika ada Piutang Jatuh Tempo (Overdue)</span>
                                            </label>
                                        </div>
                                </div>
                            )}

                            <div className="form-group">
                                        <label>TOP yang Diperbolehkan</label>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                            gap: '10px',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            border: '1px solid #e5e7eb',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            backgroundColor: '#f9fafb'
                                        }}>
                                            {paymentTerms.length === 0 ? (
                                                <span style={{ color: '#666', fontSize: '0.9em' }}>Data TOP belum tersedia.</span>
                                            ) : (
                                                paymentTerms.map(term => (
                                                    <label key={term.id} style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        marginBottom: 0,
                                                        fontWeight: 'normal',
                                                        cursor: 'pointer',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        transition: 'background 0.2s'
                                                    }} className="checkbox-item-hover">
                                                        <input
                                                            type="checkbox"
                                                            style={{ width: 'auto', margin: 0 }}
                                                            checked={formData.allowed_tops.includes(term.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setFormData({ ...formData, allowed_tops: [...formData.allowed_tops, term.id] });
                                                                } else {
                                                                    setFormData({ ...formData, allowed_tops: formData.allowed_tops.filter(id => id !== term.id) });
                                                                }
                                                            }}
                                                        />
                                                        <span>{term.name} ({term.days} Hari)</span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                            {activeTab === 'tax' && (
                                <div>
                                    <div className="form-section">
                                        <h4 style={{ marginBottom: '1rem', color: '#444', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Informasi NPWP</h4>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>No. NPWP</label>
                                                <input
                                                    type="text"
                                                    value={formData.npwp_number}
                                                    onChange={(e) => setFormData({ ...formData, npwp_number: e.target.value })}
                                                    placeholder="Masukkan Nomor NPWP"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group" style={{ flex: 1 }}>
                                                <label>Alamat NPWP</label>
                                                <textarea
                                                    value={formData.npwp_address}
                                                    onChange={(e) => setFormData({ ...formData, npwp_address: e.target.value })}
                                                    rows="3"
                                                    placeholder="Masukkan Alamat sesuai NPWP"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                                <div className="form-actions" style={{ marginTop: '20px' }}>
                                    <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Batal</button>
                                    <button type="submit" className="btn btn-primary">{editingPartner ? 'Update' : 'Simpan'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
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
                                <th>Alamat</th>
                                <th>Telepon</th>
                                {type === 'Supplier' && <th>Nama Sales</th>}
                                <th style={{ textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partners.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                                        Belum ada data {type}
                                    </td>
                                </tr>
                            ) : (
                                partners.map((partner) => (
                                    <tr key={partner.id}>
                                        <td><strong>{partner.code}</strong></td>
                                        <td>{partner.name}</td>
                                        <td>{partner.address}</td>
                                        <td>{partner.phone}</td>
                                        {type === 'Supplier' && <td>{partner.sales_person_name}</td>}
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn-icon" onClick={() => handleEdit(partner)} title="Edit">✏️</button>
                                            <button className="btn-icon" onClick={() => handleDelete(partner.id)} title="Hapus">🗑️</button>
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

export default PartnerList;
