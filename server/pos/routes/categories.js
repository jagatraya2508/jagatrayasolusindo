import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { is_food } = req.query;
    let sql = `SELECT * FROM POS_Categories WHERE active = 'Y' ORDER BY sort_order, name`;
    const params = [];

    if (is_food) {
      // Validasi is_food antara 'Y' atau 'N'
      sql = `SELECT DISTINCT c.* FROM POS_Categories c 
             JOIN POS_Products p ON p.category_id = c.id 
             WHERE c.active = 'Y' AND p.is_food = ? AND p.active = 'Y'
             ORDER BY c.sort_order, c.name`;
      params.push(is_food);
    }

    const categories = await executeQuery(sql, params);
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { code, name, description, color, sort_order } = req.body;
    await executeQuery(
      `INSERT INTO POS_Categories (code, name, description, color, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [code, name, description || null, color || '#3B82F6', sort_order || 0]
    );
    res.json({ success: true, message: 'Kategori berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { code, name, description, color, sort_order, active } = req.body;
    await executeQuery(
      `UPDATE POS_Categories SET code=?, name=?, description=?, color=?, sort_order=?, active=? WHERE id=?`,
      [code, name, description || null, color || '#3B82F6', sort_order || 0, active || 'Y', parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Kategori berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await executeQuery(`UPDATE POS_Categories SET active = 'N' WHERE id = ?`, [parseInt(req.params.id)]);
    res.json({ success: true, message: 'Kategori berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
