import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeQuery, getSetting } from '../db.js';
import { authenticateToken } from '../middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function findNearestOffice(lat, lng, allowedOfficeIds = []) {
  let query = "SELECT * FROM HR_OfficeLocations WHERE active = 'Y'";
  let params = [];
  if (allowedOfficeIds && allowedOfficeIds.length > 0) {
    const placeholders = allowedOfficeIds.map(() => '?').join(',');
    query += ` AND id IN (${placeholders})`;
    params.push(...allowedOfficeIds);
  }
  const offices = await executeQuery(query, params);
  for (const office of offices) {
    const dist = haversineDistance(lat, lng, parseFloat(office.latitude), parseFloat(office.longitude));
    if (dist <= office.radius_meters) return { office, distance: Math.round(dist) };
  }
  return null;
}

async function getTodaySchedule(employeeId) {
  const emp = await executeQuery("SELECT schedule_id FROM HR_Employees WHERE id = ?", [employeeId]);
  let schedId = emp.length > 0 ? emp[0].schedule_id : null;

  let schedule = null;
  if (schedId) {
    const res = await executeQuery("SELECT * FROM HR_Schedules WHERE id = ?", [schedId]);
    if (res.length > 0) schedule = res[0];
  }

  if (!schedule) {
    const res = await executeQuery("SELECT * FROM HR_Schedules WHERE is_default = 'Y'");
    if (res.length > 0) schedule = res[0];
  }

  if (schedule) {
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const todayName = dayNames[new Date().getDay()];
    return {
      active: schedule[`${todayName}_active`] === 'Y',
      start: schedule[`${todayName}_start`],
      end: schedule[`${todayName}_end`],
      tolerance: schedule.late_tolerance
    };
  }
  return null;
}

