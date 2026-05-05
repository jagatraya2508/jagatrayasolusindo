import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Process payment
router.post('/', async (req, res) => {
  try {
    const { transaction_id, payment_method, amount, reference_no } = req.body;

    // Get transaction
    const tx = await executeQuery(`SELECT * FROM POS_Transactions WHERE id = ?`, [transaction_id]);
    if (tx.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

    const grandTotal = parseFloat(tx[0].grand_total);
    const changeAmount = Math.max(0, parseFloat(amount) - grandTotal);

    await executeQuery(
      `INSERT INTO POS_Payments (transaction_id, payment_method, amount, change_amount, reference_no) VALUES (?, ?, ?, ?, ?)`,
      [transaction_id, payment_method || 'Cash', amount, changeAmount, reference_no || null]
    );

    // Update transaction status
    await executeQuery(
      `UPDATE POS_Transactions SET payment_status = 'Paid', status = 'Completed' WHERE id = ?`, [transaction_id]
    );

    // Free table if restaurant
    if (tx[0].table_id) {
      await executeQuery(`UPDATE POS_Tables SET status = 'Available' WHERE id = ?`, [tx[0].table_id]);
    }

    // Update cash session totals
    if (tx[0].session_id) {
      await executeQuery(
        `UPDATE POS_CashSessions SET total_sales = ISNULL(total_sales, 0) + ?, total_transactions = ISNULL(total_transactions, 0) + 1 WHERE id = ?`,
        [grandTotal, tx[0].session_id]
      );
      if (payment_method === 'Cash') {
        await executeQuery(
          `UPDATE POS_CashSessions SET cash_in_drawer = ISNULL(cash_in_drawer, 0) + ? WHERE id = ?`,
          [grandTotal, tx[0].session_id]
        );
      }
    }

    // Reduce stock
    const details = await executeQuery(`SELECT product_id, quantity FROM POS_TransactionDetails WHERE transaction_id = ?`, [transaction_id]);
    for (const d of details) {
      await executeQuery(`UPDATE POS_Products SET stock = stock - ? WHERE id = ?`, [d.quantity, d.product_id]);
    }

    res.json({ success: true, message: 'Pembayaran berhasil', data: { change_amount: changeAmount } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get payments for a transaction
router.get('/transaction/:id', async (req, res) => {
  try {
    const payments = await executeQuery(
      `SELECT * FROM POS_Payments WHERE transaction_id = ? ORDER BY payment_date`, [parseInt(req.params.id)]
    );
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
