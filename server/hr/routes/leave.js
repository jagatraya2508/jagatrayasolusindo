import { Router } from 'express';
import { executeQuery } from '../db.js';
import { authenticateToken } from '../middleware.js';

const router = Router();

// ==================== LEAVE TYPES ====================
router.get('/types', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery("SELECT * FROM HR_LeaveTypes ORDER BY code");
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/types', authenticateToken, async (req, res) => {
  try {
    const { code, name, default_balance, is_paid, requires_approval } = req.body;
    await executeQuery("INSERT INTO HR_LeaveTypes (code, name, default_balance, is_paid, requires_approval) VALUES (?, ?, ?, ?, ?)",
      [code, name, default_balance || 0, is_paid || 'Y', requires_approval || 'Y']);
    res.json({ success: true, message: 'Jenis cuti berhasil ditambahkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/types/:id', authenticateToken, async (req, res) => {
  try {
    const { code, name, default_balance, is_paid, requires_approval, active } = req.body;
    await executeQuery("UPDATE HR_LeaveTypes SET code=?, name=?, default_balance=?, is_paid=?, requires_approval=?, active=? WHERE id=?",
      [code, name, default_balance, is_paid, requires_approval, active||'Y', req.params.id]);
    res.json({ success: true, message: 'Jenis cuti berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== LEAVE BALANCES ====================
router.get('/balances/:employeeId', authenticateToken, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const result = await executeQuery(`SELECT lb.*, lt.code, lt.name as leave_type_name
      FROM HR_LeaveBalances lb JOIN HR_LeaveTypes lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = ? AND lb.year = ?`, [req.params.employeeId, year]);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/balances/init', authenticateToken, async (req, res) => {
  try {
    const { employee_id, year } = req.body;
    const y = year || new Date().getFullYear();
    const types = await executeQuery("SELECT * FROM HR_LeaveTypes WHERE active = 'Y'");
    for (const t of types) {
      const exists = await executeQuery("SELECT id FROM HR_LeaveBalances WHERE employee_id=? AND leave_type_id=? AND year=?", [employee_id, t.id, y]);
      if (exists.length === 0) {
        await executeQuery("INSERT INTO HR_LeaveBalances (employee_id, leave_type_id, year, balance, used, remaining) VALUES (?, ?, ?, ?, 0, ?)",
          [employee_id, t.id, y, t.default_balance, t.default_balance]);
      }
    }
    res.json({ success: true, message: 'Saldo cuti berhasil diinisialisasi' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== LEAVE REQUESTS ====================
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const { employee_id, status } = req.query;
    let where = '1=1'; let params = [];
    if (employee_id) { where += ' AND lr.employee_id = ?'; params.push(employee_id); }
    if (status) { where += ' AND lr.status = ?'; params.push(status); }
    const result = await executeQuery(`SELECT lr.*, e.employee_code, e.full_name, lt.name as leave_type_name, u.full_name as approved_by_name
      FROM HR_LeaveRequests lr JOIN HR_Employees e ON lr.employee_id = e.id
      JOIN HR_LeaveTypes lt ON lr.leave_type_id = lt.id
      LEFT JOIN HR_Users u ON lr.approved_by = u.id
      WHERE ${where} ORDER BY lr.created_at DESC`, params);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/requests', authenticateToken, async (req, res) => {
  try {
    const { employee_id, leave_type_id, start_date, end_date, total_days, reason } = req.body;
    const empId = employee_id || req.user.employee_id;
    // Check balance
    const year = new Date(start_date).getFullYear();
    const balance = await executeQuery("SELECT * FROM HR_LeaveBalances WHERE employee_id=? AND leave_type_id=? AND year=?", [empId, leave_type_id, year]);
    if (balance.length > 0 && balance[0].remaining < total_days) {
      return res.status(400).json({ success: false, error: `Saldo cuti tidak mencukupi. Sisa: ${balance[0].remaining} hari` });
    }
    await executeQuery(`INSERT INTO HR_LeaveRequests (employee_id, leave_type_id, start_date, end_date, total_days, reason) VALUES (?, ?, ?, ?, ?, ?)`,
      [empId, leave_type_id, start_date, end_date, total_days, reason]);
    res.json({ success: true, message: 'Pengajuan cuti berhasil dikirim' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/requests/:id/approve', authenticateToken, async (req, res) => {
  try {
    const request = await executeQuery("SELECT * FROM HR_LeaveRequests WHERE id = ?", [req.params.id]);
    if (request.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    const r = request[0];
    await executeQuery("UPDATE HR_LeaveRequests SET status='Approved', approved_by=?, approved_date=CURRENT TIMESTAMP WHERE id=?", [req.user.id, req.params.id]);
    // Update balance
    const year = new Date(r.start_date).getFullYear();
    await executeQuery("UPDATE HR_LeaveBalances SET used = used + ?, remaining = remaining - ? WHERE employee_id=? AND leave_type_id=? AND year=?",
      [r.total_days, r.total_days, r.employee_id, r.leave_type_id, year]);
    res.json({ success: true, message: 'Cuti berhasil disetujui' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/requests/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { reject_reason } = req.body;
    await executeQuery("UPDATE HR_LeaveRequests SET status='Rejected', approved_by=?, approved_date=CURRENT TIMESTAMP, reject_reason=? WHERE id=?",
      [req.user.id, reject_reason, req.params.id]);
    res.json({ success: true, message: 'Cuti berhasil ditolak' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;
