import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Daily sales report
router.get('/daily-sales', async (req, res) => {
  try {
    const { date, outlet_id } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const isCustom = req.user && req.user.access_level === 'CUSTOM';
    const hasAccess = isCustom && req.user.outlet_ids && req.user.outlet_ids.length > 0;
    const authOutletIds = hasAccess ? req.user.outlet_ids : [];
    const inMarkers = authOutletIds.map(() => '?').join(',');

    let sql = `SELECT
      COUNT(*) as total_transactions,
      COALESCE(SUM(CASE WHEN status = 'Completed' THEN grand_total ELSE 0 END), 0) as total_sales,
      COALESCE(SUM(CASE WHEN status = 'Void' THEN 1 ELSE 0 END), 0) as void_count,
      COALESCE(SUM(discount_amount), 0) as total_discount,
      COALESCE(SUM(tax_amount), 0) as total_tax,
      COALESCE(SUM(service_charge), 0) as total_service_charge
    FROM POS_Transactions WHERE CAST(transaction_date AS DATE) = ?`;
    const params = [targetDate];
    if (outlet_id) { sql += ` AND outlet_id = ?`; params.push(parseInt(outlet_id)); }
    if (isCustom) {
      if (hasAccess) { sql += ` AND outlet_id IN (${inMarkers})`; params.push(...authOutletIds); }
      else { sql += ` AND 1 = 0`; }
    }

    const summary = await executeQuery(sql, params);

    // Sales by payment method
    let pmSql = `SELECT p.payment_method, COUNT(*) as count, SUM(p.amount) as total
      FROM POS_Payments p
      JOIN POS_Transactions t ON p.transaction_id = t.id
      WHERE CAST(t.transaction_date AS DATE) = ? AND t.status = 'Completed'`;
    const pmParams = [targetDate];
    if (outlet_id) { pmSql += ` AND t.outlet_id = ?`; pmParams.push(parseInt(outlet_id)); }
    if (isCustom) {
      if (hasAccess) { pmSql += ` AND t.outlet_id IN (${inMarkers})`; pmParams.push(...authOutletIds); }
      else { pmSql += ` AND 1 = 0`; }
    }
    pmSql += ` GROUP BY p.payment_method`;
    const byPayment = await executeQuery(pmSql, pmParams);

    // Top products
    let tpSql = `SELECT TOP 10 d.product_name, SUM(d.quantity) as qty, SUM(d.subtotal) as total
      FROM POS_TransactionDetails d
      JOIN POS_Transactions t ON d.transaction_id = t.id
      WHERE CAST(t.transaction_date AS DATE) = ? AND t.status = 'Completed'`;
    const tpParams = [targetDate];
    if (outlet_id) { tpSql += ` AND t.outlet_id = ?`; tpParams.push(parseInt(outlet_id)); }
    if (isCustom) {
      if (hasAccess) { tpSql += ` AND t.outlet_id IN (${inMarkers})`; tpParams.push(...authOutletIds); }
      else { tpSql += ` AND 1 = 0`; }
    }
    tpSql += ` GROUP BY d.product_name ORDER BY qty DESC`;
    const topProducts = await executeQuery(tpSql, tpParams);

    // Hourly sales
    let hSql = `SELECT HOUR(transaction_date) as hour, COUNT(*) as count, SUM(grand_total) as total
      FROM POS_Transactions WHERE CAST(transaction_date AS DATE) = ? AND status = 'Completed'`;
    const hParams = [targetDate];
    if (outlet_id) { hSql += ` AND outlet_id = ?`; hParams.push(parseInt(outlet_id)); }
    if (isCustom) {
      if (hasAccess) { hSql += ` AND outlet_id IN (${inMarkers})`; hParams.push(...authOutletIds); }
      else { hSql += ` AND 1 = 0`; }
    }
    hSql += ` GROUP BY HOUR(transaction_date) ORDER BY hour`;
    const hourly = await executeQuery(hSql, hParams);

    res.json({ success: true, data: { summary: summary[0], byPayment, topProducts, hourly } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cashier session summary
router.get('/cashier-summary', async (req, res) => {
  try {
    const { date, user_id } = req.query;
    const isCustom = req.user && req.user.access_level === 'CUSTOM';
    const hasAccess = isCustom && req.user.outlet_ids && req.user.outlet_ids.length > 0;
    const authOutletIds = hasAccess ? req.user.outlet_ids : [];
    const inMarkers = authOutletIds.map(() => '?').join(',');

    let sql = `SELECT s.id, s.user_id, s.outlet_id, s.open_time, s.close_time, 
                      s.opening_balance, s.closing_balance, s.cash_in_drawer, s.difference, s.status, s.notes,
                      ISNULL((SELECT COUNT(*) FROM POS_Transactions t WHERE t.session_id = s.id AND t.status = 'Completed'), 0) as total_transactions,
                      ISNULL((SELECT SUM(grand_total) FROM POS_Transactions t WHERE t.session_id = s.id AND t.status = 'Completed'), 0) as total_sales,
                      u.full_name as cashier_name, o.name as outlet_name
      FROM POS_CashSessions s
      LEFT JOIN POS_Users u ON s.user_id = u.id
      LEFT JOIN POS_Outlets o ON s.outlet_id = o.id
      WHERE 1=1`;
    const params = [];
    if (date) { 
      sql += ` AND (CAST(s.open_time AS DATE) = ? OR CAST(s.close_time AS DATE) = ?)`; 
      params.push(date, date); 
    }
    if (user_id) { sql += ` AND s.user_id = ?`; params.push(parseInt(user_id)); }
    if (isCustom) {
      if (hasAccess) { sql += ` AND s.outlet_id IN (${inMarkers})`; params.push(...authOutletIds); }
      else { sql += ` AND 1 = 0`; }
    }
    sql += ` ORDER BY s.open_time DESC`;

    const sessions = await executeQuery(sql, params);
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
