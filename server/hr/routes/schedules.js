import { Router } from 'express';
import { executeQuery } from '../db.js';
import { authenticateToken } from '../middleware.js';

const router = Router();

// Helper to ensure time format is HH:MM:SS for SQL Anywhere
function formatTime(t) {
  if (!t) return '08:00:00';
  const s = t.toString();
  // If already HH:MM:SS
  if (s.match(/^\d{2}:\d{2}:\d{2}$/)) return s;
  // If HH:MM
  if (s.match(/^\d{2}:\d{2}$/)) return s + ':00';
  return s;
}

// GET all schedules
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery("SELECT * FROM HR_Schedules ORDER BY is_default DESC, name ASC");
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET active schedules only (for dropdowns)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery("SELECT id, name, is_default FROM HR_Schedules WHERE active = 'Y' ORDER BY is_default DESC, name ASC");
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single schedule
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery("SELECT * FROM HR_Schedules WHERE id = ?", [req.params.id]);
    if (result.length === 0) return res.status(404).json({ success: false, error: 'Jadwal tidak ditemukan' });
    res.json({ success: true, data: result[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST new schedule
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      name, is_default, 
      mon_active, mon_start, mon_end,
      tue_active, tue_start, tue_end,
      wed_active, wed_start, wed_end,
      thu_active, thu_start, thu_end,
      fri_active, fri_start, fri_end,
      sat_active, sat_start, sat_end,
      sun_active, sun_start, sun_end,
      late_tolerance, active
    } = req.body;

    if (is_default === 'Y') {
      await executeQuery("UPDATE HR_Schedules SET is_default = 'N'");
    }

    await executeQuery(`
      INSERT INTO HR_Schedules (
        name, is_default,
        mon_active, mon_start, mon_end,
        tue_active, tue_start, tue_end,
        wed_active, wed_start, wed_end,
        thu_active, thu_start, thu_end,
        fri_active, fri_start, fri_end,
        sat_active, sat_start, sat_end,
        sun_active, sun_start, sun_end,
        late_tolerance, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, is_default || 'N',
      mon_active || 'N', formatTime(mon_start), formatTime(mon_end),
      tue_active || 'N', formatTime(tue_start), formatTime(tue_end),
      wed_active || 'N', formatTime(wed_start), formatTime(wed_end),
      thu_active || 'N', formatTime(thu_start), formatTime(thu_end),
      fri_active || 'N', formatTime(fri_start), formatTime(fri_end),
      sat_active || 'N', formatTime(sat_start), formatTime(sat_end),
      sun_active || 'N', formatTime(sun_start), formatTime(sun_end),
      parseInt(late_tolerance) || 15, active || 'Y'
    ]);

    res.json({ success: true, message: 'Jadwal berhasil ditambahkan' });
  } catch (error) {
    console.error('Schedule POST error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update schedule
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { 
      name, is_default, 
      mon_active, mon_start, mon_end,
      tue_active, tue_start, tue_end,
      wed_active, wed_start, wed_end,
      thu_active, thu_start, thu_end,
      fri_active, fri_start, fri_end,
      sat_active, sat_start, sat_end,
      sun_active, sun_start, sun_end,
      late_tolerance, active
    } = req.body;

    if (is_default === 'Y') {
      await executeQuery("UPDATE HR_Schedules SET is_default = 'N' WHERE id != ?", [req.params.id]);
    }

    await executeQuery(`
      UPDATE HR_Schedules SET 
        name = ?, is_default = ?,
        mon_active = ?, mon_start = ?, mon_end = ?,
        tue_active = ?, tue_start = ?, tue_end = ?,
        wed_active = ?, wed_start = ?, wed_end = ?,
        thu_active = ?, thu_start = ?, thu_end = ?,
        fri_active = ?, fri_start = ?, fri_end = ?,
        sat_active = ?, sat_start = ?, sat_end = ?,
        sun_active = ?, sun_start = ?, sun_end = ?,
        late_tolerance = ?, active = ?
      WHERE id = ?
    `, [
      name, is_default || 'N',
      mon_active || 'N', formatTime(mon_start), formatTime(mon_end),
      tue_active || 'N', formatTime(tue_start), formatTime(tue_end),
      wed_active || 'N', formatTime(wed_start), formatTime(wed_end),
      thu_active || 'N', formatTime(thu_start), formatTime(thu_end),
      fri_active || 'N', formatTime(fri_start), formatTime(fri_end),
      sat_active || 'N', formatTime(sat_start), formatTime(sat_end),
      sun_active || 'N', formatTime(sun_start), formatTime(sun_end),
      parseInt(late_tolerance) || 15, active || 'Y',
      req.params.id
    ]);

    res.json({ success: true, message: 'Jadwal berhasil diupdate' });
  } catch (error) {
    console.error('Schedule PUT error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE schedule
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const check = await executeQuery("SELECT id FROM HR_Employees WHERE schedule_id = ?", [req.params.id]);
    if (check.length > 0) {
      return res.status(400).json({ success: false, error: 'Jadwal tidak bisa dihapus karena sedang digunakan oleh karyawan' });
    }
    
    await executeQuery("DELETE FROM HR_Schedules WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Jadwal berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
