import React, { useState, useEffect } from 'react';

function SystemSettings() {
    const [settings, setSettings] = useState({
        CUSTOMER_ID_MODE: 'MANUAL',
        SUPPLIER_ID_MODE: 'MANUAL',
        ITEM_ID_MODE: 'MANUAL',
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
                    <div className="form-group">
                        <label>Mode ID Customer</label>
                        <select
                            className="form-control"
                            value={settings.CUSTOMER_ID_MODE || 'MANUAL'}
                            onChange={(e) => setSettings({ ...settings, CUSTOMER_ID_MODE: e.target.value })}
                        >
                            <option value="MANUAL">Manual (Input Kode Sendiri)</option>
                            <option value="AUTO">Auto (Generate by System)</option>
                        </select>
                        <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                            Jika Auto, sistem akan membuat ID secara otomatis.
                        </small>
                    </div>

                    {settings.CUSTOMER_ID_MODE === 'AUTO' && (
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label>Format ID Customer</label>
                            <input
                                type="text"
                                className="form-control"
                                value={settings.CUSTOMER_ID_FORMAT || 'CUS-{YY}{MM}-{SEQ}'}
                                onChange={(e) => setSettings({ ...settings, CUSTOMER_ID_FORMAT: e.target.value })}
                            />
                            <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                                Tersedia: {'{YYYY}'} (Tahun), {'{YY}'} (Tahun 2 digit), {'{MM}'} (Bulan), {'{DD}'} (Tanggal), {'{SEQ}'} (Nomor Urut)
                            </small>
                        </div>
                    )}

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label>Mode ID Supplier</label>
                        <select
                            className="form-control"
                            value={settings.SUPPLIER_ID_MODE || 'MANUAL'}
                            onChange={(e) => setSettings({ ...settings, SUPPLIER_ID_MODE: e.target.value })}
                        >
                            <option value="MANUAL">Manual (Input Kode Sendiri)</option>
                            <option value="AUTO">Auto (Generate by System)</option>
                        </select>
                        <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                            Jika Auto, sistem akan membuat ID secara otomatis.
                        </small>
                    </div>

                    {settings.SUPPLIER_ID_MODE === 'AUTO' && (
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label>Format ID Supplier</label>
                            <input
                                type="text"
                                className="form-control"
                                value={settings.SUPPLIER_ID_FORMAT || 'SUP-{YY}{MM}-{SEQ}'}
                                onChange={(e) => setSettings({ ...settings, SUPPLIER_ID_FORMAT: e.target.value })}
                            />
                            <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                                Tersedia: {'{YYYY}'} (Tahun), {'{YY}'} (Tahun 2 digit), {'{MM}'} (Bulan), {'{DD}'} (Tanggal), {'{SEQ}'} (Nomor Urut)
                            </small>
                        </div>
                    )}

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label>Mode ID Item (Kode Barang)</label>
                        <select
                            className="form-control"
                            value={settings.ITEM_ID_MODE || 'MANUAL'}
                            onChange={(e) => setSettings({ ...settings, ITEM_ID_MODE: e.target.value })}
                        >
                            <option value="MANUAL">Manual (Input Kode Sendiri)</option>
                            <option value="AUTO">Auto (Generate by System)</option>
                        </select>
                        <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                            Jika Auto, sistem akan membuat ID secara otomatis.
                        </small>
                    </div>

                    {settings.ITEM_ID_MODE === 'AUTO' && (
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label>Format ID Item (Kode Barang)</label>
                            <input
                                type="text"
                                className="form-control"
                                value={settings.ITEM_ID_FORMAT || 'ITM-{YY}{MM}-{SEQ}'}
                                onChange={(e) => setSettings({ ...settings, ITEM_ID_FORMAT: e.target.value })}
                            />
                            <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                                Tersedia: {'{YYYY}'} (Tahun), {'{YY}'} (Tahun 2 digit), {'{MM}'} (Bulan), {'{DD}'} (Tanggal), {'{SEQ}'} (Nomor Urut)
                            </small>
                        </div>
                    )}

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
