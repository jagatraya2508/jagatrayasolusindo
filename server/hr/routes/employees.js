import { Router } from 'express';
import { executeQuery } from '../db.js';
import { authenticateToken } from '../middleware.js';

const router = Router();

// ==================== EMPLOYEES ====================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT e.*, d.name as department_name, p.name as position_name, s.name as schedule_name
      FROM HR_Employees e
      LEFT JOIN HR_Departments d ON e.department_id = d.id
      LEFT JOIN HR_Positions p ON e.position_id = p.id
      LEFT JOIN HR_Schedules s ON e.schedule_id = s.id
      ORDER BY e.employee_code
    `);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT e.*, d.name as department_name, p.name as position_name, s.name as schedule_name
      FROM HR_Employees e
      LEFT JOIN HR_Departments d ON e.department_id = d.id
      LEFT JOIN HR_Positions p ON e.position_id = p.id
      LEFT JOIN HR_Schedules s ON e.schedule_id = s.id
      WHERE e.id = ?
    `, [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const b = req.body;
    let empCode = b.employee_code;

    const settings = await executeQuery("SELECT * FROM HR_Settings WHERE setting_key IN ('EMPLOYEE_CODE_MODE', 'EMPLOYEE_CODE_PREFIX', 'EMPLOYEE_CODE_CURRENT')");
    const getSetting = (key, def) => {
      const s = settings.find(x => x.setting_key === key);
      return s ? s.setting_value : def;
    };

    const mode = getSetting('EMPLOYEE_CODE_MODE', 'MANUAL');
    if (mode === 'AUTO') {
      const prefix = getSetting('EMPLOYEE_CODE_PREFIX', 'EMP-');
      let current = parseInt(getSetting('EMPLOYEE_CODE_CURRENT', '0'), 10) || 0;
      current += 1;
      const seq = current.toString().padStart(3, '0');
      empCode = `${prefix}${seq}`;

      const existing = await executeQuery("SELECT * FROM HR_Settings WHERE setting_key = 'EMPLOYEE_CODE_CURRENT'");
      if (existing.length > 0) {
        await executeQuery("UPDATE HR_Settings SET setting_value = ? WHERE setting_key = 'EMPLOYEE_CODE_CURRENT'", [current.toString()]);
      } else {
        await executeQuery("INSERT INTO HR_Settings (setting_key, setting_value) VALUES ('EMPLOYEE_CODE_CURRENT', ?)", [current.toString()]);
      }
    } else if (!empCode || empCode === '[Otomatis]') {
      return res.status(400).json({ success: false, error: 'Kode Karyawan wajib diisi' });
    }

    await executeQuery(`
      INSERT INTO HR_Employees (employee_code, full_name, email, phone, gender, birth_date, birth_place, address, id_number, join_date,
        department_id, position_id, employment_status, marital_status, bank_name, bank_account, bank_account_name,
        base_salary, transport_allowance, meal_allowance, position_allowance, other_allowance,
        npwp, ptkp_status, bpjs_kes_no, bpjs_tk_no, schedule_id, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Y')
    `, [empCode, b.full_name, b.email, b.phone, b.gender, b.birth_date || null, b.birth_place,
        b.address, b.id_number, b.join_date || null, b.department_id || null, b.position_id || null,
        b.employment_status || 'Tetap', b.marital_status || 'TK', b.bank_name, b.bank_account, b.bank_account_name,
        b.base_salary || 0, b.transport_allowance || 0, b.meal_allowance || 0, b.position_allowance || 0, b.other_allowance || 0,
        b.npwp, b.ptkp_status || 'TK/0', b.bpjs_kes_no, b.bpjs_tk_no, b.schedule_id || null]);
    res.json({ success: true, message: 'Karyawan berhasil ditambahkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const b = req.body;
    await executeQuery(`
      UPDATE HR_Employees SET employee_code=?, full_name=?, email=?, phone=?, gender=?, birth_date=?, birth_place=?, address=?, id_number=?,
        join_date=?, department_id=?, position_id=?, employment_status=?, marital_status=?, bank_name=?, bank_account=?, bank_account_name=?,
        base_salary=?, transport_allowance=?, meal_allowance=?, position_allowance=?, other_allowance=?,
        npwp=?, ptkp_status=?, bpjs_kes_no=?, bpjs_tk_no=?, schedule_id=?, active=?
      WHERE id = ?
    `, [b.employee_code, b.full_name, b.email, b.phone, b.gender, b.birth_date || null, b.birth_place,
        b.address, b.id_number, b.join_date || null, b.department_id || null, b.position_id || null,
        b.employment_status, b.marital_status, b.bank_name, b.bank_account, b.bank_account_name,
        b.base_salary || 0, b.transport_allowance || 0, b.meal_allowance || 0, b.position_allowance || 0, b.other_allowance || 0,
        b.npwp, b.ptkp_status, b.bpjs_kes_no, b.bpjs_tk_no, b.schedule_id || null, b.active || 'Y', req.params.id]);
    res.json({ success: true, message: 'Karyawan berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery("UPDATE HR_Employees SET active = 'N', resign_date = CURRENT DATE WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Karyawan berhasil dinonaktifkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== DEPARTMENTS ====================
router.get('/master/departments', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery("SELECT * FROM HR_Departments ORDER BY code");
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/master/departments', authenticateToken, async (req, res) => {
  try {
    const { code, name } = req.body;
    await executeQuery("INSERT INTO HR_Departments (code, name) VALUES (?, ?)", [code, name]);
    res.json({ success: true, message: 'Departemen berhasil ditambahkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/master/departments/:id', authenticateToken, async (req, res) => {
  try {
    const { code, name, active } = req.body;
    await executeQuery("UPDATE HR_Departments SET code=?, name=?, active=? WHERE id=?", [code, name, active||'Y', req.params.id]);
    res.json({ success: true, message: 'Departemen berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.delete('/master/departments/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery("DELETE FROM HR_Departments WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Departemen berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== POSITIONS ====================
router.get('/master/positions', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery("SELECT p.*, d.name as department_name FROM HR_Positions p LEFT JOIN HR_Departments d ON p.department_id = d.id ORDER BY p.code");
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/master/positions', authenticateToken, async (req, res) => {
  try {
    const { code, name, department_id, level } = req.body;
    await executeQuery("INSERT INTO HR_Positions (code, name, department_id, level) VALUES (?, ?, ?, ?)", [code, name, department_id||null, level||1]);
    res.json({ success: true, message: 'Jabatan berhasil ditambahkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/master/positions/:id', authenticateToken, async (req, res) => {
  try {
    const { code, name, department_id, level, active } = req.body;
    await executeQuery("UPDATE HR_Positions SET code=?, name=?, department_id=?, level=?, active=? WHERE id=?", [code, name, department_id||null, level||1, active||'Y', req.params.id]);
    res.json({ success: true, message: 'Jabatan berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.delete('/master/positions/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery("DELETE FROM HR_Positions WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Jabatan berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;
