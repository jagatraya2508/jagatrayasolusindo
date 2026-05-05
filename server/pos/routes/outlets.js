import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT o.*, s.name as site_name, e.name as entity_name 
      FROM POS_Outlets o
      LEFT JOIN POS_Sites s ON o.site_id = s.id
      LEFT JOIN POS_Entities e ON s.entity_id = e.id
      WHERE o.active = 'Y'
    `;
    let params = [];

    if (req.user && req.user.access_level === 'CUSTOM') {
      const outlet_ids = req.user.outlet_ids || [];
      if (outlet_ids.length > 0) {
        query += ` AND o.id IN (${outlet_ids.map(() => '?').join(',')})`;
        params.push(...outlet_ids);
      } else {
        query += ` AND 1 = 0`; // No access
      }
    }

    query += ` ORDER BY e.name, s.name, o.name`;
    const outlets = await executeQuery(query, params);
    
    res.json({ success: true, data: outlets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { code, name, address, phone, outlet_type, tax_rate, site_id } = req.body;
    await executeQuery(
      `INSERT INTO POS_Outlets (code, name, address, phone, outlet_type, tax_rate, site_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [code, name, address || null, phone || null, outlet_type || 'RETAIL', tax_rate || 0, site_id ? parseInt(site_id) : null]
    );
    res.json({ success: true, message: 'Outlet berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { code, name, address, phone, outlet_type, tax_rate, active, site_id } = req.body;
    await executeQuery(
      `UPDATE POS_Outlets SET code=?, name=?, address=?, phone=?, outlet_type=?, tax_rate=?, active=?, site_id=? WHERE id=?`,
      [code, name, address || null, phone || null, outlet_type || 'RETAIL', tax_rate || 0, active || 'Y', site_id ? parseInt(site_id) : null, parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Outlet berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await executeQuery(`UPDATE POS_Outlets SET active = 'N' WHERE id = ?`, [parseInt(req.params.id)]);
    res.json({ success: true, message: 'Outlet berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
