import { useState, useEffect } from 'react';

// Default menu structure - MUST match Sidebar.jsx menuItems
const defaultMenuItems = [
    {
        section: 'Menu Utama',
        items: [{ id: 'dashboard', label: 'Dashboard', icon: 'home' }],
    },
    {
        section: 'Master Data',
        items: [
            { id: 'entity', label: 'Entity', icon: 'building' },
            { id: 'site', label: 'Site', icon: 'map-pin' },
            { id: 'supplier', label: 'Supplier', icon: 'truck' },
            { id: 'customer', label: 'Customer', icon: 'users' },
            { id: 'salesperson', label: 'Sales Person', icon: 'user' },
            {
                id: 'wh-group',
                label: 'Warehouse Group',
                icon: 'home',
                subItems: [
                    { id: 'warehouse', label: 'Warehouse', icon: 'home' },
                    { id: 'sub-warehouse', label: 'Sub Warehouse', icon: 'box' },
                    { id: 'location', label: 'Location', icon: 'map' },
                    { id: 'location-transfer', label: 'Pindah Gudang', icon: 'send' },
                ]
            },
            {
                id: 'dist-master',
                label: 'Distribution',
                icon: 'package',
                subItems: [
                    { id: 'item-group', label: 'Item Group', icon: 'folder' },
                    { id: 'item-category', label: 'Item Category', icon: 'tag' },
                    { id: 'item-brand', label: 'Item Brand', icon: 'award' },
                    { id: 'item-model', label: 'Item Model', icon: 'cpu' },
                    { id: 'item', label: 'Master Item', icon: 'package' },
                    { id: 'unit', label: 'Satuan', icon: 'ruler' },
                ]
            },
            {
                id: 'fin-master',
                label: 'Financial Master',
                icon: 'dollar-sign',
                subItems: [
                    { id: 'coa', label: 'Chart of Accounts', icon: 'book-open' },
                    { id: 'account-group', label: 'Group COA', icon: 'list' },
                    { id: 'coa-segment', label: 'COA Segment', icon: 'hash' },
                    { id: 'payment-term', label: 'Term of Payment', icon: 'credit-card' },
                    { id: 'currency', label: 'Master Currency', icon: 'dollar-sign' },
                    { id: 'exchange-rate-type', label: 'Exchange Rate Type', icon: 'repeat' },
                    { id: 'exchange-rate', label: 'Exchange Rate', icon: 'trending-up' },
                    { id: 'year-setup', label: 'Master Tahun', icon: 'calendar' },
                ]
            },
            { id: 'transcode', label: 'Tipe Transaksi', icon: 'hash' },
            { id: 'transaction', label: 'Transcode', icon: 'list' },
        ],
    },

    {
        section: 'Pembelian',
        items: [
            { id: 'purchase-order', label: 'Purchase Order', icon: 'file-text' },
            { id: 'receiving', label: 'Receiving', icon: 'download' },
            { id: 'purchase-return', label: 'Purchase Return', icon: 'rotate-ccw' },
            { id: 'ap-invoice', label: 'AP Invoice', icon: 'file-minus' },
        ],
    },
    {
        section: 'Penjualan',
        items: [
            { id: 'sales-order', label: 'Sales Order', icon: 'shopping-cart' },
            { id: 'shipment', label: 'Shipment', icon: 'send' },
            { id: 'sales-return', label: 'Sales Return', icon: 'rotate-cw' },
            { id: 'ar-invoice', label: 'AR Invoice', icon: 'file-plus' },
        ],
    },
    {
        section: 'Laporan',
        items: [
            { id: 'report/sales-summary', label: 'Laporan Penjualan', icon: 'file-text' },
            { id: 'report/purchase-summary', label: 'Laporan Pembelian', icon: 'file-text' },
            { id: 'report/trial-balance', label: 'Neraca Saldo', icon: 'book-open' },
            { id: 'report/profit-loss', label: 'Laba Rugi', icon: 'dollar-sign' },
            { id: 'report/balance-sheet', label: 'Neraca', icon: 'building' },
            { id: 'report/po-outstanding', label: 'PO Outstanding', icon: 'file-text' },
            { id: 'report/so-outstanding', label: 'SO Outstanding', icon: 'file-text' },
            { id: 'report/receiving-outstanding', label: 'Receiving Outstanding', icon: 'file-text' },
            { id: 'report/shipment-outstanding', label: 'Shipment Outstanding', icon: 'file-text' },
            { id: 'report/ap-outstanding', label: 'AP Outstanding', icon: 'file-text' },
            { id: 'report/ar-outstanding', label: 'AR Outstanding', icon: 'file-text' },
            { id: 'report/ap-aging', label: 'AP Aging', icon: 'file-text' },
            { id: 'report/ar-aging', label: 'AR Aging', icon: 'file-text' },
            { id: 'report/crystal-reports', label: 'User Defined Report', icon: 'file-text' },
        ],
    },
    {
        section: 'Keuangan',
        items: [
            { id: 'cash-in', label: 'Kas Masuk', icon: 'dollar-sign' },
            { id: 'cash-out', label: 'Kas Keluar', icon: 'dollar-sign' },
            { id: 'bank-in', label: 'Bank Masuk', icon: 'credit-card' },
            { id: 'bank-out', label: 'Bank Keluar', icon: 'credit-card' },
            { id: 'journal-voucher', label: 'Jurnal Voucher', icon: 'book-open' },
            { id: 'system-generated-journal', label: 'Auto Journal', icon: 'file-text' },
        ],
    },
    {
        section: 'Adjustment',
        items: [
            { id: 'inventory-adjustment-in', label: 'Inventory Adj. In', icon: 'download' },
            { id: 'inventory-adjustment-out', label: 'Inventory Adj. Out', icon: 'send' },
            { id: 'item-conversion', label: 'Konversi Item', icon: 'repeat' },
            { id: 'ap-debit-adjustment', label: 'AP Debit Adj.', icon: 'file-minus' },
            { id: 'ap-credit-adjustment', label: 'AP Credit Adj.', icon: 'file-plus' },
            { id: 'ar-debit-adjustment', label: 'AR Debit Adj.', icon: 'file-plus' },
            { id: 'ar-credit-adjustment', label: 'AR Credit Adj.', icon: 'file-minus' },
        ],
    },
    {
        section: 'Proses',
        items: [
            { id: 'recalculate-inventory', label: 'Recalculate Stock', icon: 'rotate-cw' },
        ],
    },
];


