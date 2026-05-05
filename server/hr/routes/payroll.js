import { Router } from 'express';
import { executeQuery, getSettings } from '../db.js';
import { authenticateToken } from '../middleware.js';

const router = Router();

// Calculate payroll for a period (preview)
router.post('/calculate', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.body;
    const employees = await executeQuery("SELECT * FROM HR_Employees WHERE active = 'Y'");
    const bpjs = await getSettings('BPJS_');
    const results = [];

    for (const emp of employees) {
      const baseSalary = parseFloat(emp.base_salary) || 0;
      const transport = parseFloat(emp.transport_allowance) || 0;
      const meal = parseFloat(emp.meal_allowance) || 0;
      const posAllow = parseFloat(emp.position_allowance) || 0;
      const otherAllow = parseFloat(emp.other_allowance) || 0;

      // Attendance summary
      const att = await executeQuery("SELECT COUNT(*) as total, SUM(CASE WHEN status='Present' OR status='Late' THEN 1 ELSE 0 END) as present, SUM(CASE WHEN status='Absent' THEN 1 ELSE 0 END) as absent FROM HR_Attendance WHERE employee_id=? AND MONTH(attendance_date)=? AND YEAR(attendance_date)=?", [emp.id, month, year]);
      
      // Leave days
      const leaveRes = await executeQuery("SELECT COALESCE(SUM(total_days),0) as total FROM HR_LeaveRequests WHERE employee_id=? AND status='Approved' AND MONTH(start_date)=? AND YEAR(start_date)=?", [emp.id, month, year]);
      
      // Overtime
      const otRes = await executeQuery("SELECT COALESCE(SUM(overtime_amount),0) as total FROM HR_OvertimeRequests WHERE employee_id=? AND status='Approved' AND MONTH(overtime_date)=? AND YEAR(overtime_date)=?", [emp.id, month, year]);
      const overtimeAmount = parseFloat(otRes[0].total) || 0;

      // BPJS Kesehatan
      const bpjsKesSalary = Math.min(baseSalary, parseFloat(bpjs.BPJS_KES_MAX_SALARY || 12000000));
      const bpjsKesEmp = Math.round(bpjsKesSalary * parseFloat(bpjs.BPJS_KES_EMPLOYEE || 1) / 100);
      const bpjsKesCom = Math.round(bpjsKesSalary * parseFloat(bpjs.BPJS_KES_COMPANY || 4) / 100);

      // BPJS JHT
      const bpjsJhtEmp = Math.round(baseSalary * parseFloat(bpjs.BPJS_JHT_EMPLOYEE || 2) / 100);
      const bpjsJhtCom = Math.round(baseSalary * parseFloat(bpjs.BPJS_JHT_COMPANY || 3.7) / 100);

      // BPJS JKK & JKM
      const bpjsJkkCom = Math.round(baseSalary * parseFloat(bpjs.BPJS_JKK_COMPANY || 0.24) / 100);
      const bpjsJkmCom = Math.round(baseSalary * parseFloat(bpjs.BPJS_JKM_COMPANY || 0.3) / 100);

      // BPJS JP
      const bpjsJpSalary = Math.min(baseSalary, parseFloat(bpjs.BPJS_JP_MAX_SALARY || 10042300));
      const bpjsJpEmp = Math.round(bpjsJpSalary * parseFloat(bpjs.BPJS_JP_EMPLOYEE || 1) / 100);
      const bpjsJpCom = Math.round(bpjsJpSalary * parseFloat(bpjs.BPJS_JP_COMPANY || 2) / 100);

      // Loan deduction
      const loanRes = await executeQuery("SELECT COALESCE(SUM(installment_amount),0) as total FROM HR_EmployeeLoans WHERE employee_id=? AND status='Active'", [emp.id]);
      const loanDeduction = parseFloat(loanRes[0].total) || 0;

      const totalEarnings = baseSalary + transport + meal + posAllow + otherAllow + overtimeAmount;
      const totalDeductions = bpjsKesEmp + bpjsJhtEmp + bpjsJpEmp + loanDeduction;
      const netSalary = totalEarnings - totalDeductions;

      results.push({
        employee_id: emp.id, employee_code: emp.employee_code, full_name: emp.full_name,
        working_days: 22, present_days: parseInt(att[0].present) || 0, absent_days: parseInt(att[0].absent) || 0, leave_days: parseInt(leaveRes[0].total) || 0,
        base_salary: baseSalary, transport_allowance: transport, meal_allowance: meal, position_allowance: posAllow, other_allowance: otherAllow,
        overtime_amount: overtimeAmount, total_earnings: totalEarnings,
        bpjs_kes_employee: bpjsKesEmp, bpjs_kes_company: bpjsKesCom,
        bpjs_jht_employee: bpjsJhtEmp, bpjs_jht_company: bpjsJhtCom,
        bpjs_jkk_company: bpjsJkkCom, bpjs_jkm_company: bpjsJkmCom,
        bpjs_jp_employee: bpjsJpEmp, bpjs_jp_company: bpjsJpCom,
        loan_deduction: loanDeduction, pph21: 0, total_deductions: totalDeductions, net_salary: netSalary
      });
    }
    res.json({ success: true, data: results });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Save payroll
router.post('/save', authenticateToken, async (req, res) => {
  try {
    const { month, year, data } = req.body;
    // Delete existing draft
    await executeQuery("DELETE FROM HR_Payroll WHERE period_month=? AND period_year=? AND status='Draft'", [month, year]);
    for (const d of data) {
      await executeQuery(`INSERT INTO HR_Payroll (period_month, period_year, employee_id, working_days, present_days, absent_days, leave_days,
        base_salary, transport_allowance, meal_allowance, position_allowance, other_allowance, overtime_amount, total_earnings,
        bpjs_kes_employee, bpjs_kes_company, bpjs_jht_employee, bpjs_jht_company, bpjs_jkk_company, bpjs_jkm_company,
        bpjs_jp_employee, bpjs_jp_company, loan_deduction, pph21, total_deductions, net_salary, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [month, year, d.employee_id, d.working_days, d.present_days, d.absent_days, d.leave_days,
         d.base_salary, d.transport_allowance, d.meal_allowance, d.position_allowance, d.other_allowance,
         d.overtime_amount, d.total_earnings, d.bpjs_kes_employee, d.bpjs_kes_company,
         d.bpjs_jht_employee, d.bpjs_jht_company, d.bpjs_jkk_company, d.bpjs_jkm_company,
         d.bpjs_jp_employee, d.bpjs_jp_company, d.loan_deduction, d.pph21, d.total_deductions, d.net_salary, 'Draft']);
    }
    res.json({ success: true, message: 'Payroll berhasil disimpan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Finalize payroll
router.put('/finalize', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.body;
    await executeQuery("UPDATE HR_Payroll SET status='Finalized' WHERE period_month=? AND period_year=? AND status='Draft'", [month, year]);
    // Process loan payments
    const payrolls = await executeQuery("SELECT * FROM HR_Payroll WHERE period_month=? AND period_year=? AND loan_deduction > 0", [month, year]);
    for (const p of payrolls) {
      const loans = await executeQuery("SELECT * FROM HR_EmployeeLoans WHERE employee_id=? AND status='Active'", [p.employee_id]);
      for (const loan of loans) {
        await executeQuery("INSERT INTO HR_LoanPayments (loan_id, payment_date, amount, payroll_id) VALUES (?, CURRENT DATE, ?, ?)",
          [loan.id, loan.installment_amount, p.id]);
        const newPaid = loan.paid_installments + 1;
        const newRemaining = parseFloat(loan.remaining_amount) - parseFloat(loan.installment_amount);
        const newStatus = newPaid >= loan.total_installments ? 'Paid Off' : 'Active';
        await executeQuery("UPDATE HR_EmployeeLoans SET paid_installments=?, remaining_amount=?, status=? WHERE id=?",
          [newPaid, Math.max(0, newRemaining), newStatus, loan.id]);
      }
    }
    res.json({ success: true, message: 'Payroll berhasil difinalisasi' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// List payroll
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { month, year, employee_id } = req.query;
    let where = '1=1'; let params = [];
    if (month && year) { where += ' AND p.period_month=? AND p.period_year=?'; params.push(month, year); }
    if (employee_id) { where += ' AND p.employee_id=?'; params.push(employee_id); }
    const result = await executeQuery(`SELECT p.*, e.employee_code, e.full_name FROM HR_Payroll p JOIN HR_Employees e ON p.employee_id = e.id WHERE ${where} ORDER BY p.period_year DESC, p.period_month DESC, e.full_name`, params);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Payroll slip detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery(`SELECT p.*, e.employee_code, e.full_name, e.bank_name, e.bank_account, e.bank_account_name, d.name as department_name, pos.name as position_name
      FROM HR_Payroll p JOIN HR_Employees e ON p.employee_id = e.id
      LEFT JOIN HR_Departments d ON e.department_id = d.id LEFT JOIN HR_Positions pos ON e.position_id = pos.id WHERE p.id = ?`, [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;
