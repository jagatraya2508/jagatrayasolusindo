import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Get all promos
router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    let sql = `SELECT * FROM POS_Promos WHERE 1=1`;
    const params = [];
    if (active) { sql += ` AND active = ?`; params.push(active); }
    sql += ` ORDER BY name`;
    const promos = await executeQuery(sql, params);
    res.json({ success: true, data: promos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create promo
router.post('/', async (req, res) => {
  try {
    const { name, promo_type, discount_value, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nama promo wajib diisi' });
    await executeQuery(
      `INSERT INTO POS_Promos (name, promo_type, discount_value, description) VALUES (?, ?, ?, ?)`,
      [name, promo_type || 'PERCENT', discount_value || 0, description || null]
    );
    res.json({ success: true, message: 'Promo berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update promo
router.put('/:id', async (req, res) => {
  try {
    const { name, promo_type, discount_value, description, active } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nama promo wajib diisi' });
    await executeQuery(
      `UPDATE POS_Promos SET name=?, promo_type=?, discount_value=?, description=?, active=? WHERE id=?`,
      [name, promo_type || 'PERCENT', discount_value || 0, description || null, active || 'Y', parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Promo berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete promo (soft)
router.delete('/:id', async (req, res) => {
  try {
    await executeQuery(`UPDATE POS_Promos SET active = 'N' WHERE id = ?`, [parseInt(req.params.id)]);
    res.json({ success: true, message: 'Promo berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
