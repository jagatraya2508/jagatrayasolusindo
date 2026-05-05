import { Router } from 'express';
import { executeQuery } from '../db.js';
import { authenticateToken } from '../middleware.js';

const router = Router();

// List loans
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { employee_id, status } = req.query;
    let where = '1=1'; let params = [];
    if (employee_id) { where += ' AND l.employee_id = ?'; params.push(employee_id); }
    if (status) { where += ' AND l.status = ?'; params.push(status); }
    const result = await executeQuery(`SELECT l.*, e.employee_code, e.full_name, u.full_name as approved_by_name
      FROM HR_EmployeeLoans l JOIN HR_Employees e ON l.employee_id = e.id
      LEFT JOIN HR_Users u ON l.approved_by = u.id WHERE ${where} ORDER BY l.created_at DESC`, params);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Create loan request
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { employee_id, loan_date, loan_amount, installment_amount, total_installments, reason } = req.body;
    const empId = employee_id || req.user.employee_id;
    await executeQuery(`INSERT INTO HR_EmployeeLoans (employee_id, loan_date, loan_amount, installment_amount, total_installments, remaining_amount, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [empId, loan_date, loan_amount, installment_amount, total_installments, loan_amount, reason]);
    res.json({ success: true, message: 'Pengajuan pinjaman berhasil' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Approve loan
router.put('/:id/approve', authenticateToken, async (req, res) => {
  try {
    await executeQuery("UPDATE HR_EmployeeLoans SET status='Active', approved_by=?, approved_date=CURRENT TIMESTAMP WHERE id=?", [req.user.id, req.params.id]);
    res.json({ success: true, message: 'Pinjaman berhasil disetujui' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Reject loan
router.put('/:id/reject', authenticateToken, async (req, res) => {
  try {
    await executeQuery("UPDATE HR_EmployeeLoans SET status='Rejected', approved_by=?, approved_date=CURRENT TIMESTAMP WHERE id=?", [req.user.id, req.params.id]);
    res.json({ success: true, message: 'Pinjaman berhasil ditolak' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Loan payments
router.get('/:id/payments', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery("SELECT * FROM HR_LoanPayments WHERE loan_id = ? ORDER BY payment_date", [req.params.id]);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Loan detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery(`SELECT l.*, e.employee_code, e.full_name FROM HR_EmployeeLoans l JOIN HR_Employees e ON l.employee_id = e.id WHERE l.id = ?`, [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;
