
import { useState, useEffect } from 'react';
import { usePeriod } from '../../context/PeriodContext';

const SystemGeneratedJournalList = () => {
    const { selectedPeriod } = usePeriod();
    const [journals, setJournals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedJournal, setSelectedJournal] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchJournals();
    }, [selectedPeriod]);



    const fetchJournals = async () => {
        setLoading(true);
        try {
            let url = '/api/journals?source_type=SYSTEM';
            if (selectedPeriod) {
                url += `&period_id=${selectedPeriod.id}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                setJournals(data.data);
            }
        } catch (error) {
            console.error('Error fetching journals:', error);
        }
        setLoading(false);
    };

    const handleViewDetails = async (journal) => {
        try {
            const response = await fetch(`/api/journals/${journal.id}`);
            const data = await response.json();
            if (data.success) {
                setSelectedJournal(data.data);
                setShowModal(true);
            }
        } catch (error) {
            console.error('Error fetching details:', error);
        }
    };

    // Helper to format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
    };

    return (
        <div className="container-fluid">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="page-title">System Generated Journals</h1>
            </div>

            <div className="card">
                {loading ? (
                    <div className="p-4 text-center">Loading...</div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No. Jurnal</th>
                                <th>Tanggal</th>
                                <th>Deskripsi</th>
                                <th>Sumber</th>
                                <th>Ref ID</th>
                                <th>Status</th>
                                <th className="text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {journals.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center p-4">Belum ada jurnal otomatis</td>
                                </tr>
                            ) : (
                                journals.map(jv => (
                                    <tr key={jv.id}>
                                        <td><strong>{jv.doc_number}</strong></td>
                                        <td>{new Date(jv.doc_date).toLocaleDateString()}</td>
                                        <td>{jv.description}</td>
                                        <td><span className="badge badge-info">{jv.source_type}</span></td>
                                        <td>{jv.ref_id}</td>
                                        <td><span className="badge badge-success">{jv.status}</span></td>
                                        <td className="text-center">
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleViewDetails(jv)}
                                                title="Lihat Detail"
                                            >
                                                👁️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Detail Modal */}
            {showModal && selectedJournal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '800px' }}>
                        <div className="modal-header">
                            <h3>Detail Jurnal: {selectedJournal.doc_number}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px' }}>
                            <div className="info-row mb-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <label>Tanggal</label>
                                    <div><strong>{new Date(selectedJournal.doc_date).toLocaleDateString()}</strong></div>
                                </div>
                                <div>
                                    <label>Sumber</label>
                                    <div>{selectedJournal.source_type} #{selectedJournal.ref_id}</div>
                                </div>
                                <div>
                                    <label>Keterangan</label>
                                    <div>{selectedJournal.description}</div>
                                </div>
                            </div>

                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Akun</th>
                                        <th>Deskripsi</th>
                                        <th className="text-right">Debit</th>
                                        <th className="text-right">Kredit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedJournal.details.map((det, idx) => (
                                        <tr key={idx}>
                                            <td>{det.coa_code} - {det.coa_name}</td>
                                            <td>{det.description}</td>
                                            <td className="text-right">{formatCurrency(det.debit)}</td>
                                            <td className="text-right">{formatCurrency(det.credit)}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                                        <td colSpan="2" className="text-right">Total</td>
                                        <td className="text-right">
                                            {formatCurrency(selectedJournal.details.reduce((sum, d) => sum + Number(d.debit), 0))}
                                        </td>
                                        <td className="text-right">
                                            {formatCurrency(selectedJournal.details.reduce((sum, d) => sum + Number(d.credit), 0))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemGeneratedJournalList;
