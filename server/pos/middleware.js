import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeQuery } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // Default empty
    req.user.entity_ids = [];
    req.user.site_ids = [];

    // Force ALL access if superadmin
    let accessLevel = req.user.access_level;
    if (req.user.is_superadmin === 'Y') {
      accessLevel = 'ALL';
      req.user.access_level = 'ALL';
    }

    if (accessLevel === 'CUSTOM') {
      try {
        const accesses = await executeQuery(`SELECT entity_id, site_id FROM POS_UserAccess WHERE user_id = ?`, [req.user.id]);
        req.user.entity_ids = accesses.filter(a => a.entity_id !== null).map(a => a.entity_id);
        req.user.site_ids = accesses.filter(a => a.site_id !== null).map(a => a.site_id);

        let outletConditions = [];
        if (req.user.entity_ids.length > 0) {
          outletConditions.push(`site_id IN (SELECT id FROM POS_Sites WHERE entity_id IN (${req.user.entity_ids.join(',')}))`);
        }
        if (req.user.site_ids.length > 0) {
          outletConditions.push(`site_id IN (${req.user.site_ids.join(',')})`);
        }
        
        if (outletConditions.length > 0) {
          const outlets = await executeQuery(`SELECT id FROM POS_Outlets WHERE ${outletConditions.join(' OR ')}`);
          req.user.outlet_ids = outlets.map(o => o.id);
        } else {
          req.user.outlet_ids = [];
        }
      } catch (dbErr) {
        console.error('Gagal mengambil User Access:', dbErr.message);
      }
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token tidak valid' });
  }
}
