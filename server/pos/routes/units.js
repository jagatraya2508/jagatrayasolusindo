import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// ==============================
// UNITS
// ==============================

// Get all active units
router.get('/', async (req, res) => {
  try {
    const units = await executeQuery(`SELECT * FROM POS_Units WHERE active = 'Y' ORDER BY name`);
    res.json({ success: true, data: units });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new unit
router.post('/', async (req, res) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, message: 'Kode dan Nama satuan wajib diisi' });
    }

    // Check if code already exists
    const existing = await executeQuery(`SELECT id FROM POS_Units WHERE code = ?`, [code]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Kode satuan sudah terdaftar' });
    }

    await executeQuery(
      `INSERT INTO POS_Units (code, name, description) VALUES (?, ?, ?)`,
      [code, name, description || null]
    );
    res.json({ success: true, message: 'Satuan berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update unit
router.put('/:id', async (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    
    // Check if new code conflicts with another unit
    const existing = await executeQuery(`SELECT id FROM POS_Units WHERE code = ? AND id != ?`, [code, parseInt(req.params.id)]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Kode satuan sudah terdaftar di satuan lain' });
    }

    await executeQuery(
      `UPDATE POS_Units SET code=?, name=?, description=?, active=? WHERE id=?`,
      [code, name, description || null, active || 'Y', parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Satuan berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete unit (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    // Check if unit is actively used in products
    const inUse = await executeQuery(`SELECT id FROM POS_Products WHERE unit = (SELECT code FROM POS_Units WHERE id = ?) AND active = 'Y'`, [parseInt(req.params.id)]);
    if (inUse.length > 0) {
      return res.status(400).json({ success: false, message: 'Satuan tidak bisa dihapus karena sedang digunakan oleh produk aktif' });
    }

    await executeQuery(`UPDATE POS_Units SET active = 'N' WHERE id = ?`, [parseInt(req.params.id)]);
    // Also disable any conversions involving this unit
    await executeQuery(`UPDATE POS_UnitConversions SET active = 'N' WHERE from_unit_id = ? OR to_unit_id = ?`, [parseInt(req.params.id), parseInt(req.params.id)]);
    
    res.json({ success: true, message: 'Satuan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================
// CONVERSIONS
// ==============================

// Get all active conversions
router.get('/conversions/list', async (req, res) => {
  try {
    const queries = `
      SELECT 
        c.id, 
        c.from_unit_id, f.code as from_code, f.name as from_name,
        c.to_unit_id, t.code as to_code, t.name as to_name,
        c.multiplier,
        c.active
      FROM POS_UnitConversions c
      JOIN POS_Units f ON c.from_unit_id = f.id
      JOIN POS_Units t ON c.to_unit_id = t.id
      WHERE c.active = 'Y'
      ORDER BY f.name, t.name
    `;
    const conversions = await executeQuery(queries);
    res.json({ success: true, data: conversions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create conversion
router.post('/conversions', async (req, res) => {
  try {
    const { from_unit_id, to_unit_id, multiplier } = req.body;
    
    if (!from_unit_id || !to_unit_id || !multiplier) {
      return res.status(400).json({ success: false, message: 'Data konversi tidak lengkap' });
    }

    if (from_unit_id === to_unit_id) {
      return res.status(400).json({ success: false, message: 'Satuan asal dan tujuan tidak boleh sama' });
    }

    // Check if conversion already exists
    const existing = await executeQuery(
      `SELECT id FROM POS_UnitConversions WHERE from_unit_id = ? AND to_unit_id = ? AND active = 'Y'`, 
      [parseInt(from_unit_id), parseInt(to_unit_id)]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Konversi untuk pasangan satuan ini sudah ada' });
    }

    await executeQuery(
      `INSERT INTO POS_UnitConversions (from_unit_id, to_unit_id, multiplier) VALUES (?, ?, ?)`,
      [parseInt(from_unit_id), parseInt(to_unit_id), parseFloat(multiplier)]
    );
    res.json({ success: true, message: 'Konversi satuan berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update conversion
router.put('/conversions/:id', async (req, res) => {
  try {
    const { from_unit_id, to_unit_id, multiplier, active } = req.body;
    
    if (from_unit_id === to_unit_id) {
      return res.status(400).json({ success: false, message: 'Satuan asal dan tujuan tidak boleh sama' });
    }

    const existing = await executeQuery(
      `SELECT id FROM POS_UnitConversions WHERE from_unit_id = ? AND to_unit_id = ? AND id != ? AND active = 'Y'`, 
      [parseInt(from_unit_id), parseInt(to_unit_id), parseInt(req.params.id)]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Konversi untuk pasangan satuan ini sudah ada' });
    }

    await executeQuery(
      `UPDATE POS_UnitConversions SET from_unit_id=?, to_unit_id=?, multiplier=?, active=? WHERE id=?`,
      [parseInt(from_unit_id), parseInt(to_unit_id), parseFloat(multiplier), active || 'Y', parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Konversi satuan berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete conversion (soft)
router.delete('/conversions/:id', async (req, res) => {
  try {
    await executeQuery(`UPDATE POS_UnitConversions SET active = 'N' WHERE id = ?`, [parseInt(req.params.id)]);
    res.json({ success: true, message: 'Konversi satuan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
