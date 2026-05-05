import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';

function CrmReport() {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const { user } = useAuth();
    const printRef = useRef();

    useEffect(() => { fetchDashboard(); }, []);

    const getToken = () => localStorage.getItem('token');

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/crm/dashboard', { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const data = await response.json();
            if (data.success) setDashboardData(data.data);
        } catch (error) { console.error('Error:', error); }
        setLoading(false);
    };

    const formatCurrency = (val) => new Intl.NumberFormat('id-ID').format(val || 0);
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

    const stageColors = { Prospecting: '#3182ce', Proposal: '#d69e2e', Negotiation: '#805ad5', 'Closed Won': '#38a169', 'Closed Lost': '#e53e3e' };
    const statusColors = { New: '#3182ce', Contacted: '#d69e2e', Qualified: '#38a169', Lost: '#e53e3e' };
    const quotStatusColors = { Draft: '#6b7280', Sent: '#3182ce', Accepted: '#38a169', Rejected: '#e53e3e' };

    // ==================== PRINT ====================
    const handlePrint = () => {
        window.print();
    };

    // ==================== EXPORT EXCEL ====================
    const handleExportExcel = () => {
        if (!dashboardData) return;
        setExporting(true);
        try {
            const { summary, leadsByStatus, oppsByStage, quotsByStatus, recentActivities } = dashboardData;
            const wb = XLSX.utils.book_new();

            // Sheet 1: Summary
            const summaryData = [
                ['CRM Dashboard Report'],
                ['Tanggal Export', new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })],
                [],
                ['Metrik', 'Nilai'],
                ['Total Leads', summary.totalLeads],
                ['Total Opportunities', summary.totalOpportunities],
                ['Total Quotations', summary.totalQuotations],
                ['Pipeline Value (Rp)', summary.pipelineValue || 0],
                ['Won Value (Rp)', summary.wonValue || 0],
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            wsSummary['!cols'] = [{ wch: 25 }, { wch: 25 }];
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

            // Sheet 2: Lead by Status
            const leadData = [['Status', 'Jumlah'], ...leadsByStatus.map(l => [l.status, l.count])];
            const wsLead = XLSX.utils.aoa_to_sheet(leadData);
            wsLead['!cols'] = [{ wch: 20 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, wsLead, 'Lead by Status');

            // Sheet 3: Opportunity Pipeline
            const oppData = [['Stage', 'Jumlah', 'Total Value (Rp)'], ...oppsByStage.map(o => [o.stage, o.count, o.total_value || 0])];
            const wsOpp = XLSX.utils.aoa_to_sheet(oppData);
            wsOpp['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, wsOpp, 'Opportunity Pipeline');

            // Sheet 4: Quotation by Status
            const quotData = [['Status', 'Jumlah', 'Total Value (Rp)'], ...quotsByStatus.map(q => [q.status, q.count, q.total_value || 0])];
            const wsQuot = XLSX.utils.aoa_to_sheet(quotData);
            wsQuot['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, wsQuot, 'Quotation by Status');

            // Sheet 5: Recent Activities
            const actData = [
                ['Tipe', 'Subject', 'Lead', 'Tanggal', 'Status'],
                ...recentActivities.map(a => [
                    a.activity_type || '-',
                    a.subject || '-',
                    a.lead_name || '-',
                    a.activity_date ? formatDate(a.activity_date) : '-',
                    a.status || '-'
                ])
            ];
            const wsAct = XLSX.utils.aoa_to_sheet(actData);
            wsAct['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, wsAct, 'Aktivitas Terakhir');

            XLSX.writeFile(wb, `CRM_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error('Export Excel Error:', error);
            alert('Gagal export Excel: ' + error.message);
        }
        setExporting(false);
    };

    // ==================== EXPORT PDF ====================
    const handleExportPDF = async () => {
        if (!dashboardData) return;
        setExporting(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const { summary, leadsByStatus, oppsByStage, quotsByStatus, recentActivities } = dashboardData;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            let y = 15;

            // Title
            doc.setFontSize(18);
            doc.setTextColor(30, 58, 138);
            doc.text('CRM Dashboard & Report', pageWidth / 2, y, { align: 'center' });
            y += 8;

            doc.setFontSize(10);
            doc.setTextColor(107, 114, 128);
            doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageWidth / 2, y, { align: 'center' });
            y += 10;

            // Divider
            doc.setDrawColor(209, 213, 219);
            doc.line(14, y, pageWidth - 14, y);
            y += 8;

            // Summary Cards as Table
            doc.setFontSize(13);
            doc.setTextColor(31, 41, 55);
            doc.text('Ringkasan', 14, y);
            y += 6;

            autoTable(doc, {
                startY: y,
                head: [['Metrik', 'Nilai']],
                body: [
                    ['Total Leads', String(summary.totalLeads)],
                    ['Total Opportunities', String(summary.totalOpportunities)],
                    ['Total Quotations', String(summary.totalQuotations)],
                    ['Pipeline Value', `Rp ${formatCurrency(summary.pipelineValue)}`],
                    ['Won Value', `Rp ${formatCurrency(summary.wonValue)}`],
                ],
                theme: 'grid',
                headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 10 },
                bodyStyles: { fontSize: 10, textColor: [31, 41, 55] },
                alternateRowStyles: { fillColor: [245, 247, 250] },
                margin: { left: 14, right: 14 },
                tableWidth: 'auto',
                columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 60 } },
            });
            y = doc.lastAutoTable.finalY + 12;

            // Lead by Status
            doc.setFontSize(13);
            doc.setTextColor(31, 41, 55);
            doc.text('Lead berdasarkan Status', 14, y);
            y += 6;

            if (leadsByStatus.length > 0) {
                autoTable(doc, {
                    startY: y,
                    head: [['Status', 'Jumlah']],
                    body: leadsByStatus.map(l => [l.status, String(l.count)]),
                    theme: 'grid',
                    headStyles: { fillColor: [102, 126, 234], textColor: 255, fontStyle: 'bold', fontSize: 10 },
                    bodyStyles: { fontSize: 10, textColor: [31, 41, 55] },
                    alternateRowStyles: { fillColor: [245, 247, 250] },
                    margin: { left: 14, right: 14 },
                    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 40 } },
                });
                y = doc.lastAutoTable.finalY + 12;
            } else {
                doc.setFontSize(10);
                doc.setTextColor(150);
                doc.text('Belum ada data', 14, y);
                y += 10;
            }

            // Opportunity Pipeline
            if (y > 240) { doc.addPage(); y = 15; }
            doc.setFontSize(13);
            doc.setTextColor(31, 41, 55);
            doc.text('Opportunity Pipeline', 14, y);
            y += 6;

            if (oppsByStage.length > 0) {
                autoTable(doc, {
                    startY: y,
                    head: [['Stage', 'Jumlah', 'Total Value (Rp)']],
                    body: oppsByStage.map(o => [o.stage, String(o.count), `Rp ${formatCurrency(o.total_value)}`]),
                    theme: 'grid',
                    headStyles: { fillColor: [245, 87, 108], textColor: 255, fontStyle: 'bold', fontSize: 10 },
                    bodyStyles: { fontSize: 10, textColor: [31, 41, 55] },
                    alternateRowStyles: { fillColor: [245, 247, 250] },
                    margin: { left: 14, right: 14 },
                    columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 30 }, 2: { cellWidth: 50 } },
                });
                y = doc.lastAutoTable.finalY + 12;
            } else {
                doc.setFontSize(10);
                doc.setTextColor(150);
                doc.text('Belum ada data', 14, y);
                y += 10;
            }

            // Quotation by Status
            if (y > 240) { doc.addPage(); y = 15; }
            doc.setFontSize(13);
            doc.setTextColor(31, 41, 55);
            doc.text('Quotation berdasarkan Status', 14, y);
            y += 6;

            if (quotsByStatus.length > 0) {
                autoTable(doc, {
                    startY: y,
                    head: [['Status', 'Jumlah', 'Total Value (Rp)']],
                    body: quotsByStatus.map(q => [q.status, String(q.count), `Rp ${formatCurrency(q.total_value)}`]),
                    theme: 'grid',
                    headStyles: { fillColor: [56, 161, 105], textColor: 255, fontStyle: 'bold', fontSize: 10 },
                    bodyStyles: { fontSize: 10, textColor: [31, 41, 55] },
                    alternateRowStyles: { fillColor: [245, 247, 250] },
                    margin: { left: 14, right: 14 },
                    columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 30 }, 2: { cellWidth: 50 } },
                });
                y = doc.lastAutoTable.finalY + 12;
            } else {
                doc.setFontSize(10);
                doc.setTextColor(150);
                doc.text('Belum ada data', 14, y);
                y += 10;
            }

            // Recent Activities
            if (y > 200) { doc.addPage(); y = 15; }
            doc.setFontSize(13);
            doc.setTextColor(31, 41, 55);
            doc.text('Aktivitas Terakhir', 14, y);
            y += 6;

            if (recentActivities.length > 0) {
                autoTable(doc, {
                    startY: y,
                    head: [['Tipe', 'Subject', 'Lead', 'Tanggal', 'Status']],
                    body: recentActivities.map(a => [
                        a.activity_type || '-',
                        a.subject || '-',
                        a.lead_name || '-',
                        formatDate(a.activity_date),
                        a.status || '-'
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [79, 172, 254], textColor: 255, fontStyle: 'bold', fontSize: 9 },
                    bodyStyles: { fontSize: 9, textColor: [31, 41, 55] },
                    alternateRowStyles: { fillColor: [245, 247, 250] },
                    margin: { left: 14, right: 14 },
                    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 50 }, 2: { cellWidth: 40 }, 3: { cellWidth: 28 }, 4: { cellWidth: 25 } },
                });
            } else {
                doc.setFontSize(10);
                doc.setTextColor(150);
                doc.text('Belum ada aktivitas', 14, y);
            }

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(180);
                doc.text(`JAGATRAYA ERP - CRM Report | Hal ${i} / ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
            }

            doc.save(`CRM_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Export PDF Error:', error);
            alert('Gagal export PDF: ' + error.message);
        }
        setExporting(false);
    };

    if (loading) return <div className="loading"><div className="loading-spinner"></div><p>Memuat dashboard CRM...</p></div>;
    if (!dashboardData) return <div>Tidak bisa memuat data.</div>;

    const { summary, leadsByStatus, oppsByStage, quotsByStatus, recentActivities } = dashboardData;

    // Calculate max values for bar charts
    const maxOppCount = Math.max(...(oppsByStage.map(o => o.count) || [1]), 1);

    return (
        <div ref={printRef}>
            <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <h1 className="page-title">📈 CRM Dashboard & Report</h1>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-outline" onClick={fetchDashboard} disabled={exporting}>🔄 Refresh</button>
                    <button className="btn btn-outline" onClick={handlePrint} disabled={exporting} style={{ borderColor: '#6366f1', color: '#6366f1' }}>
                        🖨️ Cetak
                    </button>
                    <button
                        className="btn"
                        onClick={handleExportPDF}
                        disabled={exporting}
                        style={{ background: 'linear-gradient(135deg, #e53e3e, #c53030)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(229,62,62,0.3)' }}
                    >
                        📄 {exporting ? 'Proses...' : 'Export PDF'}
                    </button>
                    <button
                        className="btn"
                        onClick={handleExportExcel}
                        disabled={exporting}
                        style={{ background: 'linear-gradient(135deg, #38a169, #2f855a)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(56,161,105,0.3)' }}
                    >
                        📊 {exporting ? 'Proses...' : 'Export Excel'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '1.5rem', color: 'white', boxShadow: '0 4px 15px rgba(102,126,234,0.4)' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>🎯 Total Leads</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{summary.totalLeads}</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', borderRadius: '12px', padding: '1.5rem', color: 'white', boxShadow: '0 4px 15px rgba(245,87,108,0.4)' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>📊 Total Opportunities</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{summary.totalOpportunities}</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', borderRadius: '12px', padding: '1.5rem', color: 'white', boxShadow: '0 4px 15px rgba(79,172,254,0.4)' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>📋 Total Quotations</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{summary.totalQuotations}</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', borderRadius: '12px', padding: '1.5rem', color: 'white', boxShadow: '0 4px 15px rgba(67,233,123,0.4)' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>💰 Pipeline Value</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>Rp {formatCurrency(summary.pipelineValue)}</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #38a169 0%, #2f855a 100%)', borderRadius: '12px', padding: '1.5rem', color: 'white', boxShadow: '0 4px 15px rgba(56,161,105,0.4)' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>🏆 Won Value</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>Rp {formatCurrency(summary.wonValue)}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Lead Status */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1a202c' }}>Lead berdasarkan Status</h3>
                    {leadsByStatus.length === 0 ? (
                        <p style={{ color: '#6b7280', textAlign: 'center' }}>Belum ada data</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {leadsByStatus.map((item, idx) => (
                                <div key={idx}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColors[item.status] || '#6b7280', marginRight: '0.5rem' }}></span>
                                            {item.status}
                                        </span>
                                        <span style={{ fontWeight: 'bold' }}>{item.count}</span>
                                    </div>
                                    <div style={{ backgroundColor: '#e5e7eb', borderRadius: '4px', height: '8px' }}>
                                        <div style={{ width: `${(item.count / summary.totalLeads) * 100}%`, backgroundColor: statusColors[item.status] || '#6b7280', borderRadius: '4px', height: '100%', transition: 'width 0.5s' }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Opportunity Pipeline */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1a202c' }}>Opportunity Pipeline</h3>
                    {oppsByStage.length === 0 ? (
                        <p style={{ color: '#6b7280', textAlign: 'center' }}>Belum ada data</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {oppsByStage.map((item, idx) => (
                                <div key={idx}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: stageColors[item.stage] || '#6b7280', marginRight: '0.5rem' }}></span>
                                            {item.stage}
                                        </span>
                                        <span style={{ fontSize: '0.85rem' }}><strong>{item.count}</strong> · Rp {formatCurrency(item.total_value)}</span>
                                    </div>
                                    <div style={{ backgroundColor: '#e5e7eb', borderRadius: '4px', height: '8px' }}>
                                        <div style={{ width: `${(item.count / maxOppCount) * 100}%`, backgroundColor: stageColors[item.stage] || '#6b7280', borderRadius: '4px', height: '100%', transition: 'width 0.5s' }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Quotation Status */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1a202c' }}>Quotation berdasarkan Status</h3>
                    {quotsByStatus.length === 0 ? (
                        <p style={{ color: '#6b7280', textAlign: 'center' }}>Belum ada data</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {quotsByStatus.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{
                                            padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600',
                                            backgroundColor: `${quotStatusColors[item.status]}20`, color: quotStatusColors[item.status]
                                        }}>{item.status}</span>
                                        <span style={{ fontWeight: '600' }}>{item.count}</span>
                                    </div>
                                    <span style={{ fontSize: '0.9rem', color: '#374151' }}>Rp {formatCurrency(item.total_value)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Activities */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1a202c' }}>Aktivitas Terakhir</h3>
                    {recentActivities.length === 0 ? (
                        <p style={{ color: '#6b7280', textAlign: 'center' }}>Belum ada aktivitas</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {recentActivities.map((act, idx) => {
                                const typeIcons = { Call: '📞', Meeting: '🤝', Email: '📧', Visit: '🏢', Task: '✅' };
                                return (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.5rem', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                                        <span style={{ fontSize: '1.2rem' }}>{typeIcons[act.activity_type] || '📋'}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: '500', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.subject}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                {act.lead_name && `Lead: ${act.lead_name}`}
                                                {' · '}
                                                {act.activity_date ? new Date(act.activity_date).toLocaleDateString('id-ID') : ''}
                                            </div>
                                        </div>
                                        <span style={{
                                            padding: '0.15rem 0.4rem', borderRadius: '8px', fontSize: '0.7rem',
                                            backgroundColor: act.status === 'Completed' ? '#c6f6d520' : '#bee3f820',
                                            color: act.status === 'Completed' ? '#38a169' : '#3182ce'
                                        }}>{act.status}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CrmReport;
