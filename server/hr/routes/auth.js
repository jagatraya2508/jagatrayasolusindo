import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { executeQuery } from '../db.js';
import { authenticateToken, JWT_SECRET } from '../middleware.js';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = await executeQuery("SELECT u.*, r.name as role_name, r.is_superadmin FROM HR_Users u LEFT JOIN HR_Roles r ON u.role_id = r.id WHERE u.username = ? AND u.active = 'Y'", [username]);
    if (users.length === 0) return res.status(401).json({ success: false, error: 'Username atau password salah' });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, error: 'Username atau password salah' });

    let permissions = [];
    if (user.role_id) {
      permissions = await executeQuery('SELECT * FROM HR_RolePermissions WHERE role_id = ?', [user.role_id]);
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role_id: user.role_id, employee_id: user.employee_id, is_superadmin: user.is_superadmin },
      JWT_SECRET, { expiresIn: '24h' }
    );

    res.json({
      success: true, token,
      user: { id: user.id, username: user.username, full_name: user.full_name, employee_id: user.employee_id, role: user.role_name, is_superadmin: user.is_superadmin, permissions }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const users = await executeQuery("SELECT u.*, r.name as role_name, r.is_superadmin FROM HR_Users u LEFT JOIN HR_Roles r ON u.role_id = r.id WHERE u.id = ?", [req.user.id]);
    if (users.length === 0) return res.sendStatus(404);
    const user = users[0];
    let permissions = [];
    if (user.role_id) permissions = await executeQuery('SELECT * FROM HR_RolePermissions WHERE role_id = ?', [user.role_id]);
    res.json({ success: true, user: { id: user.id, username: user.username, full_name: user.full_name, employee_id: user.employee_id, role: user.role_name, is_superadmin: user.is_superadmin, permissions } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const users = await executeQuery('SELECT * FROM HR_Users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!valid) return res.status(400).json({ success: false, error: 'Password saat ini salah' });
    const hash = await bcrypt.hash(newPassword, 10);
    await executeQuery('UPDATE HR_Users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

export default router;
