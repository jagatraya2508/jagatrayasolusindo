
import { useState, useEffect } from 'react';
import { usePeriod } from '../../context/PeriodContext';
import TransactionDetailModal from '../../components/TransactionDetailModal';

function TrialBalanceReport() {
    const { selectedPeriod } = usePeriod();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [entities, setEntities] = useState([]);
    const [filterEntity, setFilterEntity] = useState('');

    // Custom date range
    const formatDateISO = (d) => new Date(d).toISOString().split('T')[0];
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Drill-down states
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Initialize dates from selected period
    useEffect(() => {
        if (selectedPeriod) {
            setStartDate(formatDateISO(selectedPeriod.start_date));
            setEndDate(formatDateISO(selectedPeriod.end_date));
        }
    }, [selectedPeriod]);

    // Fetch entities
    useEffect(() => {
        fetchEntities();
    }, []);

    // Auto-fetch when dates or entity changes
    useEffect(() => {
        if (startDate && endDate) {
            fetchData();
        }
    }, [startDate, endDate, filterEntity]);

    const fetchEntities = async () => {
        try {
            const response = await fetch('/api/entities');
            const result = await response.json();
            if (result.success) {
                setEntities(result.data);
            }
        } catch (error) {
            console.error('Error fetching entities:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                startDate,
                endDate,
                ...(filterEntity && { entity_code: filterEntity })
            }).toString();

            const response = await fetch(`/api/reports/trial-balance?${query}`);
            const result = await response.json();

            if (result.success) {
                const activeData = result.data.filter(d =>
                    d.initial_balance !== 0 ||
                    d.movement_debit !== 0 ||
                    d.movement_credit !== 0 ||
                    d.ending_balance !== 0
                );
                setData(activeData);
            }
        } catch (error) {
            console.error('Error fetching trial balance:', error);
        }
        setLoading(false);
    };

    const handleRowClick = (account) => {
        setSelectedAccount(account);
        setIsModalOpen(true);
    };

    const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

    // Totals
    const totalOpening = data.reduce((acc, curr) => acc + curr.initial_balance, 0);
    const totalMutDebit = data.reduce((acc, curr) => acc + curr.movement_debit, 0);
    const totalMutCredit = data.reduce((acc, curr) => acc + curr.movement_credit, 0);
    const totalEnding = data.reduce((acc, curr) => acc + curr.ending_balance, 0);

    const inputStyle = {
        padding: '0.625rem 1rem',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '0.875rem',
        outline: 'none',
        backgroundColor: '#fff',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Neraca Saldo (Trial Balance)</h1>
            </div>

            {/* Filter Bar */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    {/* Entity Filter */}
                    <div style={{ minWidth: '220px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>Entity</label>
                        <select
                            value={filterEntity}
                            onChange={(e) => setFilterEntity(e.target.value)}
                            style={{ ...inputStyle, width: '100%' }}
                        >
                            <option value="">-- Semua Entity --</option>
                            {entities.map(ent => (
                                <option key={ent.id} value={ent.code}>{ent.code} - {ent.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Start Date */}
                    <div style={{ minWidth: '180px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>Dari Tanggal</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ ...inputStyle, width: '100%' }}
                        />
                    </div>

                    {/* End Date */}
                    <div style={{ minWidth: '180px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', marginBottom: '6px' }}>Sampai Tanggal</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ ...inputStyle, width: '100%' }}
                        />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, textAlign: 'right', fontSize: '0.85rem', color: '#6b7280', paddingBottom: '0.5rem' }}>
                        {startDate && endDate && (
                            <span>
                                Periode: <strong>{new Date(startDate).toLocaleDateString('id-ID')}</strong> s/d <strong>{new Date(endDate).toLocaleDateString('id-ID')}</strong>
                                {filterEntity && <> | Entity: <strong>{filterEntity}</strong></>}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="card">
                {loading ? <div className="loading">Loading...</div> : (
                    <>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th rowSpan="2" style={{ verticalAlign: 'middle' }}>Kode Akun</th>
                                    <th rowSpan="2" style={{ verticalAlign: 'middle' }}>Nama Akun</th>
                                    <th style={{ textAlign: 'right' }}>Saldo Awal</th>
                                    <th colSpan="2" style={{ textAlign: 'center' }}>Pergerakan (Mutation)</th>
                                    <th style={{ textAlign: 'right' }}>Saldo Akhir</th>
                                </tr>
                                <tr>
                                    <th style={{ textAlign: 'right', fontSize: '0.9em' }}>Net</th>
                                    <th style={{ textAlign: 'right', fontSize: '0.9em' }}>Debit</th>
                                    <th style={{ textAlign: 'right', fontSize: '0.9em' }}>Kredit</th>
                                    <th style={{ textAlign: 'right', fontSize: '0.9em' }}>Net</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.length === 0 ? (
                                    <tr><td colSpan="6" style={{ textAlign: 'center' }}>Tidak ada data</td></tr>
                                ) : (
                                    data.map((row) => (
                                        <tr
                                            key={row.code}
                                            onClick={() => handleRowClick(row)}
                                            style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                                            className="hover:bg-gray-100"
                                            title="Klik untuk lihat detail transaksi"
                                        >
                                            <td>{row.code}</td>
                                            <td>{row.name}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(row.initial_balance)}</td>
                                            <td style={{ textAlign: 'right', color: row.movement_debit > 0 ? 'inherit' : '#ccc' }}>
                                                {formatCurrency(row.movement_debit)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: row.movement_credit > 0 ? 'inherit' : '#ccc' }}>
                                                {formatCurrency(row.movement_credit)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(row.ending_balance)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot>
                                <tr style={{ fontWeight: 'bold', backgroundColor: '#f7fafc' }}>
                                    <td colSpan="2" style={{ textAlign: 'right' }}>Total</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(totalOpening)}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(totalMutDebit)}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(totalMutCredit)}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(totalEnding)}</td>
                                </tr>
                            </tfoot>
                        </table>
                        <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#718096' }}>
                            * Klik pada baris akun untuk melihat detail transaksi.
                        </div>
                    </>
                )}
            </div>

            {isModalOpen && selectedAccount && startDate && endDate && (
                <TransactionDetailModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    accountId={selectedAccount.id}
                    accountName={`${selectedAccount.code} - ${selectedAccount.name}`}
                    startDate={startDate}
                    endDate={endDate}
                />
            )}
        </div>
    );
}

export default TrialBalanceReport;
