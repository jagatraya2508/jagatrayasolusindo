import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Get all active entities
router.get('/', async (req, res) => {
  try {
    const data = await executeQuery(`SELECT * FROM POS_Entities WHERE active = 'Y' ORDER BY name`);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create entity
router.post('/', async (req, res) => {
  try {
    const { code, name, description } = req.body;
    await executeQuery(
      `INSERT INTO POS_Entities (code, name, description) VALUES (?, ?, ?)`,
      [code, name, description || null]
    );
    res.json({ success: true, message: 'Entity/Brand berhasil ditambahkan' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'Kode Entity sudah dipakai' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update entity
router.put('/:id', async (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    await executeQuery(
      `UPDATE POS_Entities SET code=?, name=?, description=?, active=? WHERE id=?`,
      [code, name, description || null, active || 'Y', parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Entity/Brand berhasil diupdate' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'Kode Entity sudah dipakai' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete entity (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await executeQuery(`UPDATE POS_Entities SET active = 'N' WHERE id = ?`, [parseInt(req.params.id)]);
    res.json({ success: true, message: 'Entity/Brand berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
