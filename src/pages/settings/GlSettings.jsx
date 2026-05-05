
import { useState, useEffect } from 'react';

const GlSettings = () => {
    const [settings, setSettings] = useState({});
    const [accounts, setAccounts] = useState([]);
    const [entities, setEntities] = useState([]);
    const [selectedEntity, setSelectedEntity] = useState('');
    const [loading, setLoading] = useState(true);

    // Base Schema Definition
    const baseRequiredSettings = [
        { key: 'inventory_account', label: 'Inventory (Persediaan)', type: 'Asset' },
        { key: 'cash_account', label: 'Cash / Bank (Kas/Bank)', type: 'Asset' },
        { key: 'ap_temp_account', label: 'AP Temporary (Hutang Sementara)', type: 'Liability' },
        { key: 'ap_trade_account', label: 'AP Trade (Hutang Dagang)', type: 'Liability' },
        { key: 'uninvoice_shipment_account', label: 'Uninvoiced Shipment', type: 'Asset' },
        { key: 'sales_temp_account', label: 'Sales Temporary (Penjualan Sementara)', type: 'Revenue' },
        { key: 'sales_account', label: 'Sales (Penjualan)', type: 'Revenue' },
        { key: 'ar_trade_account', label: 'AR Trade (Piutang Dagang)', type: 'Asset' },
        { key: 'vat_out_account', label: 'VAT Out (PPN Keluaran)', type: 'Liability' },
        { key: 'vat_in_account', label: 'VAT In (PPN Masukan)', type: 'Asset' },
        { key: 'cogs_account', label: 'COGS (HPP)', type: 'Expense' }
    ];

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (!loading) {
            fetchSettings();
        }
    }, [selectedEntity]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [accRes, entRes] = await Promise.all([
                fetch('/api/accounts'),
                fetch('/api/entities')
            ]);

            const accData = await accRes.json();
            const entData = await entRes.json();

            if (accData.success) setAccounts(accData.data);
            if (entData.success) setEntities(entData.data);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            fetchSettings(); // initial fetch for global/empty entity
        }
    };

    const fetchSettings = async () => {
        try {
            const url = selectedEntity ? `/api/gl-settings?entity_code=${selectedEntity}` : '/api/gl-settings';
            const setRes = await fetch(url);
            const setData = await setRes.json();

            if (setData.success) {
                // Transform API response object to simple key-value map for form
                const loadedSettings = {};
                Object.keys(setData.data).forEach(key => {
                    loadedSettings[key] = setData.data[key].account_id;
                });
                setSettings(loadedSettings);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const handleChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            entity_code: selectedEntity || null,
            settings: settings
        };

        try {
            const response = await fetch('/api/gl-settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) {
                alert('Pengaturan GL berhasil disimpan');
            } else {
                alert('Gagal menyimpan: ' + data.error);
            }
        } catch (error) {
            console.error('Error saving:', error);
            alert('Terjadi kesalahan koneksi');
        }
    };

    if (loading) return <div className="p-4">Loading...</div>;

    let requiredSettings = [...baseRequiredSettings];
    const selectedEntityObj = entities.find(e => e.code === selectedEntity);
    if (selectedEntityObj && selectedEntityObj.business_type_name && selectedEntityObj.business_type_name.match(/F\s*&\s*B/i)) {
        requiredSettings.push({ key: 'pb1_account', label: 'PB1 / Pajak Restoran', type: 'Liability' });
        requiredSettings.push({ key: 'service_charge_account', label: 'Service Charge', type: 'Revenue' });
    }

    return (
        <div className="container-fluid">
            <div className="page-header">
                <h1 className="page-title">General Ledger Settings</h1>
            </div>

            <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3>Mapping Akun Otomatis</h3>
                        <p className="text-muted">Tentukan akun default untuk jurnal otomatis sistem</p>
                    </div>
                    <div style={{ minWidth: '300px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563', marginBottom: '4px', display: 'block' }}>Pengaturan Untuk Entity:</label>
                        <select 
                            className="form-control" 
                            value={selectedEntity} 
                            onChange={(e) => setSelectedEntity(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                        >
                            <option value="">-- Global / Default Setting --</option>
                            {entities.map(ent => (
                                <option key={ent.id} value={ent.code}>{ent.code} - {ent.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            {requiredSettings.map(item => {
                                // Filter accounts by selected entity if one is selected
                                const filteredAccounts = selectedEntity 
                                    ? accounts.filter(acc => acc.code.startsWith(selectedEntity + '.')) 
                                    : accounts;

                                return (
                                    <div key={item.key} className="form-group">
                                        <label>
                                            {item.label}
                                            <span className="badge badge-secondary ml-2" style={{ fontSize: '0.7rem', marginLeft: '8px' }}>{item.type}</span>
                                        </label>
                                        <select
                                            className="form-control"
                                            value={settings[item.key] || ''}
                                            onChange={(e) => handleChange(item.key, e.target.value)}
                                            required
                                        >
                                            <option value="">-- Pilih Akun --</option>
                                            {filteredAccounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.code} - {acc.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="form-actions mt-4" style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                            <button type="submit" className="btn btn-primary">Simpan Pengaturan</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default GlSettings;
