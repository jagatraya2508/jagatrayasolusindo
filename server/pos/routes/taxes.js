import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Get all taxes
router.get('/', async (req, res) => {
  try {
    const { active, apply_to } = req.query;
    let sql = `SELECT * FROM POS_Taxes WHERE 1=1`;
    const params = [];
    if (active) { sql += ` AND active = ?`; params.push(active); }
    if (apply_to) { sql += ` AND (apply_to = ? OR apply_to = 'ALL')`; params.push(apply_to); }
    sql += ` ORDER BY sort_order, name`;
    const taxes = await executeQuery(sql, params);
    res.json({ success: true, data: taxes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single tax
router.get('/:id', async (req, res) => {
  try {
    const taxes = await executeQuery(`SELECT * FROM POS_Taxes WHERE id = ?`, [parseInt(req.params.id)]);
    if (taxes.length === 0) return res.status(404).json({ success: false, message: 'Tax tidak ditemukan' });
    res.json({ success: true, data: taxes[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create tax
router.post('/', async (req, res) => {
  try {
    const { name, code, rate, apply_to, description, sort_order } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: 'Nama dan kode wajib diisi' });
    
    await executeQuery(
      `INSERT INTO POS_Taxes (name, code, rate, apply_to, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, code.toUpperCase(), parseFloat(rate) || 0, apply_to || 'ALL', description || null, parseInt(sort_order) || 0]
    );
    res.json({ success: true, message: 'Tax berhasil ditambahkan' });
  } catch (error) {
    if (error.message.includes('unique') || error.message.includes('Unique') || error.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'Kode tax sudah ada' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update tax
router.put('/:id', async (req, res) => {
  try {
    const { name, code, rate, apply_to, description, sort_order, active } = req.body;
    await executeQuery(
      `UPDATE POS_Taxes SET name=?, code=?, rate=?, apply_to=?, description=?, sort_order=?, active=? WHERE id=?`,
      [name, code.toUpperCase(), parseFloat(rate) || 0, apply_to || 'ALL', description || null, parseInt(sort_order) || 0, active || 'Y', parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Tax berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete (soft) tax
router.delete('/:id', async (req, res) => {
  try {
    await executeQuery(`UPDATE POS_Taxes SET active = 'N' WHERE id = ?`, [parseInt(req.params.id)]);
    res.json({ success: true, message: 'Tax berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
