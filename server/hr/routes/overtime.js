import { Router } from 'express';
import { executeQuery } from '../db.js';
import { authenticateToken } from '../middleware.js';

const router = Router();

// List overtime requests
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { employee_id, status, month, year } = req.query;
    let where = '1=1'; let params = [];
    if (employee_id) { where += ' AND o.employee_id = ?'; params.push(employee_id); }
    if (status) { where += ' AND o.status = ?'; params.push(status); }
    if (month && year) { where += ' AND MONTH(o.overtime_date) = ? AND YEAR(o.overtime_date) = ?'; params.push(month, year); }
    const result = await executeQuery(`SELECT o.*, e.employee_code, e.full_name, e.base_salary, u.full_name as approved_by_name
      FROM HR_OvertimeRequests o JOIN HR_Employees e ON o.employee_id = e.id
      LEFT JOIN HR_Users u ON o.approved_by = u.id
      WHERE ${where} ORDER BY o.created_at DESC`, params);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Create overtime request
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { employee_id, overtime_date, start_time, end_time, total_hours, reason } = req.body;
    const empId = employee_id || req.user.employee_id;
    await executeQuery(`INSERT INTO HR_OvertimeRequests (employee_id, overtime_date, start_time, end_time, total_hours, reason)
      VALUES (?, ?, ?, ?, ?, ?)`, [empId, overtime_date, start_time, end_time, total_hours, reason]);
    res.json({ success: true, message: 'Pengajuan lembur berhasil dikirim' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Approve overtime
router.put('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const ot = await executeQuery("SELECT o.*, e.base_salary FROM HR_OvertimeRequests o JOIN HR_Employees e ON o.employee_id = e.id WHERE o.id = ?", [req.params.id]);
    if (ot.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    // Calculate overtime amount: 1/173 * base_salary * rate * hours
    const hourlyRate = parseFloat(ot[0].base_salary) / 173;
    const hours = parseFloat(ot[0].total_hours);
    // Simplified: first hour 1.5x, subsequent 2x
    let amount = 0;
    if (hours <= 1) { amount = hourlyRate * 1.5 * hours; }
    else { amount = (hourlyRate * 1.5) + (hourlyRate * 2 * (hours - 1)); }

    await executeQuery("UPDATE HR_OvertimeRequests SET status='Approved', approved_by=?, approved_date=CURRENT TIMESTAMP, overtime_rate=?, overtime_amount=? WHERE id=?",
      [req.user.id, hourlyRate, Math.round(amount), req.params.id]);
    res.json({ success: true, message: 'Lembur berhasil disetujui' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Reject overtime
router.put('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { reject_reason } = req.body;
    await executeQuery("UPDATE HR_OvertimeRequests SET status='Rejected', approved_by=?, approved_date=CURRENT TIMESTAMP, reject_reason=? WHERE id=?",
      [req.user.id, reject_reason, req.params.id]);
    res.json({ success: true, message: 'Lembur berhasil ditolak' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;
