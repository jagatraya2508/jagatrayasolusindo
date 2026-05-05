import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { executeQuery } from '../db.js';
import { authenticateToken } from '../middleware.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Konfigurasi Multer untuk Upload
const uploadsDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `company-logo-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// ==================== SETTINGS ====================
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery("SELECT * FROM HR_Settings ORDER BY setting_key");
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/update', authenticateToken, async (req, res) => {
  try {
    const { settings } = req.body;
    for (const s of settings) {
      const existing = await executeQuery("SELECT * FROM HR_Settings WHERE setting_key = ?", [s.setting_key]);
      if (existing.length > 0) {
        await executeQuery("UPDATE HR_Settings SET setting_value = ? WHERE setting_key = ?", [s.setting_value, s.setting_key]);
      } else {
        await executeQuery("INSERT INTO HR_Settings (setting_key, setting_value) VALUES (?, ?)", [s.setting_key, s.setting_value]);
      }
    }
    res.json({ success: true, message: 'Pengaturan berhasil disimpan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/upload-logo', authenticateToken, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Tidak ada file logo' });
    const logoUrl = `/uploads/${req.file.filename}`;
    
    const existing = await executeQuery("SELECT * FROM HR_Settings WHERE setting_key = 'COMPANY_LOGO'");
    if (existing.length > 0) {
      await executeQuery("UPDATE HR_Settings SET setting_value = ? WHERE setting_key = 'COMPANY_LOGO'", [logoUrl]);
    } else {
      await executeQuery("INSERT INTO HR_Settings (setting_key, setting_value) VALUES ('COMPANY_LOGO', ?)", [logoUrl]);
    }

    res.json({ success: true, message: 'Logo perusahaan berhasil diubah!', logoUrl });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== USER MANAGEMENT ====================
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery(`SELECT u.id, u.username, u.full_name, u.phone, u.employee_id, u.role_id, u.active, u.bypass_gps, u.allowed_offices, r.name as role_name, e.employee_code, e.full_name as employee_name
      FROM HR_Users u LEFT JOIN HR_Roles r ON u.role_id = r.id LEFT JOIN HR_Employees e ON u.employee_id = e.id ORDER BY u.username`);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/users', authenticateToken, async (req, res) => {
  try {
    const { username, password, full_name, phone, employee_id, role_id, bypass_gps, allowed_offices } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const officesStr = Array.isArray(allowed_offices) ? allowed_offices.join(',') : (allowed_offices || null);
    await executeQuery("INSERT INTO HR_Users (username, password_hash, full_name, phone, employee_id, role_id, bypass_gps, allowed_offices) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [username, hash, full_name, phone, employee_id || null, role_id, bypass_gps || 'N', officesStr]);
    res.json({ success: true, message: 'User berhasil dibuat' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    console.log("=== DEBUG PUT USER ===");
    console.log("Body:", req.body);
    const { username, full_name, phone, employee_id, role_id, active, password, bypass_gps, allowed_offices } = req.body;
    const officesStr = Array.isArray(allowed_offices) ? allowed_offices.join(',') : (allowed_offices || null);
    console.log("officesStr to save:", officesStr);
    
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await executeQuery("UPDATE HR_Users SET username=?, password_hash=?, full_name=?, phone=?, employee_id=?, role_id=?, active=?, bypass_gps=?, allowed_offices=? WHERE id=?",
        [username, hash, full_name, phone, employee_id||null, role_id, active||'Y', bypass_gps||'N', officesStr, req.params.id]);
    } else {
      await executeQuery("UPDATE HR_Users SET username=?, full_name=?, phone=?, employee_id=?, role_id=?, active=?, bypass_gps=?, allowed_offices=? WHERE id=?",
        [username, full_name, phone, employee_id||null, role_id, active||'Y', bypass_gps||'N', officesStr, req.params.id]);
    }
    console.log("Update success HR_Users");
    res.json({ success: true, message: 'User berhasil diupdate' });
  } catch (error) { 
    console.error("DEBUG PUT ERROR:", error);
    res.status(500).json({ success: false, error: error.message }); 
  }
});

router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery("DELETE FROM HR_Users WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== ROLE MANAGEMENT ====================
router.get('/roles', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery("SELECT * FROM HR_Roles ORDER BY name");
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get('/roles/:id', authenticateToken, async (req, res) => {
  try {
    const roles = await executeQuery("SELECT * FROM HR_Roles WHERE id = ?", [req.params.id]);
    if (roles.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    const permissions = await executeQuery("SELECT * FROM HR_RolePermissions WHERE role_id = ?", [req.params.id]);
    res.json({ success: true, data: { ...roles[0], permissions } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post('/roles', authenticateToken, async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    await executeQuery("INSERT INTO HR_Roles (name, description) VALUES (?, ?)", [name, description]);
    const roleResult = await executeQuery("SELECT id FROM HR_Roles WHERE name = ?", [name]);
    const roleId = roleResult[0].id;
    if (permissions && permissions.length > 0) {
      for (const p of permissions) {
        await executeQuery("INSERT INTO HR_RolePermissions (role_id, feature_key, can_view, can_create, can_edit, can_delete, can_approve) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [roleId, p.feature_key, p.can_view||'N', p.can_create||'N', p.can_edit||'N', p.can_delete||'N', p.can_approve||'N']);
      }
    }
    res.json({ success: true, message: 'Role berhasil dibuat' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.put('/roles/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    await executeQuery("UPDATE HR_Roles SET name=?, description=? WHERE id=?", [name, description, req.params.id]);
    await executeQuery("DELETE FROM HR_RolePermissions WHERE role_id = ?", [req.params.id]);
    if (permissions && permissions.length > 0) {
      for (const p of permissions) {
        await executeQuery("INSERT INTO HR_RolePermissions (role_id, feature_key, can_view, can_create, can_edit, can_delete, can_approve) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [req.params.id, p.feature_key, p.can_view||'N', p.can_create||'N', p.can_edit||'N', p.can_delete||'N', p.can_approve||'N']);
      }
    }
    res.json({ success: true, message: 'Role berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.delete('/roles/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery("DELETE FROM HR_RolePermissions WHERE role_id = ?", [req.params.id]);
    await executeQuery("DELETE FROM HR_Roles WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Role berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;
