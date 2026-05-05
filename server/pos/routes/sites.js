import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Get all active sites with entity info
router.get('/', async (req, res) => {
  try {
    const data = await executeQuery(`
      SELECT s.*, e.name as entity_name 
      FROM POS_Sites s 
      LEFT JOIN POS_Entities e ON s.entity_id = e.id 
      WHERE s.active = 'Y' 
      ORDER BY e.name, s.name
    `);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create site
router.post('/', async (req, res) => {
  try {
    const { entity_id, code, name, address, city, master_site_id } = req.body;
    if (!entity_id) return res.status(400).json({ success: false, message: 'Harap pilih Entity/Brand' });

    await executeQuery(
      `INSERT INTO POS_Sites (entity_id, code, name, address, city, master_site_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [parseInt(entity_id), code, name, address || null, city || null, master_site_id || null]
    );
    res.json({ success: true, message: 'Alokasi Cabang berhasil ditambahkan' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'Alokasi ini sudah ada' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update site
router.put('/:id', async (req, res) => {
  try {
    const { entity_id, code, name, address, city, active, master_site_id } = req.body;
    await executeQuery(
      `UPDATE POS_Sites SET entity_id=?, code=?, name=?, address=?, city=?, active=?, master_site_id=? WHERE id=?`,
      [parseInt(entity_id), code, name, address || null, city || null, active || 'Y', master_site_id || null, parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Alokasi Cabang berhasil diupdate' });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'Alokasi ini sudah ada' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete site (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await executeQuery(`UPDATE POS_Sites SET active = 'N' WHERE id = ?`, [parseInt(req.params.id)]);
    res.json({ success: true, message: 'Site berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
