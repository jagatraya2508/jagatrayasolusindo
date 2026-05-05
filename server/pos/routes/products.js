import express from 'express';
import { executeQuery } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Get all products with search & category filter
router.get('/', async (req, res) => {
  try {
    const { search, category_id, active, is_food } = req.query;
    let sql = `SELECT p.*, c.name as category_name FROM POS_Products p LEFT JOIN POS_Categories c ON p.category_id = c.id WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ` AND (p.name LIKE ? OR p.code LIKE ? OR p.barcode LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category_id) {
      sql += ` AND p.category_id = ?`;
      params.push(parseInt(category_id));
    }
    if (is_food !== undefined) {
      sql += ` AND p.is_food = ?`;
      params.push(is_food);
    }
    if (active !== undefined) {
      sql += ` AND p.active = ?`;
      params.push(active);
    } else {
      sql += ` AND p.active = 'Y'`;
    }

    sql += ` ORDER BY p.name`;
    const products = await executeQuery(sql, params);
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get product by barcode
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const products = await executeQuery(
      `SELECT p.*, c.name as category_name FROM POS_Products p LEFT JOIN POS_Categories c ON p.category_id = c.id WHERE p.barcode = ? AND p.active = 'Y'`,
      [req.params.barcode]
    );
    if (products.length === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    res.json({ success: true, data: products[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const products = await executeQuery(
      `SELECT p.*, c.name as category_name FROM POS_Products p LEFT JOIN POS_Categories c ON p.category_id = c.id WHERE p.id = ?`,
      [parseInt(req.params.id)]
    );
    if (products.length === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    res.json({ success: true, data: products[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function to save base64 image to file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const saveBase64Image = (base64String, code) => {
  if (!base64String || typeof base64String !== 'string') {
    return base64String;
  }
  if (!base64String.startsWith('data:image')) {
    return base64String;
  }
  
  try {
    const parts = base64String.split('base64,');
    if (parts.length !== 2) {
      return null;
    }
    
    let ext = 'jpg';
    if (parts[0].includes('png')) ext = 'png';
    else if (parts[0].includes('webp')) ext = 'webp';
    
    const buffer = Buffer.from(parts[1], 'base64');
    const safeCode = code || 'UNKNOWN';
    const filename = `product_${safeCode}_${Date.now()}.${ext}`;
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uploadsPath = path.join(uploadsDir, filename);
    fs.writeFileSync(uploadsPath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Error saving image:', err);
    return null;
  }
};

// Create product
router.post('/', async (req, res) => {
  try {
    const { name, description, category_id, sell_price, cost_price, stock, min_stock, unit, erp_item_code, image, is_food, discount_percent, discount_amount } = req.body;
    let { code, barcode } = req.body;

    // Check settings for auto/manual code generation
    const settings = await executeQuery(`SELECT setting_key, setting_value FROM POS_Settings WHERE setting_key IN ('PRODUCT_CODE_MODE', 'PRODUCT_CODE_PREFIX')`);
    const codeMode = settings.find(s => s.setting_key === 'PRODUCT_CODE_MODE')?.setting_value || 'MANUAL';
    const codePrefix = settings.find(s => s.setting_key === 'PRODUCT_CODE_PREFIX')?.setting_value || 'PRD';

    if (codeMode === 'AUTO') {
      const lastProduct = await executeQuery(
        `SELECT TOP 1 code FROM POS_Products WHERE code LIKE ? ORDER BY code DESC`,
        [`${codePrefix}%`]
      );
      
      let nextNum = 1;
      if (lastProduct.length > 0) {
        const lastCode = lastProduct[0].code;
        const numMatch = lastCode.match(/\d+$/);
        if (numMatch) nextNum = parseInt(numMatch[0]) + 1;
      }
      code = `${codePrefix}${nextNum.toString().padStart(3, '0')}`;
    }

    if (!code) return res.status(400).json({ success: false, message: 'Kode produk wajib diisi' });
    if (is_food === 'Y') barcode = code;

    // Save image to file if it is base64
    const imagePath = saveBase64Image(image, code);

    await executeQuery(
      `INSERT INTO POS_Products (code, barcode, name, description, category_id, sell_price, cost_price, stock, min_stock, unit, erp_item_code, image, is_food, discount_percent, discount_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, barcode || null, name, description || null, category_id || null, sell_price || 0, cost_price || 0, stock || 0, min_stock || 0, unit || 'PCS', erp_item_code || null, imagePath || null, is_food || 'N', discount_percent || 0, discount_amount || 0]
    );
    res.json({ success: true, message: 'Produk berhasil ditambahkan', code });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    let { code, barcode, name, description, category_id, sell_price, cost_price, stock, min_stock, unit, erp_item_code, image, is_food, active, discount_percent, discount_amount } = req.body;
    
    if (!code) return res.status(400).json({ success: false, message: 'Kode produk wajib diisi' });
    if (is_food === 'Y') barcode = code;
    
    console.log(`[PUT /products/${req.params.id}] Code: ${code}, Image Length: ${image ? image.length : 0}, is string: ${typeof image === 'string'}`);
    
    // Save image to file if it is a NEW base64 string
    // If it's already a URL (/uploads/...), saveBase64Image will return it directly
    const imagePath = saveBase64Image(image, code);
    
    console.log(`[PUT /products/${req.params.id}] Result imagePath: ${imagePath}`);

    await executeQuery(
      `UPDATE POS_Products SET code=?, barcode=?, name=?, description=?, category_id=?, sell_price=?, cost_price=?, stock=?, min_stock=?, unit=?, erp_item_code=?, image=?, is_food=?, active=?, discount_percent=?, discount_amount=? WHERE id=?`,
      [code, barcode || null, name, description || null, category_id || null, sell_price || 0, cost_price || 0, stock || 0, min_stock || 0, unit || 'PCS', erp_item_code || null, imagePath || null, is_food || 'N', active || 'Y', discount_percent || 0, discount_amount || 0, parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Produk berhasil diupdate' });
  } catch (error) {
    console.error('PUT ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete product (soft)
router.delete('/:id', async (req, res) => {
  try {
    await executeQuery(`UPDATE POS_Products SET active = 'N' WHERE id = ?`, [parseInt(req.params.id)]);
    res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
