import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await executeQuery(`SELECT * FROM POS_Settings ORDER BY setting_key`);
    const data = {};
    settings.forEach(s => { data[s.setting_key] = s.setting_value; });
    res.json({ success: true, data, raw: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get business types from ERP
router.get('/business-types', async (req, res) => {
  try {
    const businessTypes = await executeQuery(`SELECT * FROM BusinessTypes WHERE active = 'Y' ORDER BY name`);
    res.json({ success: true, data: businessTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update setting
router.put('/:key', async (req, res) => {
  try {
    const { value } = req.body;
    const existing = await executeQuery(`SELECT id FROM POS_Settings WHERE setting_key = ?`, [req.params.key]);
    if (existing.length > 0) {
      await executeQuery(`UPDATE POS_Settings SET setting_value = ? WHERE setting_key = ?`, [value, req.params.key]);
    } else {
      await executeQuery(`INSERT INTO POS_Settings (setting_key, setting_value) VALUES (?, ?)`, [req.params.key, value]);
    }
    res.json({ success: true, message: 'Setting berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk update settings
router.post('/bulk', async (req, res) => {
  try {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      const existing = await executeQuery(`SELECT id FROM POS_Settings WHERE setting_key = ?`, [key]);
      if (existing.length > 0) {
        await executeQuery(`UPDATE POS_Settings SET setting_value = ? WHERE setting_key = ?`, [value, key]);
      } else {
        await executeQuery(`INSERT INTO POS_Settings (setting_key, setting_value) VALUES (?, ?)`, [key, value]);
      }
    }
    res.json({ success: true, message: 'Settings berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
