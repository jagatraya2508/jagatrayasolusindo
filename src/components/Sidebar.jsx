export const menuItems = [
    {
        section: 'Menu Utama',
        items: [
            { id: 'dashboard', label: 'Dashboard', icon: 'home' },
        ],
    },
    {
        section: 'CRM',
        items: [
            { id: 'crm-lead', label: 'Lead', icon: 'user' },
            { id: 'crm-opportunity', label: 'Opportunity', icon: 'trending-up' },
            { id: 'crm-quotation', label: 'Quotation', icon: 'file-text' },
            { id: 'crm-activity', label: 'Activity', icon: 'calendar' },
            { id: 'crm-contact', label: 'Contact', icon: 'users' },
            { id: 'crm-report', label: 'CRM Report', icon: 'list' },
        ],
    },
    {
        section: 'Aset Tetap',
        items: [
            { id: 'fixed-asset-category', label: 'Kategori Aset', icon: 'list' },
            { id: 'fixed-asset', label: 'Daftar Aset Tetap', icon: 'package' },
            { id: 'fixed-asset-depreciation', label: 'Penyusutan', icon: 'trending-up' },
            { id: 'report/fixed-asset', label: 'Laporan Aset', icon: 'file-text' },
        ],
    },
    {
        section: 'Master Data',
        items: [
            { id: 'entity', label: 'Entity', icon: 'building' },
            { id: 'site', label: 'Site', icon: 'map-pin' },
            { id: 'supplier', label: 'Supplier', icon: 'truck' },
            { id: 'customer', label: 'Customer', icon: 'users' },
            { id: 'salesperson', label: 'Sales Person', icon: 'user' },
            { id: 'sales-area', label: 'Sales Area', icon: 'map' },
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
                    { id: 'unit-conversion', label: 'Konversi Satuan', icon: 'repeat' },
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
    {
        section: 'Laporan',
        items: [
            { id: 'report/sales-summary', label: 'Laporan Penjualan', icon: 'file-text' },
            { id: 'report/purchase-summary', label: 'Laporan Pembelian', icon: 'file-text' },
            { id: 'report/stock-summary', label: 'Laporan Stok', icon: 'list' },
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
];

const icons = {
    home: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
    ),

    building: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
            <line x1="9" y1="22" x2="9" y2="2"></line>
            <path d="M5 12h14"></path>
            <path d="M5 7h14"></path>
            <path d="M5 17h14"></path>
        </svg>
    ),
    'map-pin': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
        </svg>
    ),

    map: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            <line x1="8" y1="2" x2="8" y2="18"></line>
            <line x1="16" y1="6" x2="16" y2="22"></line>
        </svg>
    ),
    box: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
    ),
    truck: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
        </svg>
    ),
    users: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
    ),
    package: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
    ),
    user: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
        </svg>
    ),
    'file-text': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
    ),
    download: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
    ),
    'rotate-ccw': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
    ),
    'file-minus': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
    ),
    'shopping-cart': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
    ),
    send: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
    ),
    'rotate-cw': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
    ),
    'file-plus': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
    ),
    'dollar-sign': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
    ),
    'credit-card': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
    ),
    'book-open': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
    ),
    'ruler': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path>
            <path d="m15 5 4 4"></path>
            <path d="m11 9 2 2"></path>
            <path d="m7 13 2 2"></path>
        </svg>
    ),
    folder: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
    ),
    tag: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
    ),
    award: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="7"></circle>
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
        </svg>
    ),
    cpu: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
            <rect x="9" y="9" width="6" height="6"></rect>
            <line x1="9" y1="1" x2="9" y2="4"></line>
            <line x1="15" y1="1" x2="15" y2="4"></line>
            <line x1="9" y1="20" x2="9" y2="23"></line>
            <line x1="15" y1="20" x2="15" y2="23"></line>
            <line x1="20" y1="9" x2="23" y2="9"></line>
            <line x1="20" y1="14" x2="23" y2="14"></line>
            <line x1="1" y1="9" x2="4" y2="9"></line>
            <line x1="1" y1="14" x2="4" y2="14"></line>
        </svg>
    ),
    'hash': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="9" x2="20" y2="9"></line>
            <line x1="4" y1="15" x2="20" y2="15"></line>
            <line x1="10" y1="3" x2="8" y2="21"></line>
            <line x1="16" y1="3" x2="14" y2="21"></line>
        </svg>
    ),
    'list': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
    ),
    repeat: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9"></polyline>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
            <polyline points="7 23 3 19 7 15"></polyline>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>
    ),
    'settings': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
    ),
    calendar: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
    ),
    'trending-up': (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
    ),
};

