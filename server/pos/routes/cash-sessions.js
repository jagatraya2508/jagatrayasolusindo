import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Open cash session
router.post('/open', async (req, res) => {
  try {
    const { outlet_id, opening_balance } = req.body;
    const targetOutletId = parseInt(outlet_id) || 1;

    // Access check
    if (req.user.access_level === 'CUSTOM') {
      if (!req.user.outlet_ids || !req.user.outlet_ids.includes(targetOutletId)) {
        return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke Outlet ini' });
      }
    }

    // Check existing open session
    const existing = await executeQuery(
      `SELECT id FROM POS_CashSessions WHERE user_id = ? AND status = 'Open'`, [req.user.id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Anda masih memiliki sesi kasir yang terbuka', data: { session_id: existing[0].id } });
    }

    await executeQuery(
      `INSERT INTO POS_CashSessions (user_id, outlet_id, opening_balance, cash_in_drawer, total_sales, total_transactions, status) VALUES (?, ?, ?, ?, 0, 0, 'Open')`,
      [req.user.id, targetOutletId, opening_balance || 0, opening_balance || 0]
    );

    const created = await executeQuery(`SELECT MAX(id) as id FROM POS_CashSessions WHERE user_id = ? AND status = 'Open'`, [req.user.id]);
    res.json({ success: true, message: 'Sesi kasir dibuka', data: { session_id: created[0].id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Close cash session
router.post('/close', async (req, res) => {
  try {
    const { session_id, closing_balance, notes } = req.body;

    const session = await executeQuery(`SELECT * FROM POS_CashSessions WHERE id = ? AND user_id = ?`, [session_id, req.user.id]);
    if (session.length === 0) return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });

    const difference = (closing_balance || 0) - parseFloat(session[0].cash_in_drawer);

    await executeQuery(
      `UPDATE POS_CashSessions SET close_time = CURRENT TIMESTAMP, closing_balance = ?, difference = ?, notes = ?, status = 'Closed' WHERE id = ?`,
      [closing_balance || 0, difference, notes || null, session_id]
    );

    res.json({ success: true, message: 'Sesi kasir ditutup', data: { difference } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get current open session
router.get('/current', async (req, res) => {
  try {
    const sessions = await executeQuery(
      `SELECT s.*, o.name as outlet_name FROM POS_CashSessions s LEFT JOIN POS_Outlets o ON s.outlet_id = o.id WHERE s.user_id = ? AND s.status = 'Open'`,
      [req.user.id]
    );
    if (sessions.length === 0) return res.json({ success: true, data: null });
    res.json({ success: true, data: sessions[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get session history
router.get('/', async (req, res) => {
  try {
    let whereClause = "";
    let params = [];
    if (req.user && req.user.access_level === 'CUSTOM') {
      if (req.user.outlet_ids && req.user.outlet_ids.length > 0) {
        whereClause = `WHERE s.outlet_id IN (${req.user.outlet_ids.map(()=>'?').join(',')})`;
        params = [...req.user.outlet_ids];
      } else {
        whereClause = `WHERE 1 = 0`; // NO ACCESS
      }
    }

    const sessions = await executeQuery(
      `SELECT TOP 50 s.id, s.user_id, s.outlet_id, s.open_time, s.close_time, 
                      s.opening_balance, s.closing_balance, s.cash_in_drawer, s.difference, s.status, s.notes,
                      ISNULL((SELECT COUNT(*) FROM POS_Transactions t WHERE t.session_id = s.id AND t.status = 'Completed'), 0) as total_transactions,
                      ISNULL((SELECT SUM(grand_total) FROM POS_Transactions t WHERE t.session_id = s.id AND t.status = 'Completed'), 0) as total_sales,
                      u.full_name as cashier_name, o.name as outlet_name
       FROM POS_CashSessions s
       LEFT JOIN POS_Users u ON s.user_id = u.id
       LEFT JOIN POS_Outlets o ON s.outlet_id = o.id
       ${whereClause}
       ORDER BY s.open_time DESC`, params
    );
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Edit Session
router.put('/:id', async (req, res) => {
  try {
    const { opening_balance, closing_balance, status, close_time } = req.body;
    let updateFields = [];
    let params = [];

    if (opening_balance !== undefined) {
      updateFields.push('opening_balance = ?');
      params.push(opening_balance || 0);
    }
    if (closing_balance !== undefined) {
      updateFields.push('closing_balance = ?');
      params.push(closing_balance || 0);
    }
    if (status) {
      updateFields.push('status = ?');
      params.push(status);
      if (status === 'Open') {
        updateFields.push('close_time = NULL');
      } else if (close_time) {
        updateFields.push('close_time = ?');
        params.push(close_time);
      }
    }
    
    params.push(parseInt(req.params.id));

    // Recalculate difference if closing balance provided
    if (closing_balance !== undefined || status === 'Closed') {
       const sessionData = await executeQuery(`SELECT cash_in_drawer, closing_balance FROM POS_CashSessions WHERE id = ?`, [parseInt(req.params.id)]);
       if (sessionData.length > 0) {
         const cb = closing_balance !== undefined ? closing_balance : sessionData[0].closing_balance;
         const diff = (cb || 0) - parseFloat(sessionData[0].cash_in_drawer || 0);
         updateFields.push('difference = ?');
         params.splice(params.length - 1, 0, diff); // insert diff before ID
       }
    }

    if (updateFields.length > 0) {
      await executeQuery(`UPDATE POS_CashSessions SET ${updateFields.join(', ')} WHERE id = ?`, params);
    }
    
    res.json({ success: true, message: 'Sesi kasir berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Session
router.delete('/:id', async (req, res) => {
  try {
    // Make sure we update transactions to remove session_id so they aren't orphaned completely, or let it fail if foreign key prevents it.
    try {
      await executeQuery(`UPDATE POS_Transactions SET session_id = NULL WHERE session_id = ?`, [parseInt(req.params.id)]);
    } catch(e) {} // ignore if column doesn't exist or other error
    
    await executeQuery(`DELETE FROM POS_CashSessions WHERE id = ?`, [parseInt(req.params.id)]);
    res.json({ success: true, message: 'Sesi kasir berhasil dihapus' });
  } catch (error) {
    if (error.message.includes('foreign key') || error.message.includes('constraint')) {
      return res.status(400).json({ success: false, message: 'Gagal menghapus: Sesi ini sudah memiliki transaksi yang terikat.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