function MenuSettings() {
    const [menuConfig, setMenuConfig] = useState([]);
    const [expandedSections, setExpandedSections] = useState({});
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = () => {
        const saved = localStorage.getItem('sidebar_menu_config_v4');
        if (saved) {
            try {
                setMenuConfig(JSON.parse(saved));
            } catch (e) {
                setMenuConfig(initializeConfig());
            }
        } else {
            setMenuConfig(initializeConfig());
        }
    };

    const initializeConfig = () => {
        return defaultMenuItems.map((section, sIndex) => ({
            section: section.section,
            visible: true,
            order: sIndex,
            items: section.items.map((item, iIndex) => ({
                ...item,
                visible: true,
                order: iIndex,
                subItems: item.subItems ? item.subItems.map((sub, jIndex) => ({
                    ...sub,
                    visible: true,
                    order: jIndex
                })) : undefined
            }))
        }));
    };

    const toggleSection = (sectionName) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionName]: !prev[sectionName]
        }));
    };

    const moveSection = (index, direction) => {
        const newConfig = [...menuConfig];
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= newConfig.length) return;

        [newConfig[index], newConfig[newIndex]] = [newConfig[newIndex], newConfig[index]];
        newConfig.forEach((s, i) => s.order = i);
        setMenuConfig(newConfig);
        setHasChanges(true);
    };

    const moveItem = (sectionIndex, itemIndex, direction) => {
        const newConfig = [...menuConfig];
        const items = [...newConfig[sectionIndex].items];
        const newIndex = itemIndex + direction;
        if (newIndex < 0 || newIndex >= items.length) return;

        [items[itemIndex], items[newIndex]] = [items[newIndex], items[itemIndex]];
        items.forEach((item, i) => item.order = i);
        newConfig[sectionIndex].items = items;
        setMenuConfig(newConfig);
        setHasChanges(true);
    };

    const toggleSectionVisibility = (sectionIndex) => {
        const newConfig = [...menuConfig];
        newConfig[sectionIndex].visible = !newConfig[sectionIndex].visible;
        setMenuConfig(newConfig);
        setHasChanges(true);
    };

    const toggleItemVisibility = (sectionIndex, itemIndex) => {
        const newConfig = [...menuConfig];
        newConfig[sectionIndex].items[itemIndex].visible = !newConfig[sectionIndex].items[itemIndex].visible;
        setMenuConfig(newConfig);
        setHasChanges(true);
    };

    const moveItemToSection = (fromSectionIndex, itemIndex, toSectionIndex) => {
        if (fromSectionIndex === toSectionIndex) return;

        const newConfig = [...menuConfig];
        const item = newConfig[fromSectionIndex].items.splice(itemIndex, 1)[0];
        item.order = newConfig[toSectionIndex].items.length;
        newConfig[toSectionIndex].items.push(item);

        // Reorder remaining items in source section
        newConfig[fromSectionIndex].items.forEach((it, i) => it.order = i);

        setMenuConfig(newConfig);
        setHasChanges(true);
    };

    // Edit section name
    const editSection = (sectionIndex) => {
        const currentName = menuConfig[sectionIndex].section;
        const newName = prompt('Ubah nama section:', currentName);
        if (newName && newName.trim() && newName !== currentName) {
            const newConfig = [...menuConfig];
            newConfig[sectionIndex].section = newName.trim();
            setMenuConfig(newConfig);
            setHasChanges(true);
        }
    };

    // Delete section
    const deleteSection = (sectionIndex) => {
        const sectionName = menuConfig[sectionIndex].section;
        if (!confirm(`Apakah Anda yakin ingin menghapus section "${sectionName}"?`)) return;

        const newConfig = [...menuConfig];
        newConfig.splice(sectionIndex, 1);
        newConfig.forEach((s, i) => s.order = i);
        setMenuConfig(newConfig);
        setHasChanges(true);
    };

    // Edit item label
    const editItem = (sectionIndex, itemIndex) => {
        const currentLabel = menuConfig[sectionIndex].items[itemIndex].label;
        const newLabel = prompt('Ubah nama menu:', currentLabel);
        if (newLabel && newLabel.trim() && newLabel !== currentLabel) {
            const newConfig = [...menuConfig];
            newConfig[sectionIndex].items[itemIndex].label = newLabel.trim();
            setMenuConfig(newConfig);
            setHasChanges(true);
        }
    };

    // Delete item
    const deleteItem = (sectionIndex, itemIndex) => {
        const itemLabel = menuConfig[sectionIndex].items[itemIndex].label;
        if (!confirm(`Apakah Anda yakin ingin menghapus menu "${itemLabel}"?`)) return;

        const newConfig = [...menuConfig];
        newConfig[sectionIndex].items.splice(itemIndex, 1);
        newConfig[sectionIndex].items.forEach((it, i) => it.order = i);
        setMenuConfig(newConfig);
        setHasChanges(true);
    };

    const saveConfig = () => {
        localStorage.setItem('sidebar_menu_config_v4', JSON.stringify(menuConfig));
        setHasChanges(false);
        alert('Konfigurasi menu berhasil disimpan! Refresh halaman untuk melihat perubahan.');
    };

    const resetConfig = () => {
        if (!confirm('Apakah Anda yakin ingin mereset ke pengaturan default?')) return;
        const defaultConfig = initializeConfig();
        setMenuConfig(defaultConfig);
        localStorage.removeItem('sidebar_menu_config_v4');
        setHasChanges(false);
        alert('Konfigurasi menu direset ke default.');
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Pengaturan Menu</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-outline" onClick={resetConfig}>
                        🔄 Reset Default
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={saveConfig}
                        disabled={!hasChanges}
                    >
                        💾 Simpan Perubahan
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
                <p style={{ marginBottom: '1rem', color: '#666' }}>
                    Atur urutan dan visibilitas menu sidebar. Gunakan tombol ↑↓ untuk mengubah urutan,
                    dan checkbox untuk menyembunyikan/menampilkan menu.
                </p>

                {menuConfig.map((section, sIndex) => (
                    <div
                        key={section.section}
                        style={{
                            marginBottom: '1rem',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            backgroundColor: section.visible ? '#fff' : '#f5f5f5'
                        }}
                    >
                        {/* Section Header */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.75rem 1rem',
                                backgroundColor: '#f0f0f0',
                                borderRadius: '8px 8px 0 0',
                                borderBottom: '1px solid #ddd'
                            }}
                        >
                            <button
                                onClick={() => toggleSection(section.section)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    marginRight: '0.5rem',
                                    fontSize: '1rem'
                                }}
                            >
                                {expandedSections[section.section] ? '▼' : '▶'}
                            </button>

                            <input
                                type="checkbox"
                                checked={section.visible}
                                onChange={() => toggleSectionVisibility(sIndex)}
                                style={{ marginRight: '0.5rem' }}
                            />

                            <strong style={{ flex: 1, opacity: section.visible ? 1 : 0.5 }}>
                                {section.section}
                            </strong>

                            <span style={{ color: '#999', fontSize: '0.85rem', marginRight: '1rem' }}>
                                {section.items.filter(i => i.visible).length}/{section.items.length} item
                            </span>

                            <button
                                className="btn-icon"
                                onClick={() => moveSection(sIndex, -1)}
                                disabled={sIndex === 0}
                                title="Pindah ke atas"
                                style={{ marginRight: '0.25rem' }}
                            >
                                ↑
                            </button>
                            <button
                                className="btn-icon"
                                onClick={() => moveSection(sIndex, 1)}
                                disabled={sIndex === menuConfig.length - 1}
                                title="Pindah ke bawah"
                                style={{ marginRight: '0.25rem' }}
                            >
                                ↓
                            </button>
                            <button
                                className="btn-icon"
                                onClick={() => editSection(sIndex)}
                                title="Edit nama section"
                                style={{ marginRight: '0.25rem' }}
                            >
                                ✏️
                            </button>
                            <button
                                className="btn-icon"
                                onClick={() => deleteSection(sIndex)}
                                title="Hapus section"
                                style={{ color: '#dc3545' }}
                            >
                                🗑️
                            </button>
                        </div>

                        {/* Section Items */}
                        {expandedSections[section.section] && (
                            <div style={{ padding: '0.5rem' }}>
                                {section.items.map((item, iIndex) => (
                                    <div key={item.id}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0.5rem 0.75rem',
                                                borderBottom: iIndex < section.items.length - 1 ? '1px solid #eee' : 'none',
                                                opacity: item.visible ? 1 : 0.5
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={item.visible}
                                                onChange={() => toggleItemVisibility(sIndex, iIndex)}
                                                style={{ marginRight: '0.75rem' }}
                                            />

                                            <span style={{ flex: 1 }}>{item.label}</span>

                                            <select
                                                value={sIndex}
                                                onChange={(e) => moveItemToSection(sIndex, iIndex, parseInt(e.target.value))}
                                                style={{
                                                    marginRight: '0.5rem',
                                                    padding: '0.25rem',
                                                    fontSize: '0.8rem'
                                                }}
                                                title="Pindahkan ke section"
                                            >
                                                {menuConfig.map((s, idx) => (
                                                    <option key={s.section} value={idx}>
                                                        {s.section}
                                                    </option>
                                                ))}
                                            </select>

                                            <button
                                                className="btn-icon"
                                                onClick={() => moveItem(sIndex, iIndex, -1)}
                                                disabled={iIndex === 0}
                                                title="Pindah ke atas"
                                                style={{ marginRight: '0.25rem' }}
                                            >
                                                ↑
                                            </button>
                                            <button
                                                className="btn-icon"
                                                onClick={() => moveItem(sIndex, iIndex, 1)}
                                                disabled={iIndex === section.items.length - 1}
                                                title="Pindah ke bawah"
                                                style={{ marginRight: '0.25rem' }}
                                            >
                                                ↓
                                            </button>
                                            <button
                                                className="btn-icon"
                                                onClick={() => editItem(sIndex, iIndex)}
                                                title="Edit nama menu"
                                                style={{ marginRight: '0.25rem' }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="btn-icon"
                                                onClick={() => deleteItem(sIndex, iIndex)}
                                                title="Hapus menu"
                                                style={{ color: '#dc3545' }}
                                            >
                                                🗑️
                                            </button>
                                        </div>

                                        {/* Render SubItems as read-only info */}
                                        {
                                            item.subItems && (
                                                <div style={{ marginLeft: '2rem', padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                                                    {item.subItems.map(subItem => (
                                                        <div key={subItem.id} style={{ display: 'flex', padding: '0.2rem 0', opacity: 0.6, fontSize: '0.85rem' }}>
                                                            ↳ {subItem.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        }
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {hasChanges && (
                    <div style={{
                        padding: '1rem',
                        backgroundColor: '#fff3cd',
                        borderRadius: '8px',
                        marginTop: '1rem'
                    }}>
                        ⚠️ Ada perubahan yang belum disimpan. Klik "Simpan Perubahan" untuk menyimpan.
                    </div>
                )}
            </div>
        </div >
    );
}

export default MenuSettings;
