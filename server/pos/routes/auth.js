import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { executeQuery } from '../db.js';

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
    }

    const users = await executeQuery(
      `SELECT u.*, r.name as role_name, r.is_superadmin
       FROM POS_Users u
       LEFT JOIN POS_Roles r ON u.role_id = r.id
       WHERE u.username = ? AND u.active = 'Y'`, [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }

    user.entity_ids = [];
    user.site_ids = [];
    if (user.access_level === 'CUSTOM') {
      const accesses = await executeQuery(`SELECT entity_id, site_id FROM POS_UserAccess WHERE user_id = ?`, [user.id]);
      user.entity_ids = accesses.filter(a => a.entity_id !== null).map(a => a.entity_id);
      user.site_ids = accesses.filter(a => a.site_id !== null).map(a => a.site_id);
    }

    // Get permissions
    let permissions = {};
    if (user.is_superadmin === 'Y') {
      permissions = { _superadmin: true };
    } else {
      const perms = await executeQuery(
        'SELECT feature_key, can_view, can_create, can_edit, can_delete, can_approve FROM POS_RolePermissions WHERE role_id = ?',
        [user.role_id]
      );
      perms.forEach(p => {
        permissions[p.feature_key] = {
          view: p.can_view === 'Y',
          create: p.can_create === 'Y',
          edit: p.can_edit === 'Y',
          delete: p.can_delete === 'Y',
          approve: p.can_approve === 'Y',
        };
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role_id: user.role_id, role_name: user.role_name, is_superadmin: user.is_superadmin, access_level: user.access_level },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role_id: user.role_id,
        role_name: user.role_name,
        is_superadmin: user.is_superadmin,
        access_level: user.access_level,
        entity_ids: user.entity_ids,
        site_ids: user.site_ids,
        permissions,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const users = await executeQuery(
      `SELECT u.id, u.username, u.full_name, u.role_id, u.access_level, r.name as role_name, r.is_superadmin
       FROM POS_Users u LEFT JOIN POS_Roles r ON u.role_id = r.id WHERE u.id = ?`, [decoded.id]
    );
    if (users.length === 0) return res.status(401).json({ success: false });
    
    const user = users[0];
    user.entity_ids = [];
    user.site_ids = [];

    if (user.access_level === 'CUSTOM') {
      const accesses = await executeQuery(`SELECT entity_id, site_id FROM POS_UserAccess WHERE user_id = ?`, [user.id]);
      user.entity_ids = accesses.filter(a => a.entity_id !== null).map(a => a.entity_id);
      user.site_ids = accesses.filter(a => a.site_id !== null).map(a => a.site_id);
    }
    
    // permissions are not refetched here to save time since it's just basic session check, but could be.
    res.json({ success: true, user: user });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
});

export default router;