// Clock In
router.post('/clock-in', authenticateToken, async (req, res) => {
  try {
    const { lat, lng, photo } = req.body;
    const employeeId = req.user.employee_id;
    if (!employeeId) return res.status(400).json({ success: false, error: 'User tidak terhubung dengan data karyawan' });

    // Check already clocked in today
    const today = await executeQuery("SELECT * FROM HR_Attendance WHERE employee_id = ? AND attendance_date = CURRENT DATE", [employeeId]);
    if (today.length > 0 && today[0].clock_in) return res.status(400).json({ success: false, error: 'Anda sudah melakukan clock-in hari ini' });

    // Validate GPS
    const u = await executeQuery("SELECT bypass_gps, allowed_offices FROM HR_Users WHERE id = ?", [req.user.id]);
    const canBypass = u.length > 0 && u[0].bypass_gps === 'Y';
    const allowedOfficesStr = u.length > 0 ? u[0].allowed_offices : null;
    const allowedOfficeIds = allowedOfficesStr ? allowedOfficesStr.split(',').map(Number) : [];

    const nearest = await findNearestOffice(lat, lng, allowedOfficeIds);
    if (!nearest && !canBypass) {
      if (allowedOfficeIds.length > 0) return res.status(400).json({ success: false, error: 'Lokasi Anda tidak berada di jangkauan kantor yang diizinkan untuk Anda.' });
      return res.status(400).json({ success: false, error: 'Lokasi Anda di luar jangkauan kantor. Pastikan Anda berada dalam radius kantor.' });
    }

    // Save selfie photo
    let photoPath = null;
    if (photo) {
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'attendance');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const fileName = `clockin_${employeeId}_${Date.now()}.jpg`;
      const base64Data = photo.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(uploadsDir, fileName), base64Data, 'base64');
      photoPath = `/uploads/attendance/${fileName}`;
    }

    // Calculate late
    const sched = await getTodaySchedule(employeeId);
    let workStart = await getSetting('WORK_START_TIME') || '08:00';
    let tolerance = parseInt(await getSetting('LATE_TOLERANCE_MINUTES') || '15');
    
    if (sched) {
      workStart = sched.start || workStart;
      tolerance = sched.tolerance !== undefined ? sched.tolerance : tolerance;
    }

    const now = new Date();
    const [startH, startM] = workStart.toString().split(':').map(Number);
    const startMinutes = startH * 60 + startM + tolerance;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // If schedule says day is not active, let's treat lateMinutes as 0
    const lateMinutes = (sched && !sched.active) ? 0 : Math.max(0, currentMinutes - startMinutes);
    const status = lateMinutes > 0 ? 'Late' : 'Present';

    if (today.length > 0) {
      await executeQuery(`UPDATE HR_Attendance SET clock_in = CURRENT TIME, clock_in_lat = ?, clock_in_lng = ?, clock_in_photo = ?, clock_in_location_id = ?, status = ?, late_minutes = ? WHERE id = ?`,
        [lat, lng, photoPath, nearest ? nearest.office.id : null, status, lateMinutes, today[0].id]);
    } else {
      await executeQuery(`INSERT INTO HR_Attendance (employee_id, attendance_date, clock_in, clock_in_lat, clock_in_lng, clock_in_photo, clock_in_location_id, status, late_minutes)
        VALUES (?, CURRENT DATE, CURRENT TIME, ?, ?, ?, ?, ?, ?)`,
        [employeeId, lat, lng, photoPath, nearest ? nearest.office.id : null, status, lateMinutes]);
    }

    res.json({ success: true, message: `Clock-in berhasil! ${lateMinutes > 0 ? `Terlambat ${lateMinutes} menit.` : 'Tepat waktu.'}`, office: nearest ? nearest.office.name : 'Lokasi Bebas (WFA)', distance: nearest ? nearest.distance : 0 });
  } catch (error) {
    console.error('Clock-in error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clock Out
router.post('/clock-out', authenticateToken, async (req, res) => {
  try {
    const { lat, lng, photo } = req.body;
    const employeeId = req.user.employee_id;
    if (!employeeId) return res.status(400).json({ success: false, error: 'User tidak terhubung dengan data karyawan' });

    const today = await executeQuery("SELECT * FROM HR_Attendance WHERE employee_id = ? AND attendance_date = CURRENT DATE", [employeeId]);
    if (today.length === 0 || !today[0].clock_in) return res.status(400).json({ success: false, error: 'Anda belum melakukan clock-in hari ini' });
    if (today[0].clock_out) return res.status(400).json({ success: false, error: 'Anda sudah melakukan clock-out hari ini' });

    const u = await executeQuery("SELECT bypass_gps, allowed_offices FROM HR_Users WHERE id = ?", [req.user.id]);
    const canBypass = u.length > 0 && u[0].bypass_gps === 'Y';
    const allowedOfficesStr = u.length > 0 ? u[0].allowed_offices : null;
    const allowedOfficeIds = allowedOfficesStr ? allowedOfficesStr.split(',').map(Number) : [];

    const nearest = await findNearestOffice(lat, lng, allowedOfficeIds);
    if (!nearest && !canBypass) {
      if (allowedOfficeIds.length > 0) return res.status(400).json({ success: false, error: 'Lokasi Anda tidak berada di jangkauan kantor yang diizinkan untuk Anda.' });
      return res.status(400).json({ success: false, error: 'Lokasi Anda di luar jangkauan kantor' });
    }

    let photoPath = null;
    if (photo) {
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'attendance');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const fileName = `clockout_${employeeId}_${Date.now()}.jpg`;
      const base64Data = photo.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(uploadsDir, fileName), base64Data, 'base64');
      photoPath = `/uploads/attendance/${fileName}`;
    }

    // Calculate work hours
    const sched = await getTodaySchedule(employeeId);
    let workEnd = await getSetting('WORK_END_TIME') || '17:00';
    if (sched) {
      workEnd = sched.end || workEnd;
    }

    const [endH, endM] = workEnd.toString().split(':').map(Number);
    const now = new Date();
    
    // If schedule says day is not active, treat early_leave_minutes as 0
    const earlyMinutes = (sched && !sched.active) ? 0 : Math.max(0, (endH * 60 + endM) - (now.getHours() * 60 + now.getMinutes()));

    await executeQuery(`UPDATE HR_Attendance SET clock_out = CURRENT TIME, clock_out_lat = ?, clock_out_lng = ?, clock_out_photo = ?, clock_out_location_id = ?,
      early_leave_minutes = ?, work_hours = DATEDIFF(minute, clock_in, CURRENT TIME) / 60.0 WHERE id = ?`,
      [lat, lng, photoPath, nearest ? nearest.office.id : null, earlyMinutes, today[0].id]);

    res.json({ success: true, message: 'Clock-out berhasil!', office: nearest ? nearest.office.name : 'Lokasi Bebas (WFA)', distance: nearest ? nearest.distance : 0 });
  } catch (error) {
    console.error('Clock-out error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Today's attendance for current user
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) return res.json({ success: true, data: null });
    const result = await executeQuery("SELECT * FROM HR_Attendance WHERE employee_id = ? AND attendance_date = CURRENT DATE", [employeeId]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Attendance list with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { employee_id, start_date, end_date, month, year } = req.query;
    let where = '1=1';
    let params = [];
    if (employee_id) { where += ' AND a.employee_id = ?'; params.push(employee_id); }
    if (start_date && end_date) { where += ' AND a.attendance_date BETWEEN ? AND ?'; params.push(start_date, end_date); }
    else if (month && year) { where += ' AND MONTH(a.attendance_date) = ? AND YEAR(a.attendance_date) = ?'; params.push(month, year); }

    const result = await executeQuery(`SELECT a.*, e.employee_code, e.full_name, e.department_id, d.name as department_name
      FROM HR_Attendance a JOIN HR_Employees e ON a.employee_id = e.id LEFT JOIN HR_Departments d ON e.department_id = d.id
      WHERE ${where} ORDER BY a.attendance_date DESC, e.full_name`, params);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// My attendance history
router.get('/my-history', authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    if (!employeeId) return res.json({ success: true, data: [] });
    const { month, year } = req.query;
    const m = month || new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();
    const result = await executeQuery(`SELECT * FROM HR_Attendance WHERE employee_id = ? AND MONTH(attendance_date) = ? AND YEAR(attendance_date) = ? ORDER BY attendance_date DESC`, [employeeId, m, y]);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== EDIT / DELETE ATTENDANCE ====================
// PUT - Edit attendance record
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { clock_in, clock_out, status, late_minutes, notes } = req.body;
    
    // Build dynamic update
    let setClauses = [];
    let params = [];

    if (clock_in !== undefined) { setClauses.push('clock_in = ?'); params.push(clock_in || null); }
    if (clock_out !== undefined) { setClauses.push('clock_out = ?'); params.push(clock_out || null); }
    if (status !== undefined) { setClauses.push('status = ?'); params.push(status); }
    if (late_minutes !== undefined) { setClauses.push('late_minutes = ?'); params.push(parseInt(late_minutes) || 0); }
    if (notes !== undefined) { setClauses.push('notes = ?'); params.push(notes); }

    // Recalculate work_hours if both clock_in and clock_out are provided
    if (clock_in && clock_out) {
      setClauses.push("work_hours = DATEDIFF(minute, ?, ?) / 60.0");
      params.push(clock_in, clock_out);
    }

    if (setClauses.length === 0) return res.status(400).json({ success: false, error: 'Tidak ada data yang diupdate' });

    params.push(req.params.id);
    await executeQuery(`UPDATE HR_Attendance SET ${setClauses.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Data absensi berhasil diupdate' });
  } catch (error) {
    console.error('Attendance PUT error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE - Delete attendance record
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery("DELETE FROM HR_Attendance WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Data absensi berhasil dihapus' });
  } catch (error) {
    console.error('Attendance DELETE error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== OFFICE LOCATIONS ====================
router.get('/offices', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery("SELECT * FROM HR_OfficeLocations ORDER BY name");
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/offices', authenticateToken, async (req, res) => {
  try {
    const { name, address, latitude, longitude, radius_meters } = req.body;
    await executeQuery("INSERT INTO HR_OfficeLocations (name, address, latitude, longitude, radius_meters) VALUES (?, ?, ?, ?, ?)",
      [name, address, latitude, longitude, radius_meters || 100]);
    res.json({ success: true, message: 'Lokasi kantor berhasil ditambahkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/offices/:id', authenticateToken, async (req, res) => {
  try {
    const { name, address, latitude, longitude, radius_meters, active } = req.body;
    await executeQuery("UPDATE HR_OfficeLocations SET name=?, address=?, latitude=?, longitude=?, radius_meters=?, active=? WHERE id=?",
      [name, address, latitude, longitude, radius_meters, active||'Y', req.params.id]);
    res.json({ success: true, message: 'Lokasi kantor berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.delete('/offices/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery("DELETE FROM HR_OfficeLocations WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Lokasi kantor berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;
