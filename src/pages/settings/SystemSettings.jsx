import React, { useState, useEffect } from 'react';

function SystemSettings() {
    const [settings, setSettings] = useState({
        CUSTOMER_ID_MODE: 'MANUAL',
        SUPPLIER_ID_MODE: 'MANUAL',
        ITEM_ID_MODE: 'MANUAL',
        HR_APP_URL: 'http://localhost:5174',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/system-settings');
            const data = await response.json();
            if (data.success && data.data) {
                setSettings(prev => ({ ...prev, ...data.data }));
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/system-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await response.json();
            if (data.success) {
                alert('Pengaturan berhasil disimpan');
            } else {
                alert('Gagal menyimpan pengaturan: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title">Sistem Settings</h1>
                </div>
                <div className="card">
                    <div className="loading">
                        <div className="loading-spinner"></div>
                        <p>Memuat data...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Sistem Settings</h1>
            </div>

            <div className="card">
                <div style={{ maxWidth: '1000px' }}>
                    
                    {/* Customer Group */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px', backgroundColor: '#f8fafc' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.1rem', color: '#2d3748', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                            Pengaturan ID Pelanggan (Customer)
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: settings.CUSTOMER_ID_MODE === 'AUTO' ? '1fr 2fr 1fr' : '1fr', gap: '15px', alignItems: 'start' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Mode ID</label>
                                <select
                                    className="form-control"
                                    value={settings.CUSTOMER_ID_MODE || 'MANUAL'}
                                    onChange={(e) => setSettings({ ...settings, CUSTOMER_ID_MODE: e.target.value })}
                                >
                                    <option value="MANUAL">Manual (Input Kode Sendiri)</option>
                                    <option value="AUTO">Auto (Generate by System)</option>
                                </select>
                            </div>

                            {settings.CUSTOMER_ID_MODE === 'AUTO' && (
                                <>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Format ID</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={settings.CUSTOMER_ID_FORMAT || 'CUS-{YY}{MM}-{SEQ}'}
                                            onChange={(e) => setSettings({ ...settings, CUSTOMER_ID_FORMAT: e.target.value })}
                                        />
                                        <small style={{ color: '#718096', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                                            Tersedia: {'{YYYY}'}, {'{YY}'}, {'{MM}'}, {'{DD}'}, {'{SEQ}'}
                                        </small>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Digit Nomor Urut (SEQ)</label>
                                        <select
                                            className="form-control"
                                            value={settings.CUSTOMER_ID_SEQ_LENGTH || '4'}
                                            onChange={(e) => setSettings({ ...settings, CUSTOMER_ID_SEQ_LENGTH: e.target.value })}
                                        >
                                            <option value="2">2 Digit (01)</option>
                                            <option value="3">3 Digit (001)</option>
                                            <option value="4">4 Digit (0001)</option>
                                            <option value="5">5 Digit (00001)</option>
                                            <option value="6">6 Digit (000001)</option>
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Supplier Group */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px', backgroundColor: '#f8fafc' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.1rem', color: '#2d3748', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                            Pengaturan ID Pemasok (Supplier)
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: settings.SUPPLIER_ID_MODE === 'AUTO' ? '1fr 2fr 1fr' : '1fr', gap: '15px', alignItems: 'start' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Mode ID</label>
                                <select
                                    className="form-control"
                                    value={settings.SUPPLIER_ID_MODE || 'MANUAL'}
                                    onChange={(e) => setSettings({ ...settings, SUPPLIER_ID_MODE: e.target.value })}
                                >
                                    <option value="MANUAL">Manual (Input Kode Sendiri)</option>
                                    <option value="AUTO">Auto (Generate by System)</option>
                                </select>
                            </div>

                            {settings.SUPPLIER_ID_MODE === 'AUTO' && (
                                <>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Format ID</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={settings.SUPPLIER_ID_FORMAT || 'SUP-{YY}{MM}-{SEQ}'}
                                            onChange={(e) => setSettings({ ...settings, SUPPLIER_ID_FORMAT: e.target.value })}
                                        />
                                        <small style={{ color: '#718096', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                                            Tersedia: {'{YYYY}'}, {'{YY}'}, {'{MM}'}, {'{DD}'}, {'{SEQ}'}
                                        </small>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Digit Nomor Urut (SEQ)</label>
                                        <select
                                            className="form-control"
                                            value={settings.SUPPLIER_ID_SEQ_LENGTH || '4'}
                                            onChange={(e) => setSettings({ ...settings, SUPPLIER_ID_SEQ_LENGTH: e.target.value })}
                                        >
                                            <option value="2">2 Digit (01)</option>
                                            <option value="3">3 Digit (001)</option>
                                            <option value="4">4 Digit (0001)</option>
                                            <option value="5">5 Digit (00001)</option>
                                            <option value="6">6 Digit (000001)</option>
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Item Group */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px', backgroundColor: '#f8fafc' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.1rem', color: '#2d3748', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                            Pengaturan ID Barang (Item)
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: settings.ITEM_ID_MODE === 'AUTO' ? '1fr 2fr 1fr' : '1fr', gap: '15px', alignItems: 'start' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Mode ID</label>
                                <select
                                    className="form-control"
                                    value={settings.ITEM_ID_MODE || 'MANUAL'}
                                    onChange={(e) => setSettings({ ...settings, ITEM_ID_MODE: e.target.value })}
                                >
                                    <option value="MANUAL">Manual (Input Kode Sendiri)</option>
                                    <option value="AUTO">Auto (Generate by System)</option>
                                </select>
                            </div>

                            {settings.ITEM_ID_MODE === 'AUTO' && (
                                <>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Format ID</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={settings.ITEM_ID_FORMAT || 'ITM-{YY}{MM}-{SEQ}'}
                                            onChange={(e) => setSettings({ ...settings, ITEM_ID_FORMAT: e.target.value })}
                                        />
                                        <small style={{ color: '#718096', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                                            Tersedia: {'{YYYY}'}, {'{YY}'}, {'{MM}'}, {'{DD}'}, {'{SEQ}'}
                                        </small>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Digit Nomor Urut (SEQ)</label>
                                        <select
                                            className="form-control"
                                            value={settings.ITEM_ID_SEQ_LENGTH || '4'}
                                            onChange={(e) => setSettings({ ...settings, ITEM_ID_SEQ_LENGTH: e.target.value })}
                                        >
                                            <option value="2">2 Digit (01)</option>
                                            <option value="3">3 Digit (001)</option>
                                            <option value="4">4 Digit (0001)</option>
                                            <option value="5">5 Digit (00001)</option>
                                            <option value="6">6 Digit (000001)</option>
                                        </select>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Integration Group */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px', backgroundColor: '#f8fafc' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.1rem', color: '#2d3748', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                            Integrasi Aplikasi Lain
                        </h3>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Link Aplikasi JAGATRAYA HR</label>
                            <input
                                type="text"
                                className="form-control"
                                value={settings.HR_APP_URL || ''}
                                onChange={(e) => setSettings({ ...settings, HR_APP_URL: e.target.value })}
                                placeholder="Contoh: http://localhost:5174"
                            />
                            <small style={{ color: '#718096', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                                URL lengkap beserta port untuk mengakses aplikasi HR dari menu Sidebar. (Default: http://localhost:5174)
                            </small>
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SystemSettings;