import { useState, useEffect } from 'react';
import { usePeriod } from '../context/PeriodContext';
import { useAuth } from '../context/AuthContext';

import ChangePasswordModal from './ChangePasswordModal';

function Sidebar({ currentPage, setCurrentPage }) {
    const [activeMenuConfig, setActiveMenuConfig] = useState(null);
    const { selectedPeriod, setSelectedPeriod, periods } = usePeriod();
    const { user, logout, hasPermission } = useAuth();
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

    // Initialize expanded sections state
    const [expandedSections, setExpandedSections] = useState(() => {
        // Default: expand all sections initially
        const initial = {};
        menuItems.forEach(s => { initial[s.section] = true; });
        initial['Pengaturan'] = true; // Ensure Settings is expanded
        return initial;
    });

    const [expandedSubmenus, setExpandedSubmenus] = useState({});

    useEffect(() => {
        loadMenuConfig();
    }, []);

    const loadMenuConfig = () => {
        const saved = localStorage.getItem('sidebar_menu_config_v4');
        if (saved) {
            try {
                setActiveMenuConfig(JSON.parse(saved));
            } catch (e) {
                setActiveMenuConfig(null);
            }
        }
    };

    // Filter menu items based on permissions
    const getDisplayMenu = () => {
        // Use default menuItems
        let displayItems = menuItems;

        // If config exists, apply it (filtering/sorting)
        if (activeMenuConfig) {
            displayItems = activeMenuConfig
                .filter(section => section.visible)
                .sort((a, b) => a.order - b.order)
                .map(section => ({
                    section: section.section,
                    items: section.items
                        .filter(item => item.visible)
                        .sort((a, b) => a.order - b.order)
                }));
        }

        // Apply Permission Filter
        return displayItems.map(section => ({
            ...section,
            items: section.items.filter(item => hasPermission(item.id, 'view'))
        })).filter(section => section.items.length > 0);
    };

    const displayMenu = getDisplayMenu();

    // Toggle section expansion
    const toggleSection = (sectionName) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionName]: !prev[sectionName]
        }));
    };

    const toggleSubmenu = (submenuId) => {
        setExpandedSubmenus(prev => ({
            ...prev,
            [submenuId]: !prev[submenuId]
        }));
    };

    const handleLogout = () => {
        if (confirm('Yakin ingin logout?')) {
            logout();
        }
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1>JAGATRAYA</h1>
                <p>Enterprise Resource Planning</p>
                {user && (
                    <div style={{ fontSize: '0.8rem', color: '#a0aec0', marginTop: '0.5rem' }}>
                        Login sebagai: <strong style={{ color: 'white' }}>{user.full_name || user.username}</strong>
                    </div>
                )}
            </div>

            <div className="period-selector" style={{ padding: '0 1rem 1rem 1rem', borderBottom: '1px solid #48546b', marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#a0aec0', marginBottom: '0.25rem' }}>Periode Akuntansi</label>
                <select
                    value={selectedPeriod ? selectedPeriod.id : ''}
                    onChange={(e) => {
                        const pid = parseInt(e.target.value);
                        const p = periods.find(p => p.id === pid);
                        setSelectedPeriod(p || null);
                    }}
                    style={{
                        width: '100%',
                        padding: '0.4rem',
                        fontSize: '0.85rem',
                        backgroundColor: '#2d3748',
                        color: 'white',
                        border: '1px solid #4a5568',
                        borderRadius: '4px',
                        outline: 'none'
                    }}
                >
                    <option value="">-- Semua Periode --</option>
                    {periods.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.name} ({p.status})
                        </option>
                    ))}
                </select>
            </div>

            <div className="sidebar-menu-content" style={{ flex: 1, overflowY: 'auto' }}>
                {displayMenu.map((section) => (
                    <div key={section.section} className="nav-section">
                        <div
                            className="nav-section-title"
                            onClick={() => toggleSection(section.section)}
                            style={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                userSelect: 'none'
                            }}
                        >
                            <span>{section.section}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                {expandedSections[section.section] ? '▼' : '▶'}
                            </span>
                        </div>
                        {expandedSections[section.section] && section.items.map((item) => (
                            <div key={item.id}>
                                <div
                                    className={`nav-item ${(!item.subItems && currentPage === item.id) ? 'active' : ''}`}
                                    onClick={() => {
                                        if (item.subItems) {
                                            toggleSubmenu(item.id);
                                        } else {
                                            setCurrentPage(item.id);
                                        }
                                    }}
                                    style={item.subItems ? { justifyContent: 'space-between', display: 'flex', alignItems: 'center' } : {}}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        {icons[item.icon]}
                                        <span>{item.label}</span>
                                    </div>
                                    {item.subItems && (
                                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                            {expandedSubmenus[item.id] ? '▼' : '▶'}
                                        </span>
                                    )}
                                </div>

                                {item.subItems && expandedSubmenus[item.id] && (
                                    <div className="submenu" style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '4px', margin: '0.2rem 0.5rem' }}>
                                        {item.subItems.map(subItem => (
                                            <div
                                                key={subItem.id}
                                                className={`nav-item ${currentPage === subItem.id ? 'active' : ''}`}
                                                onClick={() => setCurrentPage(subItem.id)}
                                                style={{ paddingLeft: '3rem', fontSize: '0.85rem' }}
                                            >
                                                {icons[subItem.icon]}
                                                <span>{subItem.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ))}

                {/* Settings Section - Conditional based on role (or check specific permission) */}
                {/* Assuming all logged in users can see settings, but specific items inside might be restricted */}
                <div className="nav-section">
                    <div
                        className="nav-section-title"
                        onClick={() => toggleSection('Pengaturan')}
                        style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            userSelect: 'none'
                        }}
                    >
                        <span>Pengaturan</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                            {expandedSections['Pengaturan'] ? '▼' : '▶'}
                        </span>
                    </div>
                    {expandedSections['Pengaturan'] !== false && (
                        <>
                            {hasPermission('users', 'view') && (
                                <div className={`nav-item ${currentPage === 'users' ? 'active' : ''}`} onClick={() => setCurrentPage('users')}>
                                    {icons['users']} <span>Manajemen User</span>
                                </div>
                            )}
                            {hasPermission('roles', 'view') && (
                                <div className={`nav-item ${currentPage === 'roles' ? 'active' : ''}`} onClick={() => setCurrentPage('roles')}>
                                    {icons['settings']} <span>Manajemen Role</span>
                                </div>
                            )}
                            <div className={`nav-item ${currentPage === 'menu-settings' ? 'active' : ''}`} onClick={() => setCurrentPage('menu-settings')}>
                                {icons['settings']} <span>Pengaturan Menu</span>
                            </div>
                            <div className={`nav-item ${currentPage === 'system-settings' ? 'active' : ''}`} onClick={() => setCurrentPage('system-settings')}>
                                {icons['settings']} <span>Sistem Settings</span>
                            </div>
                            <div className={`nav-item ${currentPage === 'accounting-period' ? 'active' : ''}`} onClick={() => setCurrentPage('accounting-period')}>
                                {icons['calendar']} <span>Periode Akuntansi</span>
                            </div>
                            <div className={`nav-item ${currentPage === 'gl-settings' ? 'active' : ''}`} onClick={() => setCurrentPage('gl-settings')}>
                                {icons['settings']} <span>GL Settings</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="sidebar-footer" style={{ padding: '1rem', borderTop: '1px solid #48546b', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                    onClick={() => setIsChangePasswordOpen(true)}
                    style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#4a5568',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.5rem'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Ganti Password
                </button>
                <button
                    onClick={handleLogout}
                    style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#e53e3e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Logout
                </button>
            </div>

            <ChangePasswordModal
                isOpen={isChangePasswordOpen}
                onClose={() => setIsChangePasswordOpen(false)}
            />
        </aside>
    );
}

export default Sidebar;
