import express from 'express';
import bcrypt from 'bcryptjs';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await executeQuery(
      `SELECT u.id, u.username, u.full_name, u.phone, u.role_id, u.active, u.created_at, u.access_level, r.name as role_name
       FROM POS_Users u LEFT JOIN POS_Roles r ON u.role_id = r.id ORDER BY u.full_name`
    );
    
    // Fetch custom access for users
    for (const u of users) {
      if (u.access_level === 'CUSTOM') {
        const accesses = await executeQuery(`SELECT entity_id, site_id FROM POS_UserAccess WHERE user_id = ?`, [u.id]);
        u.entity_ids = accesses.filter(a => a.entity_id !== null).map(a => a.entity_id);
        u.site_ids = accesses.filter(a => a.site_id !== null).map(a => a.site_id);
      } else {
        u.entity_ids = [];
        u.site_ids = [];
      }
    }
    
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create user
router.post('/', async (req, res) => {
  try {
    const { username, password, full_name, phone, role_id, access_level, entity_ids, site_ids } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await executeQuery(
      `INSERT INTO POS_Users (username, password_hash, full_name, phone, role_id, access_level) VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hash, full_name, phone || null, role_id || 1, access_level || 'ALL']
    );
    
    // Get inserted user id
    const inserted = await executeQuery(`SELECT id FROM POS_Users WHERE username = ?`, [username]);
    if (inserted.length > 0) {
      const userId = inserted[0].id;
      if (access_level === 'CUSTOM') {
        if (entity_ids && entity_ids.length > 0) {
          for (let eid of entity_ids) await executeQuery(`INSERT INTO POS_UserAccess (user_id, entity_id) VALUES (?, ?)`, [userId, eid]);
        }
        if (site_ids && site_ids.length > 0) {
          for (let sid of site_ids) await executeQuery(`INSERT INTO POS_UserAccess (user_id, site_id) VALUES (?, ?)`, [userId, sid]);
        }
      }
    }

    res.json({ success: true, message: 'User berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, password, full_name, phone, role_id, active, access_level, entity_ids, site_ids } = req.body;
    
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await executeQuery(
        `UPDATE POS_Users SET username=?, password_hash=?, full_name=?, phone=?, role_id=?, active=?, access_level=? WHERE id=?`,
        [username, hash, full_name, phone || null, role_id, active || 'Y', access_level || 'ALL', userId]
      );
    } else {
      await executeQuery(
        `UPDATE POS_Users SET username=?, full_name=?, phone=?, role_id=?, active=?, access_level=? WHERE id=?`,
        [username, full_name, phone || null, role_id, active || 'Y', access_level || 'ALL', userId]
      );
    }

    // Reset and update access
    await executeQuery(`DELETE FROM POS_UserAccess WHERE user_id = ?`, [userId]);
    if (access_level === 'CUSTOM') {
      if (entity_ids && entity_ids.length > 0) {
        for (let eid of entity_ids) await executeQuery(`INSERT INTO POS_UserAccess (user_id, entity_id) VALUES (?, ?)`, [userId, eid]);
      }
      if (site_ids && site_ids.length > 0) {
        for (let sid of site_ids) await executeQuery(`INSERT INTO POS_UserAccess (user_id, site_id) VALUES (?, ?)`, [userId, sid]);
      }
    }

    res.json({ success: true, message: 'User berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get roles
router.get('/roles', async (req, res) => {
  try {
    const roles = await executeQuery(`SELECT * FROM POS_Roles WHERE active = 'Y' ORDER BY name`);
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
