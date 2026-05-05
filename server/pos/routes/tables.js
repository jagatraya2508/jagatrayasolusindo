import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Get all tables
router.get('/', async (req, res) => {
  try {
    const { outlet_id, floor } = req.query;
    let sql = `SELECT t.*, o.name as outlet_name FROM POS_Tables t LEFT JOIN POS_Outlets o ON t.outlet_id = o.id WHERE t.active = 'Y'`;
    const params = [];
    if (outlet_id) { sql += ` AND t.outlet_id = ?`; params.push(parseInt(outlet_id)); }
    if (floor) { sql += ` AND t.floor = ?`; params.push(floor); }
    sql += ` ORDER BY t.table_number`;

    const tables = await executeQuery(sql, params);

    // Get active transactions for occupied tables
    for (const table of tables) {
      if (table.status === 'Occupied') {
        const tx = await executeQuery(
          `SELECT TOP 1 id, transaction_no, grand_total, guest_count FROM POS_Transactions WHERE table_id = ? AND status = 'Open' ORDER BY id DESC`, [table.id]
        );
        table.active_transaction = tx.length > 0 ? tx[0] : null;
      }
    }

    res.json({ success: true, data: tables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update table status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await executeQuery(`UPDATE POS_Tables SET status = ? WHERE id = ?`, [status, parseInt(req.params.id)]);
    res.json({ success: true, message: 'Status meja berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CRUD tables
router.post('/', async (req, res) => {
  try {
    const { table_number, table_name, capacity, outlet_id, floor, position_x, position_y } = req.body;
    await executeQuery(
      `INSERT INTO POS_Tables (table_number, table_name, capacity, outlet_id, floor, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [table_number, table_name || null, capacity || 4, outlet_id || 1, floor || 'Lantai 1', position_x || 0, position_y || 0]
    );
    res.json({ success: true, message: 'Meja berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update table layout bulk
router.put('/layout', async (req, res) => {
  try {
    const { layout } = req.body; // array of { id, position_x, position_y }
    if (layout && layout.length > 0) {
      for (const item of layout) {
        await executeQuery(
          `UPDATE POS_Tables SET position_x = ?, position_y = ? WHERE id = ?`,
          [item.position_x, item.position_y, item.id]
        );
      }
    }
    res.json({ success: true, message: 'Layout meja berhasil disimpan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


router.put('/:id', async (req, res) => {
  try {
    const { table_number, table_name, capacity, outlet_id, floor, position_x, position_y, active } = req.body;
    await executeQuery(
      `UPDATE POS_Tables SET table_number=?, table_name=?, capacity=?, outlet_id=?, floor=?, position_x=?, position_y=?, active=? WHERE id=?`,
      [table_number, table_name || null, capacity || 4, outlet_id || 1, floor || 'Lantai 1', position_x || 0, position_y || 0, active || 'Y', parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Meja berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await executeQuery(`UPDATE POS_Tables SET active = 'N' WHERE id = ?`, [parseInt(req.params.id)]);
    res.json({ success: true, message: 'Meja berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
