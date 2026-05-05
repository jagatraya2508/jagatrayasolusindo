import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/erp', async (req, res) => {
  try {
    const sites = await executeQuery(`
      SELECT s.id, s.code, s.name, e.name as entity_name 
      FROM Sites s 
      LEFT JOIN Entities e ON s.entity_id = e.id 
      WHERE s.active = 'Y' 
      ORDER BY e.name, s.name
    `);
    res.json({ success: true, data: sites });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const sites = await executeQuery(`
      SELECT m.*, s.name as erp_site_name, s.code as erp_site_code 
      FROM POS_MasterSites m
      LEFT JOIN Sites s ON m.erp_site_id = s.id
      WHERE m.active = 'Y' 
      ORDER BY m.name
    `);
    res.json({ success: true, data: sites });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { code, name, address, city, erp_site_id } = req.body;
    await executeQuery(
      `INSERT INTO POS_MasterSites (code, name, address, city, erp_site_id) VALUES (?, ?, ?, ?, ?)`,
      [code, name, address || null, city || null, erp_site_id || null]
    );
    res.json({ success: true, message: 'Master Wilayah berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { code, name, address, city, active, erp_site_id } = req.body;
    await executeQuery(
      `UPDATE POS_MasterSites SET code=?, name=?, address=?, city=?, active=?, erp_site_id=? WHERE id=?`,
      [code, name, address || null, city || null, active || 'Y', erp_site_id || null, parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Master Wilayah berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await executeQuery(`UPDATE POS_MasterSites SET active = 'N' WHERE id = ?`, [parseInt(req.params.id)]);
    res.json({ success: true, message: 'Master Wilayah berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
