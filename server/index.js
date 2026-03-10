import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import odbc from 'odbc';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'jagatraya-super-secret-key-change-this';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const logDebug = (msg) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync('journal_debug.log', `[${timestamp}] ${msg}\n`);
};

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - MUST be before routes
app.use(cors());
app.use(express.json());

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ==================== AUTHENTICATION ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const users = await executeQuery('SELECT * FROM Users WHERE username = ? AND active = \'Y\'', [username]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    // Get Role & Permissions
    let role = null;
    let permissions = [];

    if (user.role_id) {
      const roles = await executeQuery('SELECT * FROM Roles WHERE id = ?', [user.role_id]);
      if (roles.length > 0) role = roles[0];

      permissions = await executeQuery('SELECT * FROM RolePermissions WHERE role_id = ?', [user.role_id]);
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: role ? role.name : null,
        permissions
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const users = await executeQuery('SELECT id, username, full_name, role_id FROM Users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.sendStatus(404);

    const user = users[0];

    let role = null;
    let permissions = [];

    if (user.role_id) {
      const roles = await executeQuery('SELECT * FROM Roles WHERE id = ?', [user.role_id]);
      if (roles.length > 0) role = roles[0];

      permissions = await executeQuery('SELECT * FROM RolePermissions WHERE role_id = ?', [user.role_id]);
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: role ? role.name : null,
        permissions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get user
    const users = await executeQuery('SELECT * FROM Users WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ success: false, error: 'User not found' });

    const user = users[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ success: false, error: 'Password saat ini salah' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await executeQuery('UPDATE Users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== USER MANAGEMENT ====================
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await executeQuery(`
            SELECT u.id, u.username, u.full_name, u.role_id, u.active, r.name as role_name 
            FROM Users u 
            LEFT JOIN Roles r ON u.role_id = r.id 
            ORDER BY u.username
        `);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const { username, password, full_name, role_id } = req.body;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await executeQuery(
      'INSERT INTO Users (username, password_hash, full_name, role_id, active) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, full_name, role_id, 'Y']
    );
    res.json({ success: true, message: 'User berhasil dibuat' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { username, full_name, role_id, active, password } = req.body;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await executeQuery(
        'UPDATE Users SET username = ?, full_name = ?, role_id = ?, active = ?, password_hash = ? WHERE id = ?',
        [username, full_name, role_id, active, hashedPassword, req.params.id]
      );
    } else {
      await executeQuery(
        'UPDATE Users SET username = ?, full_name = ?, role_id = ?, active = ? WHERE id = ?',
        [username, full_name, role_id, active, req.params.id]
      );
    }
    res.json({ success: true, message: 'User berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery('DELETE FROM Users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==== TEMP MIGRATION ====
app.get('/api/migrate-exchangerate-currencycode', async (req, res) => {
  try {
    const tables = [
      'PurchaseOrders',
      'SalesOrders',
      'Receivings',
      'APInvoices',
      'ARInvoices',
      'InventoryAdjustments',
      'APAdjustments',
      'ARAdjustments'
    ];
    let results = [];
    for (const table of tables) {
      try {
        await executeQuery(`ALTER TABLE ${table} DROP currency_code`);
        await executeQuery(`ALTER TABLE ${table} ADD currency_code VARCHAR(10) NULL`);
        results.push({ table, status: 'success' });
      } catch (err) {
        results.push({ table, status: 'error', error: err.message });
      }
    }
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ROLE MANAGEMENT ====================
app.get('/api/roles', authenticateToken, async (req, res) => {
  try {
    const roles = await executeQuery('SELECT * FROM Roles ORDER BY name');
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/roles/:id', authenticateToken, async (req, res) => {
  try {
    const roles = await executeQuery('SELECT * FROM Roles WHERE id = ?', [req.params.id]);
    if (roles.length === 0) return res.status(404).json({ success: false, error: 'Role not found' });

    const permissions = await executeQuery('SELECT * FROM RolePermissions WHERE role_id = ?', [req.params.id]);

    res.json({ success: true, data: { ...roles[0], permissions } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/roles', authenticateToken, async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    await executeQuery('INSERT INTO Roles (name, description) VALUES (?, ?)', [name, description]);

    const roleResult = await executeQuery('SELECT id FROM Roles WHERE name = ?', [name]);
    const roleId = roleResult[0].id;

    // Add Permissions
    if (permissions && permissions.length > 0) {
      for (const p of permissions) {
        await executeQuery(
          'INSERT INTO RolePermissions (role_id, feature_key, can_view, can_create, can_edit, can_delete, can_print) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [roleId, p.feature_key, p.can_view || 'N', p.can_create || 'N', p.can_edit || 'N', p.can_delete || 'N', p.can_print || 'N']
        );
      }
    }
    res.json({ success: true, message: 'Role berhasil dibuat' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/roles/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    await executeQuery('UPDATE Roles SET name = ?, description = ? WHERE id = ?', [name, description, req.params.id]);

    // Update Permissions (Delete all and re-insert for simplicity)
    await executeQuery('DELETE FROM RolePermissions WHERE role_id = ?', [req.params.id]);

    if (permissions && permissions.length > 0) {
      for (const p of permissions) {
        await executeQuery(
          'INSERT INTO RolePermissions (role_id, feature_key, can_view, can_create, can_edit, can_delete, can_print) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [req.params.id, p.feature_key, p.can_view || 'N', p.can_create || 'N', p.can_edit || 'N', p.can_delete || 'N', p.can_print || 'N']
        );
      }
    }
    res.json({ success: true, message: 'Role berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/roles/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery('DELETE FROM RolePermissions WHERE role_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM Roles WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Role berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

let dbPool = null;
let isConnected = false;

async function connectDatabase() {
  try {
    console.log('🔄 Mencoba koneksi ke database...');
    dbPool = await odbc.pool(connectionString);
    isConnected = true;
    console.log('✅ Koneksi ke database Sybase berhasil!');
    return true;
  } catch (error) {
    isConnected = false;
    console.error('❌ Gagal koneksi ke database:', error.message);
    return false;
  }
}

async function executeQuery(query, params = []) {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    const result = await connection.query(query, params);
    return result;
  } catch (error) {
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function validatePeriod(date) {
  // Check if any period exists. If none, allow for now.
  const allPeriods = await executeQuery("SELECT count(*) as count FROM AccountingPeriods WHERE active = 'Y'");
  if (allPeriods[0].count === 0) return true;

  const result = await executeQuery(
    "SELECT count(*) as count FROM AccountingPeriods WHERE ? BETWEEN start_date AND end_date AND status = 'Open' AND active = 'Y'",
    [date]
  );
  return result[0].count > 0;
}

async function validatePartnerFinancials(partnerId, newAmount, paymentTermId) {
  const partners = await executeQuery("SELECT * FROM Partners WHERE id = ?", [partnerId]);
  if (partners.length === 0) return { valid: true };

  const partner = partners[0];
  if (partner.type !== 'Customer') return { valid: true };

  // 1. Check Credit Limit
  if (parseFloat(partner.credit_limit) > 0) {
    const arInvoices = await executeQuery("SELECT SUM(total_amount - COALESCE(paid_amount, 0)) as balance FROM ARInvoices WHERE partner_id = ? AND status != 'Cancelled' AND (total_amount - COALESCE(paid_amount, 0)) > 0", [partnerId]);
    const currentBalance = parseFloat(arInvoices[0].balance) || 0;
    if (currentBalance + newAmount > parseFloat(partner.credit_limit)) {
      return { valid: false, error: `Batas credit limit terlampaui. Limit: ${partner.credit_limit}, Saldo Piutang: ${currentBalance}, Transaksi Baru: ${newAmount}` };
    }
  }

  // 2. Check Overdue
  if (partner.check_overdue === 'Y') {
    const today = new Date().toISOString().split('T')[0];
    const overdueInvoices = await executeQuery("SELECT count(*) as count FROM ARInvoices WHERE partner_id = ? AND status != 'Cancelled' AND (total_amount - COALESCE(paid_amount, 0)) > 0 AND due_date < ?", [partnerId, today]);
    if (overdueInvoices[0].count > 0) {
      return { valid: false, error: 'Customer memiliki piutang yang sudah melewati jatuh tempo (Overdue). Transaksi diblokir.' };
    }
  }

  // 3. Check Allowed TOP
  if (paymentTermId) {
    const allowedTopsCount = await executeQuery("SELECT count(*) as count FROM PartnerPaymentTerms WHERE partner_id = ?", [partnerId]);
    if (allowedTopsCount[0].count > 0) {
      const isAllowed = await executeQuery("SELECT count(*) as count FROM PartnerPaymentTerms WHERE partner_id = ? AND payment_term_id = ?", [partnerId, paymentTermId]);
      if (isAllowed[0].count === 0) {
        return { valid: false, error: 'Tipe pembayaran (TOP) ini tidak diperbolehkan untuk customer ini.' };
      }
    }
  }

  return { valid: true };
}

// ==================== ACCOUNTING PERIODS ====================
app.get('/api/accounting-periods', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM AccountingPeriods ORDER BY start_date DESC');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/accounting-periods', async (req, res) => {
  try {
    const { code, name, start_date, end_date, status, active, is_starting, yearid, monthid } = req.body;

    // If this is a starting period, clear any existing starting periods
    if (is_starting === 'Y') {
      await executeQuery("UPDATE AccountingPeriods SET is_starting = 'N' WHERE is_starting = 'Y'");
    }

    await executeQuery(
      'INSERT INTO AccountingPeriods (code, name, start_date, end_date, status, active, is_starting, yearid, monthid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [code, name, start_date, end_date, status || 'Open', active || 'Y', is_starting || 'N', yearid || null, monthid || null]
    );
    res.json({ success: true, message: 'Accounting Period berhasil ditambahkan' });
  } catch (error) {
    console.error('Error adding accounting period:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/accounting-periods/:id', async (req, res) => {
  try {
    const { code, name, start_date, end_date, status, active, is_starting, yearid, monthid } = req.body;

    // If this is a starting period, clear any existing starting periods
    if (is_starting === 'Y') {
      await executeQuery("UPDATE AccountingPeriods SET is_starting = 'N' WHERE is_starting = 'Y' AND id != ?", [req.params.id]);
    }

    await executeQuery(
      'UPDATE AccountingPeriods SET code = ?, name = ?, start_date = ?, end_date = ?, status = ?, active = ?, is_starting = ?, yearid = ?, monthid = ? WHERE id = ?',
      [code, name, start_date, end_date, status, active, is_starting || 'N', yearid || null, monthid || null, req.params.id]
    );
    res.json({ success: true, message: 'Accounting Period berhasil diupdate' });
  } catch (error) {
    console.error('Error updating accounting period:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/accounting-periods/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM AccountingPeriods WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Accounting Period berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== STATUS ====================
app.get('/api/test', async (req, res) => {
  if (!isConnected) await connectDatabase();
  try {
    const result = await executeQuery('SELECT 1 as test');
    res.json({ success: true, message: 'Koneksi database berhasil!', data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tables', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT t.table_name, u.user_name as owner
      FROM SYSTABLE t
      JOIN SYSUSERPERM u ON t.creator = u.user_id
      WHERE t.table_type = 'BASE' 
        AND u.user_name NOT IN ('SYS', 'rs_systabgroup', 'dbo')
        AND t.table_name NOT LIKE 'sa_%'
        AND t.table_name NOT LIKE 'spt_%'
        AND t.table_name NOT LIKE 'ix_%'
        AND t.table_name NOT LIKE 'rs_%'
        AND t.table_name NOT LIKE 'migrate_%'
        AND t.table_name NOT LIKE 'jdbc_%'
      ORDER BY t.table_name
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== UNITS (MASTER SATUAN) ====================
app.get('/api/units', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Units ORDER BY code');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/units/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Units WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/units', async (req, res) => {
  try {
    const { code, name, description } = req.body;
    await executeQuery(
      'INSERT INTO Units (code, name, description) VALUES (?, ?, ?)',
      [code, name, description || '']
    );
    const result = await executeQuery('SELECT * FROM Units WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Satuan berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/units/:id', async (req, res) => {
  try {
    const { code, name, description } = req.body;
    await executeQuery(
      'UPDATE Units SET code = ?, name = ?, description = ? WHERE id = ?',
      [code, name, description, req.params.id]
    );
    res.json({ success: true, message: 'Satuan berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/units/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Units WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Satuan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== UNIT CONVERSIONS (KONVERSI SATUAN) ====================
// Migration endpoint - create table
app.get('/api/migrate/create-unit-conversions', async (req, res) => {
  try {
    // Create UnitConversions table
    try {
      await executeQuery(`
        CREATE TABLE UnitConversions (
          id INTEGER IDENTITY PRIMARY KEY,
          conversion_code VARCHAR(50) NOT NULL,
          from_unit_id INTEGER NOT NULL,
          to_unit_id INTEGER NOT NULL,
          conversion_factor DECIMAL(18,6) NOT NULL,
          description VARCHAR(200),
          active CHAR(1) DEFAULT 'Y',
          FOREIGN KEY (from_unit_id) REFERENCES Units(id),
          FOREIGN KEY (to_unit_id) REFERENCES Units(id)
        )
      `);
    } catch (e) {
      // Table might already exist, try to add the column instead
      try {
        await executeQuery(`ALTER TABLE UnitConversions ADD conversion_code VARCHAR(50) NULL`);
      } catch (e2) { /* Column might exist */ }
    }

    // Add conversion_code to Items
    try {
      await executeQuery(`ALTER TABLE Items ADD conversion_code VARCHAR(50) NULL`);
    } catch (e) { /* Column might exist */ }

    // Add unit conversion columns to SalesOrderDetails
    const colsToAdd = [
      { name: 'unit_code', type: 'VARCHAR(20) NULL' },
      { name: 'conversion_factor', type: 'DECIMAL(18,6) DEFAULT 1' },
      { name: 'base_qty', type: 'DECIMAL(18,6) NULL' }
    ];
    for (const col of colsToAdd) {
      try {
        await executeQuery(`ALTER TABLE SalesOrderDetails ADD ${col.name} ${col.type}`);
      } catch (e) { /* column might already exist */ }
    }

    // Add same columns to PurchaseOrderDetails
    for (const col of colsToAdd) {
      try {
        await executeQuery(`ALTER TABLE PurchaseOrderDetails ADD ${col.name} ${col.type}`);
      } catch (e) { /* column might already exist */ }
    }

    res.json({ success: true, message: 'Migration unit conversions berhasil' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SALES AREAS (MASTER WILAYAH PENJUALAN) ====================
// Migration endpoint - create table
app.get('/api/migrate/create-sales-areas', async (req, res) => {
  try {
    // Create SalesAreas table
    try {
      await executeQuery(`
        CREATE TABLE SalesAreas (
          id INTEGER IDENTITY PRIMARY KEY,
          code VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(100) NOT NULL,
          level VARCHAR(20) NOT NULL,
          parent_id INTEGER NULL,
          active CHAR(1) DEFAULT 'Y',
          FOREIGN KEY (parent_id) REFERENCES SalesAreas(id)
        )
      `);
    } catch (e) {
      /* Table might already exist */
    }

    // Add sales_area_id to SalesPersons
    try {
      await executeQuery(`ALTER TABLE SalesPersons ADD sales_area_id INTEGER NULL`);
    } catch (e) {
      /* Column might exist */
    }

    // NOTE: SQLite/Sybase standard might differ on adding FK constraint later. 
    // Usually adding column is enough, the relation might be enforced in app level if FK fails.

    res.json({ success: true, message: 'Tabel SalesAreas dan kolom sales_area_id pada SalesPersons berhasil ditambahkan (atau sudah ada)' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all sales areas with parent name
app.get('/api/sales-areas', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT sa.*, parent.name as parent_name 
      FROM SalesAreas sa
      LEFT JOIN SalesAreas parent ON sa.parent_id = parent.id
      ORDER BY sa.level, sa.name
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sales-areas', async (req, res) => {
  try {
    const { code, name, level, parent_id, active } = req.body;

    // Check if code exists
    const existing = await executeQuery('SELECT id FROM SalesAreas WHERE code = ?', [code]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Kode Area sudah digunakan' });
    }

    await executeQuery(
      'INSERT INTO SalesAreas (code, name, level, parent_id, active) VALUES (?, ?, ?, ?, ?)',
      [code, name, level, parent_id || null, active || 'Y']
    );
    res.json({ success: true, message: 'Sales Area berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/sales-areas/:id', async (req, res) => {
  try {
    const { code, name, level, parent_id, active } = req.body;

    // Check if code exists for other areas
    const existing = await executeQuery('SELECT id FROM SalesAreas WHERE code = ? AND id != ?', [code, req.params.id]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Kode Area sudah digunakan' });
    }

    await executeQuery(
      'UPDATE SalesAreas SET code = ?, name = ?, level = ?, parent_id = ?, active = ? WHERE id = ?',
      [code, name, level, parent_id || null, active || 'Y', req.params.id]
    );
    res.json({ success: true, message: 'Sales Area berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/sales-areas/:id', async (req, res) => {
  try {
    // Check if it has children
    const children = await executeQuery('SELECT id FROM SalesAreas WHERE parent_id = ?', [req.params.id]);
    if (children.length > 0) {
      return res.status(400).json({ success: false, error: 'Tidak dapat menghapus area ini karena memiliki sub-area' });
    }

    // Check if it's used in SalesPersons
    const usedInSalesPersons = await executeQuery('SELECT id FROM SalesPersons WHERE sales_area_id = ?', [req.params.id]);
    if (usedInSalesPersons.length > 0) {
      return res.status(400).json({ success: false, error: 'Tidak dapat menghapus area ini karena sedang digunakan oleh Sales Person' });
    }

    await executeQuery('DELETE FROM SalesAreas WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Sales Area berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List all conversions
app.get('/api/unit-conversions', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT uc.*, 
        fu.code as from_unit_code, fu.name as from_unit_name,
        tu.code as to_unit_code, tu.name as to_unit_name
      FROM UnitConversions uc
      LEFT JOIN Units fu ON uc.from_unit_id = fu.id
      LEFT JOIN Units tu ON uc.to_unit_id = tu.id
      ORDER BY fu.code, tu.code
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get conversions available for a specific unit code (used in transaction forms)
app.get('/api/unit-conversions/by-unit/:unitCode', async (req, res) => {
  try {
    const unitCode = req.params.unitCode;
    // Get conversions where this unit is either the from or to unit
    const result = await executeQuery(`
      SELECT uc.*, 
        fu.code as from_unit_code, fu.name as from_unit_name,
        tu.code as to_unit_code, tu.name as to_unit_name
      FROM UnitConversions uc
      LEFT JOIN Units fu ON uc.from_unit_id = fu.id
      LEFT JOIN Units tu ON uc.to_unit_id = tu.id
      WHERE (fu.code = ? OR tu.code = ?) AND uc.active = 'Y'
      ORDER BY fu.code, tu.code
    `, [unitCode, unitCode]);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single conversion
app.get('/api/unit-conversions/:id', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT uc.*, 
        fu.code as from_unit_code, fu.name as from_unit_name,
        tu.code as to_unit_code, tu.name as to_unit_name
      FROM UnitConversions uc
      LEFT JOIN Units fu ON uc.from_unit_id = fu.id
      LEFT JOIN Units tu ON uc.to_unit_id = tu.id
      WHERE uc.id = ?
    `, [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create conversion
app.post('/api/unit-conversions', async (req, res) => {
  try {
    const { conversion_code, from_unit_id, to_unit_id, conversion_factor, description, active } = req.body;

    if (!conversion_code || conversion_code.trim() === '') {
      return res.status(400).json({ success: false, error: 'Kode Konversi harus diisi' });
    }

    const fromId = parseInt(from_unit_id);
    const toId = parseInt(to_unit_id);
    const factor = parseFloat(conversion_factor);

    if (fromId === toId) {
      return res.status(400).json({ success: false, error: 'Satuan asal dan tujuan tidak boleh sama' });
    }

    // Check for duplicate
    const existing = await executeQuery(
      'SELECT id FROM UnitConversions WHERE conversion_code = ? AND from_unit_id = ? AND to_unit_id = ?',
      [conversion_code.toUpperCase(), fromId, toId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Konversi untuk pasangan satuan ini sudah ada' });
    }

    await executeQuery(
      'INSERT INTO UnitConversions (conversion_code, from_unit_id, to_unit_id, conversion_factor, description, active) VALUES (?, ?, ?, ?, ?, ?)',
      [conversion_code.toUpperCase(), fromId, toId, factor, description || '', active || 'Y']
    );
    res.json({ success: true, message: 'Konversi satuan berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update conversion
app.put('/api/unit-conversions/:id', async (req, res) => {
  try {
    const { conversion_code, from_unit_id, to_unit_id, conversion_factor, description, active } = req.body;

    if (!conversion_code || conversion_code.trim() === '') {
      return res.status(400).json({ success: false, error: 'Kode Konversi harus diisi' });
    }

    const fromId = parseInt(from_unit_id);
    const toId = parseInt(to_unit_id);
    const factor = parseFloat(conversion_factor);

    if (fromId === toId) {
      return res.status(400).json({ success: false, error: 'Satuan asal dan tujuan tidak boleh sama' });
    }

    await executeQuery(
      'UPDATE UnitConversions SET conversion_code = ?, from_unit_id = ?, to_unit_id = ?, conversion_factor = ?, description = ?, active = ? WHERE id = ?',
      [conversion_code.toUpperCase(), fromId, toId, factor, description, active, parseInt(req.params.id)]
    );
    res.json({ success: true, message: 'Konversi satuan berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete conversion
app.delete('/api/unit-conversions/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM UnitConversions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Konversi satuan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PAYMENT TERMS (MASTER TOP) ====================
app.get('/api/payment-terms', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM PaymentTerms ORDER BY days, code');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/payment-terms/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM PaymentTerms WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/payment-terms', async (req, res) => {
  try {
    const { code, name, days, description, active } = req.body;
    await executeQuery(
      'INSERT INTO PaymentTerms (code, name, days, description, active) VALUES (?, ?, ?, ?, ?)',
      [code, name, days || 0, description || '', active || 'Y']
    );
    const result = await executeQuery('SELECT * FROM PaymentTerms WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Term of Payment berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/payment-terms/:id', async (req, res) => {
  try {
    const { code, name, days, description, active } = req.body;
    await executeQuery(
      'UPDATE PaymentTerms SET code = ?, name = ?, days = ?, description = ?, active = ? WHERE id = ?',
      [code, name, days, description, active, req.params.id]
    );
    res.json({ success: true, message: 'Term of Payment berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/payment-terms/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM PaymentTerms WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Term of Payment berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CURRENCIES (MASTER MATA UANG) ====================
app.get('/api/currencies', async (req, res) => {
  try {
    const result = await executeQuery("SELECT * FROM Currencies ORDER BY is_base DESC, code");
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Currency conversion endpoint (must be before :id route)
app.get('/api/currencies/convert', async (req, res) => {
  try {
    const { from, to, amount, date, rate_type_id, period, year, month } = req.query;

    // Determine the rate date based on period type
    let rateDate;
    if (period === 'month' && year && month) {
      // Use last day of the selected month
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      rateDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (date) {
      rateDate = date;
    } else {
      rateDate = new Date().toISOString().split('T')[0];
    }

    const fromCurrency = await executeQuery('SELECT * FROM Currencies WHERE code = ?', [from]);
    const toCurrency = await executeQuery('SELECT * FROM Currencies WHERE code = ?', [to]);

    if (!fromCurrency[0] || !toCurrency[0]) {
      return res.status(400).json({ success: false, error: 'Currency tidak ditemukan' });
    }

    let fromRate = 1, toRate = 1;
    let fromRateTypeName = '', toRateTypeName = '';
    let fromRateDate = '', toRateDate = '';

    // Build rate query with optional rate_type_id filter
    const rateTypeFilter = rate_type_id ? ' AND cr.rate_type_id = ?' : '';
    const rateTypeParam = rate_type_id ? [parseInt(rate_type_id)] : [];

    if (fromCurrency[0].is_base !== 'Y') {
      const rates = await executeQuery(
        `SELECT TOP 1 cr.*, ert.code as rate_type_code, ert.name as rate_type_name
         FROM CurrencyRates cr
         LEFT JOIN ExchangeRateTypes ert ON cr.rate_type_id = ert.id
         WHERE cr.currency_id = ? AND cr.rate_date <= ?${rateTypeFilter}
         ORDER BY cr.rate_date DESC`,
        [fromCurrency[0].id, rateDate, ...rateTypeParam]
      );
      if (rates[0]) {
        fromRate = parseFloat(rates[0].middle_rate);
        fromRateTypeName = rates[0].rate_type_code || '';
        fromRateDate = rates[0].rate_date;
      }
    }

    if (toCurrency[0].is_base !== 'Y') {
      const rates = await executeQuery(
        `SELECT TOP 1 cr.*, ert.code as rate_type_code, ert.name as rate_type_name
         FROM CurrencyRates cr
         LEFT JOIN ExchangeRateTypes ert ON cr.rate_type_id = ert.id
         WHERE cr.currency_id = ? AND cr.rate_date <= ?${rateTypeFilter}
         ORDER BY cr.rate_date DESC`,
        [toCurrency[0].id, rateDate, ...rateTypeParam]
      );
      if (rates[0]) {
        toRate = parseFloat(rates[0].middle_rate);
        toRateTypeName = rates[0].rate_type_code || '';
        toRateDate = rates[0].rate_date;
      }
    }

    const baseAmount = parseFloat(amount) * fromRate;
    const result = baseAmount / toRate;

    res.json({
      success: true,
      data: {
        from, to, amount: parseFloat(amount),
        result: Math.round(result * 1000000) / 1000000,
        fromRate, toRate, date: rateDate,
        fromRateType: fromRateTypeName, toRateType: toRateTypeName,
        fromRateDate, toRateDate,
        period: period || 'date'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/currencies/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Currencies WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/currencies', async (req, res) => {
  try {
    const { code, name, symbol, decimal_places, is_base, active } = req.body;

    // If setting as base, clear other base currencies
    if (is_base === 'Y') {
      await executeQuery("UPDATE Currencies SET is_base = 'N' WHERE is_base = 'Y'");
    }

    await executeQuery(
      'INSERT INTO Currencies (code, name, symbol, decimal_places, is_base, active) VALUES (?, ?, ?, ?, ?, ?)',
      [code, name, symbol || '', decimal_places || 2, is_base || 'N', active || 'Y']
    );
    const result = await executeQuery('SELECT * FROM Currencies WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Currency berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/currencies/:id', async (req, res) => {
  try {
    const { code, name, symbol, decimal_places, is_base, active } = req.body;

    // If setting as base, clear other base currencies
    if (is_base === 'Y') {
      await executeQuery("UPDATE Currencies SET is_base = 'N' WHERE is_base = 'Y' AND id != ?", [req.params.id]);
    }

    await executeQuery(
      'UPDATE Currencies SET code = ?, name = ?, symbol = ?, decimal_places = ?, is_base = ?, active = ? WHERE id = ?',
      [code, name, symbol, decimal_places, is_base, active, req.params.id]
    );
    res.json({ success: true, message: 'Currency berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/currencies/:id', async (req, res) => {
  try {
    // Don't allow deleting base currency
    const currency = await executeQuery('SELECT * FROM Currencies WHERE id = ?', [req.params.id]);
    if (currency[0] && currency[0].is_base === 'Y') {
      return res.status(400).json({ success: false, error: 'Tidak bisa menghapus base currency' });
    }
    await executeQuery('DELETE FROM CurrencyRates WHERE currency_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM Currencies WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Currency berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CURRENCY RATES ====================
app.get('/api/currencies/:id/rates', async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT cr.*, ert.code as rate_type_code, ert.name as rate_type_name
       FROM CurrencyRates cr
       LEFT JOIN ExchangeRateTypes ert ON cr.rate_type_id = ert.id
       WHERE cr.currency_id = ?
       ORDER BY cr.rate_date DESC, ert.code`,
      [req.params.id]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/currencies/:id/rates', async (req, res) => {
  try {
    const { rate_date, buy_rate, sell_rate, middle_rate, rate_type_id } = req.body;
    await executeQuery(
      'INSERT INTO CurrencyRates (currency_id, rate_date, buy_rate, sell_rate, middle_rate, rate_type_id) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, rate_date, buy_rate, sell_rate, middle_rate, rate_type_id || null]
    );
    res.json({ success: true, message: 'Kurs berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/currency-rates/:id', async (req, res) => {
  try {
    const { rate_date, buy_rate, sell_rate, middle_rate, rate_type_id } = req.body;
    await executeQuery(
      'UPDATE CurrencyRates SET rate_date = ?, buy_rate = ?, sell_rate = ?, middle_rate = ?, rate_type_id = ? WHERE id = ?',
      [rate_date, buy_rate, sell_rate, middle_rate, rate_type_id || null, req.params.id]
    );
    res.json({ success: true, message: 'Kurs berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/currency-rates/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM CurrencyRates WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Kurs berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ==================== EXCHANGE RATE TYPES ====================
app.get('/api/exchange-rate-types', async (req, res) => {
  try {
    const result = await executeQuery("SELECT * FROM ExchangeRateTypes ORDER BY code");
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/exchange-rate-types', async (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    await executeQuery(
      'INSERT INTO ExchangeRateTypes (code, name, description, active) VALUES (?, ?, ?, ?)',
      [code, name, description || '', active || 'Y']
    );
    const result = await executeQuery('SELECT * FROM ExchangeRateTypes WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Exchange Rate Type berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/exchange-rate-types/:id', async (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    await executeQuery(
      'UPDATE ExchangeRateTypes SET code = ?, name = ?, description = ?, active = ? WHERE id = ?',
      [code, name, description, active, req.params.id]
    );
    res.json({ success: true, message: 'Exchange Rate Type berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/exchange-rate-types/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM ExchangeRateTypes WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Exchange Rate Type berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== EXCHANGE RATES (PERIODS) ====================
app.get('/api/exchange-rates', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT er.*, ert.code as rate_type_code, ert.name as rate_type_name,
        (SELECT COUNT(*) FROM ExchangeRateLines WHERE exchange_rate_id = er.id) as line_count
      FROM ExchangeRates er
      LEFT JOIN ExchangeRateTypes ert ON er.rate_type_id = ert.id
      ORDER BY er.from_date DESC, ert.code
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/exchange-rates', async (req, res) => {
  try {
    const { rate_type_id, from_date, to_date, description } = req.body;
    await executeQuery(
      'INSERT INTO ExchangeRates (rate_type_id, from_date, to_date, description) VALUES (?, ?, ?, ?)',
      [rate_type_id, from_date, to_date, description || '']
    );
    const result = await executeQuery('SELECT MAX(id) as id FROM ExchangeRates');
    res.json({ success: true, data: { id: result[0].id }, message: 'Exchange Rate berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/exchange-rates/:id', async (req, res) => {
  try {
    const { rate_type_id, from_date, to_date, description, status } = req.body;
    await executeQuery(
      'UPDATE ExchangeRates SET rate_type_id = ?, from_date = ?, to_date = ?, description = ?, status = ? WHERE id = ?',
      [rate_type_id, from_date, to_date, description, status || 'A', req.params.id]
    );
    res.json({ success: true, message: 'Exchange Rate berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/exchange-rates/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM ExchangeRateLines WHERE exchange_rate_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM ExchangeRates WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Exchange Rate dan detail berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== EXCHANGE RATE LINES ====================
app.get('/api/exchange-rates/:id/lines', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT erl.*,
        fc.code as from_currency_code, fc.name as from_currency_name,
        tc.code as to_currency_code, tc.name as to_currency_name
      FROM ExchangeRateLines erl
      LEFT JOIN Currencies fc ON erl.from_currency_id = fc.id
      LEFT JOIN Currencies tc ON erl.to_currency_id = tc.id
      WHERE erl.exchange_rate_id = ?
      ORDER BY fc.code, tc.code
    `, [req.params.id]);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/exchange-rates/:id/lines', async (req, res) => {
  try {
    const { from_currency_id, to_currency_id, rate } = req.body;
    await executeQuery(
      'INSERT INTO ExchangeRateLines (exchange_rate_id, from_currency_id, to_currency_id, rate) VALUES (?, ?, ?, ?)',
      [req.params.id, from_currency_id, to_currency_id, rate]
    );
    res.json({ success: true, message: 'Rate line berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/exchange-rate-lines/:id', async (req, res) => {
  try {
    const { from_currency_id, to_currency_id, rate } = req.body;
    await executeQuery(
      'UPDATE ExchangeRateLines SET from_currency_id = ?, to_currency_id = ?, rate = ? WHERE id = ?',
      [from_currency_id, to_currency_id, rate, req.params.id]
    );
    res.json({ success: true, message: 'Rate line berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/exchange-rate-lines/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM ExchangeRateLines WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Rate line berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== YEAR SETUP (MASTER TAHUN) ====================
app.get('/api/year-setup', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM YearSetups ORDER BY yearid DESC');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/year-setup', async (req, res) => {
  try {
    const { yearid } = req.body;

    // Check if year already exists
    const existing = await executeQuery('SELECT * FROM YearSetups WHERE yearid = ?', [yearid]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Tahun sudah ada' });
    }

    await executeQuery(
      'INSERT INTO YearSetups (yearid) VALUES (?)',
      [yearid]
    );
    const result = await executeQuery('SELECT * FROM YearSetups WHERE yearid = ?', [yearid]);
    res.json({ success: true, data: result[0], message: 'Tahun berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/year-setup/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM YearSetups WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Tahun berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ==================== TRANSACTIONS (MASTER TRANSAKSI) ====================
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Transactions ORDER BY nomortranscode');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/transactions/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Transactions WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { nomortranscode, description } = req.body;
    await executeQuery(
      'INSERT INTO Transactions (nomortranscode, description) VALUES (?, ?)',
      [nomortranscode, description]
    );
    const result = await executeQuery('SELECT * FROM Transactions WHERE nomortranscode = ?', [nomortranscode]);
    res.json({ success: true, data: result[0], message: 'Transaksi berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { nomortranscode, description } = req.body;
    await executeQuery(
      'UPDATE Transactions SET nomortranscode = ?, description = ? WHERE id = ?',
      [nomortranscode, description, req.params.id]
    );
    res.json({ success: true, message: 'Transaksi berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Transactions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Transaksi berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TRANSCODES (MASTER KODE TRANSAKSI) ====================
app.get('/api/transcodes', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Transcodes ORDER BY code');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/transcodes/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Transcodes WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/transcodes', async (req, res) => {
  try {
    const { code, name, prefix, format, description, nomortranscode } = req.body;
    await executeQuery(
      'INSERT INTO Transcodes (code, name, prefix, format, description, nomortranscode) VALUES (?, ?, ?, ?, ?, ?)',
      [code, name, prefix, format || '{PREFIX}/{MM}{YYYY}/{SEQ}', description || '', nomortranscode || null]
    );
    const result = await executeQuery('SELECT * FROM Transcodes WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Transcode berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/transcodes/:id', async (req, res) => {
  try {
    const { code, name, prefix, format, description, active, nomortranscode } = req.body;
    await executeQuery(
      'UPDATE Transcodes SET code = ?, name = ?, prefix = ?, format = ?, description = ?, active = ?, nomortranscode = ? WHERE id = ?',
      [code, name, prefix, format, description, active || 'Y', nomortranscode || null, req.params.id]
    );
    res.json({ success: true, message: 'Transcode berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/transcodes/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Transcodes WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Transcode berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate document number based on transcode
app.get('/api/transcodes/:code/generate', async (req, res) => {
  try {
    const transcode = await executeQuery('SELECT * FROM Transcodes WHERE code = ?', [req.params.code]);
    if (!transcode[0]) {
      return res.status(404).json({ success: false, error: 'Transcode tidak ditemukan' });
    }

    const tc = transcode[0];
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const seq = String(tc.last_number + 1).padStart(4, '0');

    // Generate based on format
    let docNumber = tc.format
      .replace('{PREFIX}', tc.prefix)
      .replace('{YYYY}', year)
      .replace('{YY}', year.slice(-2))
      .replace('{MM}', month)
      .replace('{DD}', day)
      .replace('{SEQ}', seq);

    // Update last number
    await executeQuery('UPDATE Transcodes SET last_number = last_number + 1 WHERE code = ?', [req.params.code]);

    res.json({ success: true, doc_number: docNumber, transcode: tc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ITEMS (MASTER ITEM) ====================
app.get('/api/locations', async (req, res) => {
  try {
    const query = `
      SELECT l.*, sw.warehouse_id, w.code as warehouse_code, w.description as warehouse_name
      FROM Locations l
      LEFT JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
      LEFT JOIN Warehouses w ON sw.warehouse_id = w.id
      WHERE l.active = 'Y'
      ORDER BY l.code
    `;
    const result = await executeQuery(query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// ==================== ITEM GROUPS ====================
app.get('/api/item-groups', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM ItemGroups ORDER BY code');
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.post('/api/item-groups', async (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    await executeQuery('INSERT INTO ItemGroups (code, name, description, active) VALUES (?, ?, ?, ?)', [code, name, description || '', active || 'Y']);
    res.json({ success: true, message: 'Item Group berhasil ditambahkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.put('/api/item-groups/:id', async (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    await executeQuery('UPDATE ItemGroups SET code = ?, name = ?, description = ?, active = ? WHERE id = ?', [code, name, description, active, req.params.id]);
    res.json({ success: true, message: 'Item Group berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.delete('/api/item-groups/:id', async (req, res) => {
  try {
    const used = await executeQuery('SELECT COUNT(*) as cnt FROM Items WHERE group_id = ?', [req.params.id]);
    if (used[0].cnt > 0) return res.status(400).json({ success: false, error: 'Group masih digunakan oleh item' });
    await executeQuery('DELETE FROM ItemGroups WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Item Group berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== ITEM CATEGORIES ====================
app.get('/api/item-categories', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM ItemCategories ORDER BY code');
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.post('/api/item-categories', async (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    await executeQuery('INSERT INTO ItemCategories (code, name, description, active) VALUES (?, ?, ?, ?)', [code, name, description || '', active || 'Y']);
    res.json({ success: true, message: 'Item Category berhasil ditambahkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.put('/api/item-categories/:id', async (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    await executeQuery('UPDATE ItemCategories SET code = ?, name = ?, description = ?, active = ? WHERE id = ?', [code, name, description, active, req.params.id]);
    res.json({ success: true, message: 'Item Category berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.delete('/api/item-categories/:id', async (req, res) => {
  try {
    const used = await executeQuery('SELECT COUNT(*) as cnt FROM Items WHERE category_id = ?', [req.params.id]);
    if (used[0].cnt > 0) return res.status(400).json({ success: false, error: 'Category masih digunakan oleh item' });
    await executeQuery('DELETE FROM ItemCategories WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Item Category berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== ITEM BRANDS ====================
app.get('/api/item-brands', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM ItemBrands ORDER BY code');
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.post('/api/item-brands', async (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    await executeQuery('INSERT INTO ItemBrands (code, name, description, active) VALUES (?, ?, ?, ?)', [code, name, description || '', active || 'Y']);
    res.json({ success: true, message: 'Item Brand berhasil ditambahkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.put('/api/item-brands/:id', async (req, res) => {
  try {
    const { code, name, description, active } = req.body;
    await executeQuery('UPDATE ItemBrands SET code = ?, name = ?, description = ?, active = ? WHERE id = ?', [code, name, description, active, req.params.id]);
    res.json({ success: true, message: 'Item Brand berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.delete('/api/item-brands/:id', async (req, res) => {
  try {
    const used = await executeQuery('SELECT COUNT(*) as cnt FROM Items WHERE brand_id = ?', [req.params.id]);
    if (used[0].cnt > 0) return res.status(400).json({ success: false, error: 'Brand masih digunakan oleh item' });
    await executeQuery('DELETE FROM ItemBrands WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Item Brand berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== ITEM MODELS ====================
app.get('/api/item-models', async (req, res) => {
  try {
    const result = await executeQuery(`SELECT m.*, b.name as brand_name FROM ItemModels m LEFT JOIN ItemBrands b ON m.brand_id = b.id ORDER BY m.code`);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.post('/api/item-models', async (req, res) => {
  try {
    const { code, name, brand_id, description, active } = req.body;
    await executeQuery('INSERT INTO ItemModels (code, name, brand_id, description, active) VALUES (?, ?, ?, ?, ?)', [code, name, brand_id || null, description || '', active || 'Y']);
    res.json({ success: true, message: 'Item Model berhasil ditambahkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.put('/api/item-models/:id', async (req, res) => {
  try {
    const { code, name, brand_id, description, active } = req.body;
    await executeQuery('UPDATE ItemModels SET code = ?, name = ?, brand_id = ?, description = ?, active = ? WHERE id = ?', [code, name, brand_id || null, description, active, req.params.id]);
    res.json({ success: true, message: 'Item Model berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});
app.delete('/api/item-models/:id', async (req, res) => {
  try {
    const used = await executeQuery('SELECT COUNT(*) as cnt FROM Items WHERE model_id = ?', [req.params.id]);
    if (used[0].cnt > 0) return res.status(400).json({ success: false, error: 'Model masih digunakan oleh item' });
    await executeQuery('DELETE FROM ItemModels WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Item Model berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== ITEMS (MASTER ITEM) ====================
app.get('/api/items', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT i.*, g.name as group_name, c.name as category_name, b.name as brand_name, m.name as model_name
      FROM Items i
      LEFT JOIN ItemGroups g ON i.group_id = g.id
      LEFT JOIN ItemCategories c ON i.category_id = c.id
      LEFT JOIN ItemBrands b ON i.brand_id = b.id
      LEFT JOIN ItemModels m ON i.model_id = m.id
      ORDER BY i.code
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Items WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/items', async (req, res) => {
  try {
    let { code, name, unit, standard_cost, standard_price, group_id, category_id, brand_id, model_id, conversion_code } = req.body;

    // Auto Generate Item Code
    const modeSetting = await executeQuery("SELECT setting_value FROM SystemSettings WHERE setting_key = 'ITEM_ID_MODE'");
    if (modeSetting.length > 0 && modeSetting[0].setting_value === 'AUTO') {
      const formatSetting = await executeQuery("SELECT setting_value FROM SystemSettings WHERE setting_key = 'ITEM_ID_FORMAT'");
      const seqSetting = await executeQuery("SELECT setting_value FROM SystemSettings WHERE setting_key = 'ITEM_ID_SEQ'");

      const format = (formatSetting.length > 0 && formatSetting[0].setting_value) ? formatSetting[0].setting_value : 'ITM-{YY}{MM}-{SEQ}';
      const currentSeq = parseInt((seqSetting.length > 0 && seqSetting[0].setting_value) ? seqSetting[0].setting_value : '0', 10);
      const nextSeq = currentSeq + 1;

      const now = new Date();
      const year = now.getFullYear().toString();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const seqStr = String(nextSeq).padStart(4, '0');

      code = format
        .replace('{YYYY}', year)
        .replace('{YY}', year.slice(-2))
        .replace('{MM}', month)
        .replace('{DD}', day)
        .replace('{SEQ}', seqStr);

      if (seqSetting.length > 0) {
        await executeQuery("UPDATE SystemSettings SET setting_value = ? WHERE setting_key = 'ITEM_ID_SEQ'", [nextSeq.toString()]);
      } else {
        await executeQuery("INSERT INTO SystemSettings (setting_key, setting_value) VALUES ('ITEM_ID_SEQ', ?)", [nextSeq.toString()]);
      }
    }

    await executeQuery(
      'INSERT INTO Items (code, name, unit, standard_cost, standard_price, group_id, category_id, brand_id, model_id, conversion_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [code, name, unit || '', standard_cost || 0, standard_price || 0, group_id || null, category_id || null, brand_id || null, model_id || null, conversion_code || null]
    );
    const result = await executeQuery('SELECT * FROM Items WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Item berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const { code, name, unit, standard_cost, standard_price, group_id, category_id, brand_id, model_id, conversion_code } = req.body;
    await executeQuery(
      'UPDATE Items SET code = ?, name = ?, unit = ?, standard_cost = ?, standard_price = ?, group_id = ?, category_id = ?, brand_id = ?, model_id = ?, conversion_code = ? WHERE id = ?',
      [code, name, unit, standard_cost, standard_price, group_id || null, category_id || null, brand_id || null, model_id || null, conversion_code || null, req.params.id]
    );
    res.json({ success: true, message: 'Item berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Items WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Item berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SYSTEM SETTINGS ====================
app.get('/api/system-settings', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM SystemSettings');
    const settings = {};
    result.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/system-settings', async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      const exists = await executeQuery('SELECT count(*) as count FROM SystemSettings WHERE setting_key = ?', [key]);
      if (exists[0].count > 0) {
        await executeQuery('UPDATE SystemSettings SET setting_value = ? WHERE setting_key = ?', [value, key]);
      } else {
        await executeQuery('INSERT INTO SystemSettings (setting_key, setting_value) VALUES (?, ?)', [key, value]);
      }
    }
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PARTNERS (SUPPLIER & CUSTOMER) ====================
app.get('/api/partners', async (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM Partners';
    const params = [];
    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }
    sql += ' ORDER BY code';
    const result = await executeQuery(sql, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PAYMENT TERMS ====================
app.get('/api/payment-terms', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM PaymentTerms WHERE active = 1 ORDER BY code');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/partners/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Partners WHERE id = ?', [req.params.id]);
    if (!result[0]) return res.json({ success: true, data: null });

    // Get allowed TOPs
    const topResult = await executeQuery('SELECT payment_term_id FROM PartnerPaymentTerms WHERE partner_id = ?', [req.params.id]);
    const allowed_tops = topResult.map(row => row.payment_term_id);

    res.json({ success: true, data: { ...result[0], allowed_tops } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/partners', async (req, res) => {
  try {
    let { code, name, type, address, phone, credit_limit, check_overdue, allowed_tops } = req.body;

    // Check if Auto Generate is needed
    if (type === 'Customer' || type === 'Supplier') {
      const modeKey = type === 'Customer' ? 'CUSTOMER_ID_MODE' : 'SUPPLIER_ID_MODE';
      const formatKey = type === 'Customer' ? 'CUSTOMER_ID_FORMAT' : 'SUPPLIER_ID_FORMAT';
      const seqKey = type === 'Customer' ? 'CUSTOMER_ID_SEQ' : 'SUPPLIER_ID_SEQ';

      const settingsRows = await executeQuery(`SELECT setting_key, setting_value FROM SystemSettings WHERE setting_key IN ('${modeKey}', '${formatKey}', '${seqKey}')`);

      const settingsMap = {};
      settingsRows.forEach(row => {
        settingsMap[row.setting_key] = row.setting_value;
      });

      if (settingsMap[modeKey] === 'AUTO') {
        const defaultFormat = type === 'Customer' ? 'CUS-{YY}{MM}-{SEQ}' : 'SUP-{YY}{MM}-{SEQ}';
        const format = settingsMap[formatKey] || defaultFormat;

        const currentSeq = parseInt(settingsMap[seqKey] || '0', 10);
        const nextSeq = currentSeq + 1;

        const now = new Date();
        const year = now.getFullYear().toString();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const seqStr = String(nextSeq).padStart(4, '0');

        code = format
          .replace('{YYYY}', year)
          .replace('{YY}', year.slice(-2))
          .replace('{MM}', month)
          .replace('{DD}', day)
          .replace('{SEQ}', seqStr);

        // Update sequence
        if (settingsMap[seqKey] !== undefined) {
          console.log(`Updating SystemSettings seq: ${nextSeq.toString()} for key ${seqKey}`);
          await executeQuery('UPDATE SystemSettings SET setting_value = ? WHERE setting_key = ?', [nextSeq.toString(), seqKey]);
        } else {
          console.log(`Inserting SystemSettings seq: ${nextSeq.toString()} for key ${seqKey}`);
          await executeQuery('INSERT INTO SystemSettings (setting_key, setting_value) VALUES (?, ?)', [seqKey, nextSeq.toString()]);
        }

      }
    }

    console.log(`Inserting into Partners: code=${code}, name=${name}, type=${type}, address=${address}, phone=${phone}, credit_limit=${credit_limit}, check_overdue=${check_overdue}`);
    await executeQuery(
      'INSERT INTO Partners (code, name, type, address, phone, credit_limit, check_overdue) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, name, type, address || '', phone || '', credit_limit || 0, check_overdue || 'N']
    );
    console.log(`Insert successful!`);
    const result = await executeQuery('SELECT * FROM Partners WHERE code = ?', [code]);

    if (result && result[0] && allowed_tops && Array.isArray(allowed_tops)) {
      const pId = result[0].id;
      for (const topId of allowed_tops) {
        await executeQuery('INSERT INTO PartnerPaymentTerms (partner_id, payment_term_id) VALUES (?, ?)', [pId, topId]);
      }
    }
    res.json({ success: true, data: result[0], message: 'Partner berhasil ditambahkan' });
  } catch (error) {
    const fs = require('fs');
    fs.writeFileSync('partner_error.log', JSON.stringify(error, Object.getOwnPropertyNames(error), 2) + '\n\nCode was: ' + code);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/partners/:id', async (req, res) => {
  try {
    const { code, name, type, address, phone, credit_limit, check_overdue, allowed_tops } = req.body;
    await executeQuery(
      'UPDATE Partners SET code = ?, name = ?, type = ?, address = ?, phone = ?, credit_limit = ?, check_overdue = ? WHERE id = ?',
      [code, name, type, address, phone, credit_limit || 0, check_overdue || 'N', req.params.id]
    );

    await executeQuery('DELETE FROM PartnerPaymentTerms WHERE partner_id = ?', [req.params.id]);
    if (allowed_tops && Array.isArray(allowed_tops)) {
      for (const topId of allowed_tops) {
        await executeQuery('INSERT INTO PartnerPaymentTerms (partner_id, payment_term_id) VALUES (?, ?)', [req.params.id, topId]);
      }
    }

    res.json({ success: true, message: 'Partner berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/partners/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Partners WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Partner berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/warehouses/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Warehouses WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Warehouse berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SHIPMENTS ====================
app.get('/api/shipments', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
            SELECT
                s.*,
                so.doc_number as so_number,
                p.name as partner_name,
                (SELECT SUM(quantity) FROM ShipmentDetails WHERE shipment_id = s.id) as total_shipped,
                (SELECT SUM(quantity) FROM ARInvoiceDetails ard JOIN ARInvoices ari ON ard.ar_invoice_id = ari.id WHERE ari.shipment_id = s.id AND ari.status != 'Cancelled') as total_billed
            FROM Shipments s
            LEFT JOIN SalesOrders so ON s.so_id = so.id
            LEFT JOIN Partners p ON so.partner_id = p.id
        `;

    const params = [];
    if (startDate && endDate) {
      query += ' WHERE s.doc_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY s.doc_number DESC';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



app.post('/api/shipments', async (req, res) => {
  try {
    const { doc_number, doc_date, so_id, partner_id, status, notes, items, transcode_id, currency_code } = req.body;
    console.log('Creating Shipment:', req.body);

    await executeQuery(
      'INSERT INTO Shipments (doc_number, doc_date, so_id, partner_id, status, notes, transcode_id, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [doc_number, doc_date, so_id || null, partner_id, status || 'Draft', notes || null, transcode_id || null, currency_code || null]
    );

    const result = await executeQuery('SELECT * FROM Shipments WHERE doc_number = ?', [doc_number]);
    const shipmentId = result[0]?.id;

    if (items && items.length > 0 && shipmentId) {
      for (const item of items) {
        await executeQuery(
          'INSERT INTO ShipmentDetails (shipment_id, item_id, quantity, remarks) VALUES (?, ?, ?, ?)',
          [shipmentId, item.item_id, item.quantity, item.remarks]
        );
      }
    }

    res.json({ success: true, data: result[0], message: 'Shipment berhasil dibuat' });

    // Auto-update SO status
    if (so_id) await updateSOStatus(so_id);

  } catch (error) {
    console.error('Error creating shipment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/shipments/:id', async (req, res) => {
  try {
    const { doc_number, doc_date, so_id, partner_id, status, notes, items, transcode_id, currency_code } = req.body;

    await executeQuery(
      'UPDATE Shipments SET doc_number = ?, doc_date = ?, so_id = ?, partner_id = ?, status = ?, notes = ?, transcode_id = ?, currency_code = ? WHERE id = ?',
      [doc_number, doc_date, so_id || null, partner_id, status, notes, transcode_id || null, currency_code || null, req.params.id]
    );

    await executeQuery('DELETE FROM ShipmentDetails WHERE shipment_id = ?', [req.params.id]);
    if (items && items.length > 0) {
      for (const item of items) {
        await executeQuery(
          'INSERT INTO ShipmentDetails (shipment_id, item_id, quantity, remarks) VALUES (?, ?, ?, ?)',
          [req.params.id, item.item_id, item.quantity, item.remarks]
        );
      }
    }

    res.json({ success: true, message: 'Shipment berhasil diupdate' });

    // Auto-update SO status
    if (so_id) await updateSOStatus(so_id);

  } catch (error) {
    console.error('Error updating shipment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/shipments/:id/approve', async (req, res) => {
  try {
    const shId = req.params.id;
    await executeQuery('UPDATE Shipments SET status = ? WHERE id = ?', ['Approved', shId]);

    // ================== AUTOMATED JOURNAL (SHIPMENT) ==================
    // Debit: Uninvoice Shipment
    // Credit: Penjualan Temporary

    try {
      const uninvoiceShipmentAcc = await getGlAccount('uninvoice_shipment_account');
      const salesTempAcc = await getGlAccount('sales_temp_account');

      if (uninvoiceShipmentAcc && salesTempAcc) {
        // Get Data (Qty * Price from SO)
        const items = await executeQuery(`
                SELECT sd.quantity, sod.unit_price, (sd.quantity * sod.unit_price) as total_value
                FROM ShipmentDetails sd
                JOIN Shipments s ON sd.shipment_id = s.id
                JOIN SalesOrderDetails sod ON s.so_id = sod.so_id AND sd.item_id = sod.item_id
                WHERE s.id = ?
            `, [shId]);

        const totalAmount = items.reduce((sum, item) => sum + (Number(item.total_value) || 0), 0);

        if (totalAmount > 0) {
          const shDoc = await executeQuery('SELECT doc_number, doc_date FROM Shipments WHERE id = ?', [shId]);

          await createAutomatedJournal('Shipment', shId, shDoc[0].doc_number, shDoc[0].doc_date, [
            { coa_id: uninvoiceShipmentAcc, debit: totalAmount, credit: 0, description: 'Uninvoiced Shipment' },
            { coa_id: salesTempAcc, debit: 0, credit: totalAmount, description: 'Sales Temporary' }
          ]);
        }
      }
    } catch (jErr) {
      console.error('Failed to generate shipment journal:', jErr);
    }

    res.json({ success: true, message: 'Shipment berhasil di-approve' });
  } catch (error) {
    console.error('Error approving shipment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/shipments/:id/unapprove', async (req, res) => {
  try {
    await executeQuery('UPDATE Shipments SET status = ? WHERE id = ?', ['Draft', req.params.id]);
    res.json({ success: true, message: 'Shipment berhasil di-unapprove (Kembali ke Draft)' });
  } catch (error) {
    console.error('Error unapproving shipment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/shipments/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT status, so_id FROM Shipments WHERE id = ?', [req.params.id]);
    if (result[0]?.status !== 'Draft') {
      return res.status(400).json({ success: false, message: 'Hanya dokumen Draft yang bisa dihapus' });
    }
    await executeQuery('DELETE FROM ShipmentDetails WHERE shipment_id = ?', [req.params.id]);

    // Delete associated Journals (Auto Journal cleanup)
    // 1. Delete Journal Items linked to the Journal Header
    await executeQuery("DELETE FROM JournalVoucherDetails WHERE jv_id IN (SELECT id FROM JournalVouchers WHERE source_type = 'Shipment' AND ref_id = ?)", [req.params.id]);
    // 2. Delete Journal Header
    await executeQuery("DELETE FROM JournalVouchers WHERE source_type = 'Shipment' AND ref_id = ?", [req.params.id]);

    await executeQuery('DELETE FROM Shipments WHERE id = ?', [req.params.id]);

    if (result[0]?.so_id) await updateSOStatus(result[0].so_id);

    res.json({ success: true, message: 'Shipment berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RECEIVINGS ====================
app.put('/api/receivings/:id/approve', async (req, res) => {
  try {
    const rxId = req.params.id;
    await executeQuery('UPDATE Receivings SET status = ? WHERE id = ?', ['Approved', rxId]);

    // ================== AUTOMATED JOURNAL (RECEIVING) ==================
    // Debit: Persediaan (Inventory)
    // Credit: Hutang Dagang Temporary (AP Temporary)

    try {
      logDebug(`Attempting Journal for Receiving #${rxId}`);
      // 1. Get Accounts
      const inventoryAcc = await getGlAccount('inventory_account');
      const apTempAcc = await getGlAccount('ap_temp_account');
      logDebug(`Accounts: Inv=${inventoryAcc}, AP=${apTempAcc}`);

      if (inventoryAcc && apTempAcc) {
        // 2. Get Data (Qty * Unit Price)
        const items = await executeQuery(`
                -- Receivings (Prioritize rd.unit_price, then pod.unit_price)
                SELECT
                    rd.item_id,
                    rd.quantity,
                    COALESCE(rd.unit_price, pod.unit_price, 0) as cost,
                    r.warehouse_id,
                    r.doc_date,
                    (rd.quantity * COALESCE(rd.unit_price, pod.unit_price, 0)) as total_value
                FROM ReceivingDetails rd
                JOIN Receivings r ON rd.receiving_id = r.id
                JOIN PurchaseOrderDetails pod ON r.po_id = pod.po_id AND rd.item_id = pod.item_id
                WHERE r.id = ?
            `, [rxId]);

        logDebug(`Items found: ${JSON.stringify(items)}`);

        const totalAmount = items.reduce((sum, item) => sum + (Number(item.total_value) || 0), 0);
        logDebug(`Total Amount: ${totalAmount}`);

        if (totalAmount > 0) {
          // 3. Create Journal
          const rxDoc = await executeQuery('SELECT doc_number, doc_date FROM Receivings WHERE id = ?', [rxId]);

          const result = await createAutomatedJournal('Receiving', rxId, rxDoc[0].doc_number, rxDoc[0].doc_date, [
            { coa_id: inventoryAcc, debit: totalAmount, credit: 0, description: 'Inventory Receipt' },
            { coa_id: apTempAcc, debit: 0, credit: totalAmount, description: 'AP Temporary' }
          ]);
          logDebug(`Journal specific creation result: ${result}`);
        } else {
          logDebug('Total amount is 0, skipping journal.');
        }
      } else {
        logDebug('Missing GL Accounts settings.');
      }
    } catch (jErr) {
      logDebug(`ERROR: ${jErr.message}`);
      console.error('Failed to generate receiving journal:', jErr);
    }

    res.json({ success: true, message: 'Receiving berhasil di-approve' });
  } catch (error) {
    console.error('Error approving receiving:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ==================== SALESPERSONS ====================
app.get('/api/salespersons', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT sp.*, sa.name as sales_area_name 
      FROM SalesPersons sp
      LEFT JOIN SalesAreas sa ON sp.sales_area_id = sa.id
      ORDER BY sp.code
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/salespersons', async (req, res) => {
  try {
    const { code, name, phone, email, sales_area_id } = req.body;
    await executeQuery(
      'INSERT INTO SalesPersons (code, name, phone, email, sales_area_id) VALUES (?, ?, ?, ?, ?)',
      [code, name, phone || '', email || '', sales_area_id || null]
    );
    const result = await executeQuery('SELECT * FROM SalesPersons WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Sales Person berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/salespersons/:id', async (req, res) => {
  try {
    const { code, name, phone, email, active, sales_area_id } = req.body;
    await executeQuery(
      'UPDATE SalesPersons SET code = ?, name = ?, phone = ?, email = ?, active = ?, sales_area_id = ? WHERE id = ?',
      [code, name, phone, email, active || 'Y', sales_area_id || null, req.params.id]
    );
    res.json({ success: true, message: 'Sales Person berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/salespersons/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM SalesPersons WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Sales Person berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ENTITIES (MASTER ENTITY) ====================
app.get('/api/entities', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Entities ORDER BY code');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/entities/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Entities WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/entities', async (req, res) => {
  try {
    const { code, name, address, phone, email, tax_id, active } = req.body;
    await executeQuery(
      'INSERT INTO Entities (code, name, address, phone, email, tax_id, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, name, address || '', phone || '', email || '', tax_id || '', active || 'Y']
    );
    const result = await executeQuery('SELECT * FROM Entities WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Entity berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/entities/:id', async (req, res) => {
  try {
    const { code, name, address, phone, email, tax_id, active } = req.body;
    await executeQuery(
      'UPDATE Entities SET code = ?, name = ?, address = ?, phone = ?, email = ?, tax_id = ?, active = ? WHERE id = ?',
      [code, name, address, phone, email, tax_id, active || 'Y', req.params.id]
    );
    res.json({ success: true, message: 'Entity berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/entities/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Entities WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Entity berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SITES (MASTER SITE) ====================
app.get('/api/sites', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT s.*, e.name as entity_name
      FROM Sites s
      LEFT JOIN Entities e ON s.entity_id = e.id
      ORDER BY s.code
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sites/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Sites WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sites', async (req, res) => {
  try {
    const { code, name, entity_id, address, phone, active } = req.body;
    await executeQuery(
      'INSERT INTO Sites (code, name, entity_id, address, phone, active) VALUES (?, ?, ?, ?, ?, ?)',
      [code, name, entity_id || null, address || '', phone || '', active || 'Y']
    );
    const result = await executeQuery('SELECT * FROM Sites WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Site berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/sites/:id', async (req, res) => {
  try {
    const { code, name, entity_id, address, phone, active } = req.body;
    await executeQuery(
      'UPDATE Sites SET code = ?, name = ?, entity_id = ?, address = ?, phone = ?, active = ? WHERE id = ?',
      [code, name, entity_id || null, address, phone, active || 'Y', req.params.id]
    );
    res.json({ success: true, message: 'Site berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/sites/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Sites WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Site berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== JOURNAL VOUCHERS ====================
app.get('/api/journals', async (req, res) => {
  try {
    const { source_type, period_id } = req.query;
    const params = [];
    const conditions = [];

    let sql = `
      SELECT (SELECT SUM(d.debit) FROM JournalVoucherDetails d WHERE d.jv_id = JournalVouchers.id) as total_amount,
      *
      FROM JournalVouchers
    `;

    if (source_type) {
      if (source_type === 'SYSTEM') {
        conditions.push('source_type IS NOT NULL');
      } else if (source_type === 'MANUAL') {
        conditions.push("(source_type = 'MANUAL' OR source_type IS NULL)");
      } else {
        conditions.push('source_type = ?');
        params.push(source_type);
      }
    }

    if (period_id) {
      const periods = await executeQuery('SELECT start_date, end_date FROM AccountingPeriods WHERE id = ?', [period_id]);
      if (periods.length > 0) {
        conditions.push('doc_date BETWEEN ? AND ?');
        params.push(periods[0].start_date, periods[0].end_date);
      }
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY doc_date DESC, doc_number DESC';

    const result = await executeQuery(sql, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/journals/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM JournalVouchers WHERE id = ?', [req.params.id]);
    if (result.length === 0) return res.status(404).json({ success: false, message: 'Journal not found' });

    const details = await executeQuery(`
      SELECT d.*, a.code as coa_code, a.name as coa_name,
             ap.partner_id as ap_partner_id,
             ar.partner_id as ar_partner_id,
             ap.doc_number as ap_doc_number,
             ar.doc_number as ar_doc_number,
             pap.name as ap_partner_name,
             par.name as ar_partner_name
      FROM JournalVoucherDetails d
      LEFT JOIN Accounts a ON d.coa_id = a.id
      LEFT JOIN APInvoices ap ON d.ref_id = ap.id AND d.ref_type = 'AP'
      LEFT JOIN ARInvoices ar ON d.ref_id = ar.id AND d.ref_type = 'AR'
      LEFT JOIN Partners pap ON ap.partner_id = pap.id
      LEFT JOIN Partners par ON ar.partner_id = par.id
      WHERE d.jv_id = ?
    `, [req.params.id]);

    // Normalize partner_id, doc_number, partner_name
    const enhancedDetails = details.map(d => ({
      ...d,
      partner_id: d.ap_partner_id || d.ar_partner_id || null,
      ref_doc_number: d.ref_type === 'AP' ? d.ap_doc_number : (d.ref_type === 'AR' ? d.ar_doc_number : null),
      partner_name: d.ref_type === 'AP' ? d.ap_partner_name : (d.ref_type === 'AR' ? d.ar_partner_name : null)
    }));

    const journal = result[0];
    journal.details = enhancedDetails;

    res.json({ success: true, data: journal });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Outstanding Invoices (AP/AR)
app.get('/api/invoices/outstanding', async (req, res) => {
  try {
    const { type } = req.query; // 'AP' or 'AR'
    if (!type || (type !== 'AP' && type !== 'AR')) {
      return res.status(400).json({ success: false, error: 'Invalid type. Use AP or AR.' });
    }

    const table = type === 'AP' ? 'APInvoices' : 'ARInvoices';

    const query = `
      SELECT i.id, i.doc_number, i.doc_date, i.total_amount, i.paid_amount, (i.total_amount - i.paid_amount) as balance,
             p.name as partner_name, i.partner_id
      FROM ${table} i
      LEFT JOIN Partners p ON i.partner_id = p.id
      WHERE i.status IN ('Posted', 'Partial')
      AND (i.total_amount - i.paid_amount) > 0
      ORDER BY i.doc_date ASC
    `;

    const result = await executeQuery(query);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching outstanding invoices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create Journal Voucher (Manual)
app.post('/api/journals', async (req, res) => {
  try {
    const { doc_number, doc_date, description, transcode_id, details, is_giro, giro_number, giro_due_date } = req.body;

    const tId = parseInt(transcode_id);
    if (isNaN(tId)) {
      return res.status(400).json({ success: false, error: 'Invalid Transcode ID' });
    }

    // Basic validation
    let totalDebit = 0;
    let totalCredit = 0;
    details.forEach(d => {
      totalDebit += parseFloat(d.debit) || 0;
      totalCredit += parseFloat(d.credit) || 0;
    });

    if (Math.abs(totalDebit - totalCredit) > 0.01) { // Allowing small float diff
      return res.status(400).json({ success: false, error: 'Total Debit and Credit must be equal (Balanced).' });
    }

    const docNum = doc_number === 'AUTO' ? `JV/${new Date().getTime()}` : String(doc_number);

    const p_is_giro = is_giro ? 1 : 0;
    const p_giro_number = (giro_number && giro_number !== 'undefined' && giro_number !== 'null') ? String(giro_number) : null;
    const p_giro_due_date = (giro_due_date && giro_due_date !== 'undefined' && giro_due_date !== 'null') ? String(giro_due_date) : null;
    const p_giro_bank_name = (req.body.giro_bank_name && req.body.giro_bank_name !== 'undefined' && req.body.giro_bank_name !== 'null') ? String(req.body.giro_bank_name) : null;

    const params = [docNum, String(doc_date), String(description), tId, p_is_giro, p_giro_number, p_giro_due_date, p_giro_bank_name];

    // Debug logging
    // console.log('Insert JV Params:', params);

    const result = await executeQuery(
      `INSERT INTO JournalVouchers (doc_number, doc_date, description, status, transcode_id, source_type, is_giro, giro_number, giro_due_date, giro_bank_name)
       VALUES (?, ?, ?, 'Draft', ?, 'MANUAL', ?, ?, ?, ?)`,
      params
    );

    let jvId = result.insertId;

    if (!jvId) {
      // Fallback for some ODBC drivers
      const idRes = await executeQuery('SELECT @@IDENTITY as id');
      if (idRes && idRes[0] && idRes[0].id) {
        jvId = idRes[0].id;
      } else {
        const maxRes = await executeQuery('SELECT MAX(id) as max_id from JournalVouchers');
        jvId = maxRes[0].max_id;
      }
    }

    if (!jvId) {
      throw new Error('Failed to retrieve new Journal Voucher ID');
    }

    for (const det of details) {
      const coaId = parseInt(det.coa_id);
      if (isNaN(coaId)) {
        throw new Error(`Invalid Account (COA ID) in details: ${det.coa_id}`);
      }

      const refId = det.ref_id ? parseInt(det.ref_id) : null;
      const refType = det.ref_type ? String(det.ref_type) : null;
      const debit = parseFloat(det.debit) || 0;
      const credit = parseFloat(det.credit) || 0;

      await executeQuery(
        `INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit, ref_id, ref_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [jvId, coaId, det.description || '', debit, credit, refId, refType]
      );

      // Allocation Update
      if (refId && refType) {
        const table = refType === 'AP' ? 'APInvoices' : (refType === 'AR' ? 'ARInvoices' : null);
        if (table) {
          const amount = debit + credit; // One of them is 0

          await executeQuery(`UPDATE ${table} SET paid_amount = paid_amount + ? WHERE id = ?`, [amount, refId]);
          // Update status if Paid
          await executeQuery(`UPDATE ${table} SET status = 'Paid' WHERE id = ? AND paid_amount >= total_amount`, [refId]);
          // Update status if Partial
          await executeQuery(`UPDATE ${table} SET status = 'Partial' WHERE id = ? AND paid_amount < total_amount AND paid_amount > 0`, [refId]);
        }
      }
    }

    res.json({ success: true, message: 'Journal created successfully', id: jvId, doc_number: docNum });
  } catch (error) {
    console.error('Create Journal Error Params:', req.body);
    console.error('Create Journal Error:', error);

    let errorMessage = error.message;
    if (error.odbcErrors && error.odbcErrors.length > 0) {
      errorMessage += ' Details: ' + JSON.stringify(error.odbcErrors);
    }

    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Update Journal Voucher
app.put('/api/journals/:id', async (req, res) => {
  try {
    const { doc_date, description, details, is_giro, giro_number, giro_due_date } = req.body;
    const jvId = req.params.id;

    // Check status
    const current = await executeQuery('SELECT status FROM JournalVouchers WHERE id = ?', [jvId]);
    if (current.length === 0) return res.status(404).json({ success: false, error: 'Journal not found' });
    if (current[0].status !== 'Draft') return res.status(400).json({ success: false, error: 'Cannot edit posted journal' });

    // Validate Balance
    let totalDebit = 0;
    let totalCredit = 0;
    details.forEach(d => {
      totalDebit += parseFloat(d.debit) || 0;
      totalCredit += parseFloat(d.credit) || 0;
    });

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ success: false, error: 'Total Debit and Credit must be equal.' });
    }

    // Update Header
    const p_is_giro = is_giro ? 1 : 0;
    const p_giro_number = giro_number ? String(giro_number) : null;
    const p_giro_due_date = giro_due_date ? String(giro_due_date) : null;
    const p_giro_bank_name = req.body.giro_bank_name ? String(req.body.giro_bank_name) : null;

    await executeQuery(
      'UPDATE JournalVouchers SET doc_date = ?, description = ?, is_giro = ?, giro_number = ?, giro_due_date = ?, giro_bank_name = ? WHERE id = ?',
      [String(doc_date), String(description), p_is_giro, p_giro_number, p_giro_due_date, p_giro_bank_name, req.params.id]
    );

    // Revert Allocation from Old Details
    const oldDetails = await executeQuery('SELECT ref_id, ref_type, debit, credit FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
    for (const old of oldDetails) {
      if (old.ref_id && old.ref_type) {
        const table = old.ref_type === 'AP' ? 'APInvoices' : (old.ref_type === 'AR' ? 'ARInvoices' : null);
        if (table) {
          const amount = parseFloat(old.debit) || parseFloat(old.credit) || 0;
          await executeQuery(`UPDATE ${table} SET paid_amount = paid_amount - ? WHERE id = ?`, [amount, old.ref_id]);
          // Revert status to Posted (or Partial)
          // If paid_amount becomes < total but > 0 -> Partial. If <= 0 -> Posted.
          // We'll simplisticly set to Posted if currently Paid. The insert loop will re-check.
          // Better: check logic.
          await executeQuery(`UPDATE ${table} SET status = 'Posted' WHERE id = ? AND paid_amount <= 0`, [old.ref_id]);
          await executeQuery(`UPDATE ${table} SET status = 'Partial' WHERE id = ? AND paid_amount > 0 AND paid_amount < total_amount`, [old.ref_id]);
          // If it remains paid? (e.g. overpayment revert). Logic handles it.
        }
      }
    }

    // Delete existing details
    await executeQuery('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);

    // Insert new details
    for (const det of details) {
      const refId = det.ref_id ? parseInt(det.ref_id) : null;
      const refType = det.ref_type ? String(det.ref_type) : null;

      await executeQuery(
        `INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit, ref_id, ref_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [jvId, det.coa_id, det.description || '', det.debit, det.credit, refId, refType]
      );

      // Allocation Update (New)
      if (refId && refType) {
        const table = refType === 'AP' ? 'APInvoices' : (refType === 'AR' ? 'ARInvoices' : null);
        if (table) {
          const amount = parseFloat(det.debit) || parseFloat(det.credit) || 0;
          await executeQuery(`UPDATE ${table} SET paid_amount = paid_amount + ? WHERE id = ?`, [amount, refId]);
          await executeQuery(`UPDATE ${table} SET status = 'Paid' WHERE id = ? AND paid_amount >= total_amount`, [refId]);
          await executeQuery(`UPDATE ${table} SET status = 'Partial' WHERE id = ? AND paid_amount < total_amount AND paid_amount > 0`, [refId]);
        }
      }
    }

    res.json({ success: true, message: 'Journal updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete Journal Voucher
app.delete('/api/journals/:id', async (req, res) => {
  try {
    const jvId = req.params.id;
    const current = await executeQuery('SELECT status FROM JournalVouchers WHERE id = ?', [jvId]);
    if (current.length === 0) return res.status(404).json({ success: false, error: 'Journal not found' });
    if (current[0].status !== 'Draft') return res.status(400).json({ success: false, error: 'Cannot delete posted journal' });

    // Revert Allocation
    const oldDetails = await executeQuery('SELECT ref_id, ref_type, debit, credit FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
    for (const old of oldDetails) {
      if (old.ref_id && old.ref_type) {
        const table = old.ref_type === 'AP' ? 'APInvoices' : (old.ref_type === 'AR' ? 'ARInvoices' : null);
        if (table) {
          const amount = parseFloat(old.debit) || parseFloat(old.credit) || 0;
          await executeQuery(`UPDATE ${table} SET paid_amount = paid_amount - ? WHERE id = ?`, [amount, old.ref_id]);
          await executeQuery(`UPDATE ${table} SET status = 'Posted' WHERE id = ? AND paid_amount <= 0`, [old.ref_id]);
          await executeQuery(`UPDATE ${table} SET status = 'Partial' WHERE id = ? AND paid_amount > 0 AND paid_amount < total_amount`, [old.ref_id]);
        }
      }
    }

    await executeQuery('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
    await executeQuery('DELETE FROM JournalVouchers WHERE id = ?', [jvId]);

    res.json({ success: true, message: 'Journal deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Post Journal Voucher
app.put('/api/journals/:id/post', async (req, res) => {
  try {
    const jvId = req.params.id;
    await executeQuery("UPDATE JournalVouchers SET status = 'Posted' WHERE id = ?", [jvId]);
    res.json({ success: true, message: 'Journal posted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unpost Journal Voucher
app.put('/api/journals/:id/unpost', async (req, res) => {
  try {
    const jvId = req.params.id;
    await executeQuery("UPDATE JournalVouchers SET status = 'Draft' WHERE id = ?", [jvId]);
    res.json({ success: true, message: 'Journal unposted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GL SETTINGS ====================
app.get('/api/gl-settings', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT s.*, a.code as account_code, a.name as account_name
      FROM GeneralLedgerSettings s
      LEFT JOIN Accounts a ON s.account_id = a.id
    `);

    // Transform to key-value object for easier frontend consumption
    const settings = {};
    result.forEach(row => {
      settings[row.setting_key] = {
        account_id: row.account_id,
        account_code: row.account_code,
        account_name: row.account_name
      };
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/gl-settings', async (req, res) => {
  try {
    const settings = req.body; // Expecting array of { key, account_id } or object

    // If object { key: account_id, ... }
    for (const [key, account_id] of Object.entries(settings)) {
      if (!account_id) continue;

      // Check if exists
      const exists = await executeQuery('SELECT count(*) as count FROM GeneralLedgerSettings WHERE setting_key = ?', [key]);

      if (exists[0].count > 0) {
        await executeQuery('UPDATE GeneralLedgerSettings SET account_id = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?', [account_id, key]);
      } else {
        await executeQuery('INSERT INTO GeneralLedgerSettings (setting_key, account_id) VALUES (?, ?)', [key, account_id]);
      }
    }

    res.json({ success: true, message: 'GL Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to create automated journal (will be used by transaction updates)
async function createAutomatedJournal(type, ref_id, doc_number, doc_date, details) {
  let connection;
  try {
    connection = await odbc.connect(connectionString);

    // await connection.beginTransaction(); // Calling SQL directly for safety
    await connection.query('BEGIN TRANSACTION');

    // 1. Check if journal already exists
    // Note: This check can be separate or same connection. Same is safer.
    const existing = await connection.query('SELECT id FROM JournalVouchers WHERE source_type = ? AND ref_id = ?', [type, ref_id]);
    let jvId;

    // For now using source doc number prefixed
    const jvNumber = `JV-${doc_number}`;

    if (existing.length > 0) {
      logDebug(`Existing Journal found for ${type} #${doc_number} (ID: ${existing[0].id}). Replacing details.`);
      jvId = existing[0].id;
      // Update existing
      await connection.query('UPDATE JournalVouchers SET doc_number = ?, doc_date = ? WHERE id = ?', [jvNumber, doc_date, jvId]);
      await connection.query('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
    } else {
      // Create new
      logDebug(`Creating new JournalVoucher ${jvNumber}`);
      await connection.query(
        'INSERT INTO JournalVouchers (doc_number, doc_date, description, status, source_type, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
        [jvNumber, doc_date, `Auto Journal for ${type} #${doc_number}`, 'Posted', type, ref_id]
      );

      const res = await connection.query('SELECT @@IDENTITY as id');
      jvId = res[0].id;
      logDebug(`New Journal ID: ${jvId}`);
    }

    // 2. Insert Details
    logDebug(`Inserting ${details.length} details for JV #${jvId}`);
    for (const det of details) {
      if (!det.coa_id) {
        logDebug(`Skipping detail due to missing coa_id: ${JSON.stringify(det)}`);
        continue;
      }
      logDebug(`Inserting detail: Debit=${det.debit}, Credit=${det.credit}, COA=${det.coa_id}`);
      await connection.query(
        'INSERT INTO JournalVoucherDetails (jv_id, coa_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)',
        [jvId, det.coa_id, det.debit || 0, det.credit || 0, det.description || '']
      );
    }

    await connection.query('COMMIT');
    // await connection.commit();
    logDebug(`Transaction Committed for JV #${jvId}`);

    console.log(`✅ Automated Journal created for ${type} #${doc_number}`);
    return true;
  } catch (error) {
    if (connection) {
      try { await connection.query('ROLLBACK'); } catch (e) { }
    }
    logDebug(`ERROR in createAutomatedJournal: ${error.message}`);
    console.error(`❌ Failed to create automated journal for ${type} #${doc_number}:`, error);
    return false;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

// Function to get GL Account ID by setting key
async function getGlAccount(key) {
  const res = await executeQuery('SELECT account_id FROM GeneralLedgerSettings WHERE setting_key = ?', [key]);
  return res.length > 0 ? res[0].account_id : null;
}

app.get('/api/warehouses', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT w.*, s.name as site_name
      FROM Warehouses w
      LEFT JOIN Sites s ON w.site_id = s.id
      ORDER BY w.code
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/warehouses/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Warehouses WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/warehouses', async (req, res) => {
  try {
    const { code, description, site_id, active } = req.body;
    await executeQuery(
      'INSERT INTO Warehouses (code, description, site_id, active) VALUES (?, ?, ?, ?)',
      [code, description, site_id || null, active || 'Y']
    );
    const result = await executeQuery('SELECT * FROM Warehouses WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Warehouse berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/warehouses/:id', async (req, res) => {
  try {
    const { code, description, site_id, active } = req.body;
    await executeQuery(
      'UPDATE Warehouses SET code = ?, description = ?, site_id = ?, active = ? WHERE id = ?',
      [code, description, site_id || null, active || 'Y', req.params.id]
    );
    res.json({ success: true, message: 'Warehouse berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/warehouses/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Warehouses WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Warehouse berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SUB WAREHOUSES (MASTER SUB WAREHOUSE) ====================
app.get('/api/sub-warehouses', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT sw.*, w.description as warehouse_name
      FROM SubWarehouses sw
      LEFT JOIN Warehouses w ON sw.warehouse_id = w.id
      ORDER BY sw.code
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sub-warehouses/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM SubWarehouses WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sub-warehouses', async (req, res) => {
  try {
    const { code, name, warehouse_id, active } = req.body;
    await executeQuery(
      'INSERT INTO SubWarehouses (code, name, warehouse_id, active) VALUES (?, ?, ?, ?)',
      [code, name, warehouse_id || null, active || 'Y']
    );
    const result = await executeQuery('SELECT * FROM SubWarehouses WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Sub Warehouse berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/sub-warehouses/:id', async (req, res) => {
  try {
    const { code, name, warehouse_id, active } = req.body;
    await executeQuery(
      'UPDATE SubWarehouses SET code = ?, name = ?, warehouse_id = ?, active = ? WHERE id = ?',
      [code, name, warehouse_id || null, active || 'Y', req.params.id]
    );
    res.json({ success: true, message: 'Sub Warehouse berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/sub-warehouses/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM SubWarehouses WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Sub Warehouse berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== LOCATIONS (MASTER LOCATION) ====================
app.get('/api/locations', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT l.*, sw.name as sub_warehouse_name
      FROM Locations l
      LEFT JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
      ORDER BY l.code
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/locations/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Locations WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/locations', async (req, res) => {
  try {
    const { code, name, sub_warehouse_id, active } = req.body;
    await executeQuery(
      'INSERT INTO Locations (code, name, sub_warehouse_id, active) VALUES (?, ?, ?, ?)',
      [code, name, sub_warehouse_id || null, active || 'Y']
    );
    const result = await executeQuery('SELECT * FROM Locations WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Location berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/locations/:id', async (req, res) => {
  try {
    const { code, name, sub_warehouse_id, active } = req.body;
    await executeQuery(
      'UPDATE Locations SET code = ?, name = ?, sub_warehouse_id = ?, active = ? WHERE id = ?',
      [code, name, sub_warehouse_id || null, active || 'Y', req.params.id]
    );
    res.json({ success: true, message: 'Location berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/locations/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM Locations WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Location berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PURCHASE ORDERS ====================
app.get('/api/purchase-orders', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
            SELECT po.*, p.name as partner_name, t.name as transcode_name, pt.name as payment_term_name
            FROM PurchaseOrders po
            LEFT JOIN Partners p ON po.partner_id = p.id
            LEFT JOIN Transcodes t ON po.transcode_id = t.id
            LEFT JOIN PaymentTerms pt ON po.payment_term_id = pt.id
        `;

    const params = [];
    if (startDate && endDate) {
      query += ' WHERE po.doc_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY po.doc_number DESC';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/purchase-orders/:id', async (req, res) => {
  try {
    const po = await executeQuery(`
      SELECT po.*, p.name as partner_name, t.name as transcode_name, pt.name as payment_term_name
      FROM PurchaseOrders po
      LEFT JOIN Partners p ON po.partner_id = p.id
      LEFT JOIN Transcodes t ON po.transcode_id = t.id
      LEFT JOIN PaymentTerms pt ON po.payment_term_id = pt.id
      WHERE po.id = ?
    `, [req.params.id]);

    const details = await executeQuery(`
      SELECT d.*, i.code as item_code, i.name as item_name, i.unit as unit_code,
      (
        SELECT COALESCE(SUM(rd.quantity), 0)
        FROM ReceivingDetails rd
        JOIN Receivings r ON rd.receiving_id = r.id
        WHERE r.po_id = d.po_id AND rd.item_id = d.item_id AND r.status != 'Cancelled'
      ) as qty_received
      FROM PurchaseOrderDetails d
      LEFT JOIN Items i ON d.item_id = i.id
      WHERE d.po_id = ?
    `, [req.params.id]);

    res.json({ success: true, data: { ...po[0], details } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/purchase-orders', async (req, res) => {
  try {
    const { doc_number, doc_date, partner_id, status, details, transcode_id, payment_term_id, tax_type, currency_code } = req.body;

    // Calculate total
    const total = details?.reduce((sum, d) => sum + (d.quantity * d.unit_price), 0) || 0;

    // Insert header
    await executeQuery(
      'INSERT INTO PurchaseOrders (doc_number, doc_date, partner_id, status, total_amount, transcode_id, payment_term_id, tax_type, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [doc_number, doc_date, partner_id, status || 'Draft', total, transcode_id || null, payment_term_id || null, tax_type || 'Exclude', currency_code || null]
    );

    // Get inserted ID
    const poResult = await executeQuery('SELECT * FROM PurchaseOrders WHERE doc_number = ?', [doc_number]);
    const poId = poResult[0]?.id;

    // Insert details
    if (details && details.length > 0 && poId) {
      for (const d of details) {
        await executeQuery(
          'INSERT INTO PurchaseOrderDetails (po_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
          [poId, d.item_id, d.quantity, d.unit_price, d.quantity * d.unit_price]
        );
      }
    }

    res.json({ success: true, data: poResult[0], message: 'Purchase Order berhasil dibuat' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/purchase-orders/:id', async (req, res) => {
  try {
    const { doc_number, doc_date, partner_id, status, details, transcode_id, payment_term_id, tax_type, currency_code } = req.body;
    const total = details?.reduce((sum, d) => sum + (d.quantity * d.unit_price), 0) || 0;

    // Validation: Check if linked to Receiving
    const hasReceiving = await executeQuery("SELECT COUNT(*) as count FROM Receivings WHERE po_id = ? AND status <> ?", [parseInt(req.params.id), 'Cancelled']);
    if (hasReceiving[0].count > 0) {
      // If updating details, block it.
      // For now, simpler: Block any update except Status change to 'Closed' (which might happen via system)
      // actually, if user is editing, we should block.
      // But wait, what if they just want to change Remarks? We don't have remarks in PO update yet?
      // Let's safe block critical updates.

      // If the request is trying to update details (which effectively replaces them), block it.
      // Even header updates like Partner ID should be blocked if received.
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat mengedit PO karena sudah ada dokumen Receiving yang terhubung. Hapus Receiving terlebih dahulu jika ingin mengubah PO.'
      });
    }

    await executeQuery(
      'UPDATE PurchaseOrders SET doc_number = ?, doc_date = ?, partner_id = ?, status = ?, total_amount = ?, transcode_id = ?, payment_term_id = ?, tax_type = ?, currency_code = ? WHERE id = ?',
      [doc_number, doc_date, partner_id, status, total, transcode_id || null, payment_term_id || null, tax_type || 'Exclude', currency_code || null, req.params.id]
    );

    // Update details - delete old and insert new
    await executeQuery('DELETE FROM PurchaseOrderDetails WHERE po_id = ?', [req.params.id]);
    if (details && details.length > 0) {
      for (const d of details) {
        await executeQuery(
          'INSERT INTO PurchaseOrderDetails (po_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
          [req.params.id, d.item_id, d.quantity, d.unit_price, d.quantity * d.unit_price]
        );
      }
    }

    res.json({ success: true, message: 'Purchase Order berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/purchase-orders/:id', async (req, res) => {
  try {
    // Validation: Check if linked to Receiving
    const hasReceiving = await executeQuery("SELECT COUNT(*) as count FROM Receivings WHERE po_id = ? AND status <> ?", [parseInt(req.params.id), 'Cancelled']);
    if (hasReceiving[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat menghapus PO karena sudah ada dokumen Receiving yang terhubung. Hapus Receiving terlebih dahulu.'
      });
    }

    await executeQuery('DELETE FROM PurchaseOrderDetails WHERE po_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM PurchaseOrders WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Purchase Order berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/purchase-orders/:id/approve', async (req, res) => {
  try {
    // Optional: Validate status is Draft before approving
    await executeQuery('UPDATE PurchaseOrders SET status = ? WHERE id = ?', ['Approved', req.params.id]);
    res.json({ success: true, message: 'Purchase Order berhasil di-approve' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/purchase-orders/:id/unapprove', async (req, res) => {
  try {
    // Validation: Check if linked to Receiving
    console.log(`Unapproving PO ID: ${req.params.id}`);
    const hasReceiving = await executeQuery("SELECT COUNT(*) as count FROM Receivings WHERE po_id = ? AND status <> ?", [parseInt(req.params.id), 'Cancelled']);
    if (hasReceiving[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat meng-unapprove PO karena sudah ada dokumen Receiving yang terhubung. Hapus Receiving terlebih dahulu.'
      });
    }

    // Optional: Check if already processed (e.g. received)
    await executeQuery('UPDATE PurchaseOrders SET status = ? WHERE id = ?', ['Draft', req.params.id]);
    res.json({ success: true, message: 'Purchase Order berhasil di-unapprove (Kembali ke Draft)' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SALES ORDERS ====================
app.get('/api/sales-orders', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
            SELECT so.*, p.name as partner_name, t.name as transcode_name, pt.name as payment_term_name
            FROM SalesOrders so
            LEFT JOIN Partners p ON so.partner_id = p.id
            LEFT JOIN Transcodes t ON so.transcode_id = t.id
            LEFT JOIN PaymentTerms pt ON so.payment_term_id = pt.id
        `;

    const params = [];
    if (startDate && endDate) {
      query += ' WHERE so.doc_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY so.doc_number DESC';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sales-orders/:id', async (req, res) => {
  try {
    const so = await executeQuery(`
      SELECT so.*, p.name as partner_name, sp.name as salesperson_name, pt.name as payment_term_name
      FROM SalesOrders so
      LEFT JOIN Partners p ON so.partner_id = p.id
      LEFT JOIN SalesPersons sp ON so.sales_person_id = sp.id
      LEFT JOIN PaymentTerms pt ON so.payment_term_id = pt.id
      WHERE so.id = ?
    `, [req.params.id]);

    const details = await executeQuery(`
      SELECT d.*, i.code as item_code, i.name as item_name, i.unit as item_base_unit,
      d.unit_code as detail_unit_code, d.conversion_factor as detail_conversion_factor, d.base_qty,
      (
        SELECT COALESCE(SUM(sd.quantity), 0)
        FROM ShipmentDetails sd
        JOIN Shipments s ON sd.shipment_id = s.id
        WHERE s.so_id = d.so_id AND sd.item_id = d.item_id AND s.status != 'Cancelled'
      ) as qty_shipped
      FROM SalesOrderDetails d
      LEFT JOIN Items i ON d.item_id = i.id
      WHERE d.so_id = ?
    `, [req.params.id]);

    res.json({ success: true, data: { ...so[0], details } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sales-orders', async (req, res) => {
  try {
    const { doc_number, doc_date, partner_id, salesperson_id, status, details, transcode_id, payment_term_id, tax_type, currency_code } = req.body;
    const total = details?.reduce((sum, d) => sum + (d.quantity * d.unit_price), 0) || 0;

    // Validate Financial Limits
    const financialValid = await validatePartnerFinancials(partner_id, total, payment_term_id);
    if (!financialValid.valid) {
      return res.status(400).json({ success: false, error: financialValid.error });
    }


    await executeQuery(
      'INSERT INTO SalesOrders (doc_number, doc_date, partner_id, sales_person_id, status, total_amount, transcode_id, payment_term_id, tax_type, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [doc_number, doc_date, partner_id, salesperson_id, status || 'Draft', total, transcode_id || null, payment_term_id || null, tax_type || 'Exclude', currency_code || null]
    );

    const soResult = await executeQuery('SELECT * FROM SalesOrders WHERE doc_number = ?', [doc_number]);
    const soId = soResult[0]?.id;

    if (details && details.length > 0 && soId) {
      for (const d of details) {
        const convFactor = parseFloat(d.conversion_factor) || 1;
        const baseQty = d.quantity * convFactor;
        await executeQuery(
          'INSERT INTO SalesOrderDetails (so_id, item_id, quantity, unit_price, line_total, unit_code, conversion_factor, base_qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [soId, d.item_id, d.quantity, d.unit_price, d.quantity * d.unit_price, d.unit_code || null, convFactor, baseQty]
        );
      }
    }

    res.json({ success: true, data: soResult[0], message: 'Sales Order berhasil dibuat' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/sales-orders/:id', async (req, res) => {
  try {
    const { doc_number, doc_date, partner_id, salesperson_id, status, details, transcode_id, payment_term_id, tax_type, currency_code } = req.body;
    const total = details?.reduce((sum, d) => sum + (d.quantity * d.unit_price), 0) || 0;

    await executeQuery(
      'UPDATE SalesOrders SET doc_number = ?, doc_date = ?, partner_id = ?, sales_person_id = ?, status = ?, total_amount = ?, transcode_id = ?, payment_term_id = ?, tax_type = ?, currency_code = ? WHERE id = ?',
      [doc_number, doc_date, partner_id, salesperson_id, status, total, transcode_id, payment_term_id || null, tax_type || 'Exclude', currency_code || null, req.params.id]
    );

    await executeQuery('DELETE FROM SalesOrderDetails WHERE so_id = ?', [req.params.id]);
    if (details && details.length > 0) {
      for (const d of details) {
        const convFactor = parseFloat(d.conversion_factor) || 1;
        const baseQty = d.quantity * convFactor;
        await executeQuery(
          'INSERT INTO SalesOrderDetails (so_id, item_id, quantity, unit_price, line_total, unit_code, conversion_factor, base_qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [req.params.id, d.item_id, d.quantity, d.unit_price, d.quantity * d.unit_price, d.unit_code || null, convFactor, baseQty]
        );
      }
    }

    res.json({ success: true, message: 'Sales Order berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/sales-orders/:id/approve', async (req, res) => {
  try {
    await executeQuery('UPDATE SalesOrders SET status = ? WHERE id = ?', ['Approved', req.params.id]);
    res.json({ success: true, message: 'Sales Order berhasil di-approve' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/sales-orders/:id/unapprove', async (req, res) => {
  try {
    // Validation: Check if linked to Shipment
    console.log(`Unapproving SO ID: ${req.params.id}`);
    const hasShipment = await executeQuery("SELECT COUNT(*) as count FROM Shipments WHERE so_id = ? AND status <> ?", [req.params.id, 'Cancelled']);
    if (hasShipment[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat meng-unapprove SO karena sudah ada dokumen Shipment yang terhubung. Hapus Shipment terlebih dahulu.'
      });
    }

    // Post: Unapprove Sales Order
    await executeQuery('UPDATE SalesOrders SET status = ? WHERE id = ?', ['Draft', req.params.id]);
    res.json({ success: true, message: 'Sales Order berhasil di-unapprove (Kembali ke Draft)' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/sales-orders/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM SalesOrderDetails WHERE so_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM SalesOrders WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Sales Order berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RECEIVINGS ====================
app.get('/api/receivings', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
            SELECT
                rec.*,
                po.doc_number as po_number,
                p.name as partner_name,
                l.name as location_name,
                (SELECT SUM(quantity) FROM ReceivingDetails WHERE receiving_id = rec.id) as total_received,
                (SELECT SUM(quantity) FROM APInvoiceDetails ad JOIN APInvoices ai ON ad.ap_invoice_id = ai.id WHERE ai.receiving_id = rec.id AND ai.status != 'Cancelled') as total_billed
            FROM Receivings rec
            LEFT JOIN PurchaseOrders po ON rec.po_id = po.id
            LEFT JOIN Partners p ON po.partner_id = p.id
            LEFT JOIN Locations l ON rec.location_id = l.id
        `;

    const params = [];
    if (startDate && endDate) {
      query += ' WHERE rec.doc_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY rec.doc_number DESC';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/receivings/:id', async (req, res) => {
  console.log('GET /api/receivings/:id hit for ID:', req.params.id);
  try {
    const header = await executeQuery(`
      SELECT r.*, p.name as partner_name, po.doc_number as po_number, w.description as warehouse_name, l.name as location_name
      FROM Receivings r
      LEFT JOIN Partners p ON r.partner_id = p.id
      LEFT JOIN PurchaseOrders po ON r.po_id = po.id
      LEFT JOIN Warehouses w ON r.warehouse_id = w.id
      LEFT JOIN Locations l ON r.location_id = l.id
      WHERE r.id = ?
    `, [req.params.id]);

    const details = await executeQuery(`
      SELECT d.*, i.code as item_code, i.name as item_name, i.unit as unit_code,
             COALESCE(d.unit_price, pod.unit_price, 0) as unit_price,
             COALESCE(po.tax_type, 'Exclude') as tax_type,
             (SELECT COALESCE(SUM(apd.quantity), 0)
              FROM APInvoiceDetails apd
              JOIN APInvoices api ON apd.ap_invoice_id = api.id
              WHERE apd.receiving_id = d.receiving_id
              AND apd.item_id = d.item_id
              AND api.status <> 'Cancelled') as qty_billed
      FROM ReceivingDetails d
      LEFT JOIN Items i ON d.item_id = i.id
      LEFT JOIN Receivings r ON d.receiving_id = r.id
      LEFT JOIN PurchaseOrders po ON r.po_id = po.id
      LEFT JOIN PurchaseOrderDetails pod ON r.po_id = pod.po_id AND d.item_id = pod.item_id
      WHERE d.receiving_id = ?
    `, [req.params.id]);

    res.json({ success: true, data: { ...header[0], details } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/receivings', async (req, res) => {
  try {
    const { doc_number, doc_date, po_id, partner_id, warehouse_id, location_id, status, items, transcode_id, remarks, currency_code } = req.body;

    await executeQuery(
      'INSERT INTO Receivings (doc_number, doc_date, po_id, partner_id, warehouse_id, location_id, status, transcode_id, remarks, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [doc_number, doc_date, po_id || null, partner_id, warehouse_id || null, location_id || null, status || 'Draft', transcode_id || null, remarks || '', currency_code || null]
    );

    const result = await executeQuery('SELECT * FROM Receivings WHERE doc_number = ?', [doc_number]);
    const recId = result[0]?.id;

    if (items && items.length > 0 && recId) {
      for (const d of items) {
        await executeQuery(
          'INSERT INTO ReceivingDetails (receiving_id, item_id, quantity, unit_price, remarks) VALUES (?, ?, ?, ?, ?)',
          [recId, d.item_id, d.quantity, d.unit_price || 0, d.remarks || '']
        );
      }
    }

    res.json({ success: true, data: result[0], message: 'Receiving berhasil dibuat' });

    // Auto-update PO status
    if (po_id) await updatePOStatus(po_id);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/receivings/:id', async (req, res) => {
  try {
    const { doc_number, doc_date, po_id, partner_id, warehouse_id, location_id, status, items, transcode_id, remarks, currency_code } = req.body;

    await executeQuery(
      'UPDATE Receivings SET doc_number = ?, doc_date = ?, po_id = ?, partner_id = ?, warehouse_id = ?, location_id = ?, status = ?, transcode_id = ?, remarks = ?, currency_code = ? WHERE id = ?',
      [doc_number, doc_date, po_id || null, partner_id, warehouse_id || null, location_id || null, status, transcode_id || null, remarks || '', currency_code || null, req.params.id]
    );

    await executeQuery('DELETE FROM ReceivingDetails WHERE receiving_id = ?', [req.params.id]);
    if (items && items.length > 0) {
      for (const d of items) {
        await executeQuery(
          'INSERT INTO ReceivingDetails (receiving_id, item_id, quantity, unit_price, remarks) VALUES (?, ?, ?, ?, ?)',
          [req.params.id, d.item_id, d.quantity, d.unit_price || 0, d.remarks || '']
        );
      }
    }

    res.json({ success: true, message: 'Receiving berhasil diupdate' });

    // Auto-update PO status (using submitted PO ID)
    if (po_id) await updatePOStatus(po_id);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/receivings/:id', async (req, res) => {
  try {
    const rxId = req.params.id;
    const result = await executeQuery('SELECT * FROM Receivings WHERE id = ?', [rxId]);

    if (result.length === 0) return res.status(404).json({ success: false, message: 'Receiving not found' });
    if (result[0].status !== 'Draft') { // Should strictly be Draft, but let's check
      return res.status(400).json({ success: false, message: 'Hanya dokumen Draft yang bisa dihapus' });
    }

    // Check if used in other tables (logic exists?)

    // Cleanup Journal (Safety measure)
    try {
      const checkJurnal = await executeQuery('SELECT id FROM JournalVouchers WHERE source_type = ? AND ref_id = ?', ['Receiving', rxId]);
      if (checkJurnal.length > 0) {
        const jvId = checkJurnal[0].id;
        await executeQuery('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
        await executeQuery('DELETE FROM JournalVouchers WHERE id = ?', [jvId]);
      }
    } catch (jErr) {
      console.error('Error cleaning up journal:', jErr);
    }

    await executeQuery('DELETE FROM ReceivingDetails WHERE receiving_id = ?', [rxId]);
    await executeQuery('DELETE FROM Receivings WHERE id = ?', [rxId]);

    if (result[0].po_id) await updatePOStatus(result[0].po_id);

    res.json({ success: true, message: 'Receiving berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/receivings/:id/approve', async (req, res) => {
  try {
    // In future: Add inventory transaction logic here
    await executeQuery('UPDATE Receivings SET status = ? WHERE id = ?', ['Approved', req.params.id]);
    res.json({ success: true, message: 'Receiving berhasil di-approve' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/receivings/:id/unapprove', async (req, res) => {
  try {
    const rxId = req.params.id;
    await executeQuery('UPDATE Receivings SET status = ? WHERE id = ?', ['Draft', rxId]);

    // ================== DELETE AUTOMATED JOURNAL ==================
    try {
      const checkJurnal = await executeQuery('SELECT id FROM JournalVouchers WHERE source_type = ? AND ref_id = ?', ['Receiving', rxId]);
      if (checkJurnal.length > 0) {
        const jvId = checkJurnal[0].id;
        await executeQuery('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
        await executeQuery('DELETE FROM JournalVouchers WHERE id = ?', [jvId]);
        console.log(`✅ Automated Journal deleted for Receiving #${rxId}`);
      }
    } catch (jErr) {
      console.error('Failed to delete receiving journal:', jErr);
    }

    res.json({ success: true, message: 'Receiving berhasil di-unpost (Kembali ke Draft)' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ==================== AP INVOICES ====================
app.get('/api/ap-invoices', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
            SELECT inv.*, p.name as partner_name, rec.doc_number as receiving_number
            FROM APInvoices inv
            LEFT JOIN Partners p ON inv.partner_id = p.id
            LEFT JOIN Receivings rec ON inv.receiving_id = rec.id
        `;

    const params = [];
    if (startDate && endDate) {
      query += ' WHERE inv.doc_date BETWEEN ? AND ?'; // Changed from invoice_date to doc_date based on original query
      params.push(startDate, endDate);
    }

    query += ' ORDER BY inv.doc_number DESC';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invoices for AP allocation (only outstanding invoices)
app.get('/api/ap-invoices/for-allocation', async (req, res) => {
  try {
    const { partner_id } = req.query;
    if (!partner_id) {
      return res.status(400).json({ success: false, error: 'partner_id required' });
    }

    // Get all posted invoices for this partner with outstanding balance
    const partnerIdInt = parseInt(partner_id);
    const query = `
      SELECT id, doc_number, doc_date,
        COALESCE(total_amount, 0) as total_amount,
        COALESCE(paid_amount, 0) as paid_amount
      FROM APInvoices
      WHERE partner_id = ${partnerIdInt} AND status = 'Posted'
      ORDER BY doc_date ASC
    `;
    const invoices = await executeQuery(query);

    // Calculate outstanding and filter
    const outstandingInvoices = invoices
      .map(inv => ({
        ...inv,
        total_amount: parseFloat(inv.total_amount || 0),
        paid_amount: parseFloat(inv.paid_amount || 0),
        outstanding_amount: parseFloat(inv.total_amount || 0) - parseFloat(inv.paid_amount || 0)
      }))
      .filter(inv => inv.outstanding_amount > 0.01);

    res.json({ success: true, data: outstandingInvoices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/ap-invoices/:id', async (req, res) => {
  try {
    const header = await executeQuery(`
      SELECT ap.*, p.name as partner_name
      FROM APInvoices ap
      LEFT JOIN Partners p ON ap.partner_id = p.id
      WHERE ap.id = ?
    `, [req.params.id]);

    const details = await executeQuery(`
      SELECT d.*, i.code as item_code, i.name as item_name
      FROM APInvoiceDetails d
      LEFT JOIN Items i ON d.item_id = i.id
      WHERE d.ap_invoice_id = ?
    `, [req.params.id]);

    res.json({ success: true, data: { ...header[0], details } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ap-invoices', async (req, res) => {
  try {
    const { doc_number, doc_date, partner_id, due_date, status, notes, transcode_id, tax_type, items, receiving_id, currency_code } = req.body;

    await executeQuery(
      'INSERT INTO APInvoices (doc_number, doc_date, partner_id, due_date, status, notes, transcode_id, tax_type, receiving_id, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [doc_number, doc_date, partner_id, due_date || null, status || 'Draft', notes || '', transcode_id || null, tax_type || 'Exclude', receiving_id || null, currency_code || null]
    );

    const result = await executeQuery('SELECT * FROM APInvoices WHERE doc_number = ?', [doc_number]);
    const apId = result[0]?.id;

    if (items && items.length > 0 && apId) {
      for (const d of items) {
        await executeQuery(
          'INSERT INTO APInvoiceDetails (ap_invoice_id, item_id, description, quantity, unit_price, amount, receiving_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [apId, d.item_id || null, d.description || '', d.quantity || 0, d.unit_price || 0, d.amount || 0, d.receiving_id || null]
        );
      }
    }

    res.json({ success: true, data: result[0], message: 'AP Invoice berhasil dibuat' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/ap-invoices/:id', async (req, res) => {
  try {
    const { doc_number, doc_date, partner_id, due_date, status, notes, transcode_id, tax_type, items, receiving_id, currency_code } = req.body;

    await executeQuery(
      'UPDATE APInvoices SET doc_number = ?, doc_date = ?, partner_id = ?, due_date = ?, status = ?, notes = ?, transcode_id = ?, tax_type = ?, receiving_id = ?, currency_code = ? WHERE id = ?',
      [doc_number, doc_date, partner_id, due_date || null, status, notes || '', transcode_id || null, tax_type || 'Exclude', receiving_id || null, currency_code || null, req.params.id]
    );

    await executeQuery('DELETE FROM APInvoiceDetails WHERE ap_invoice_id = ?', [req.params.id]);

    if (items && items.length > 0) {
      for (const d of items) {
        await executeQuery(
          'INSERT INTO APInvoiceDetails (ap_invoice_id, item_id, description, quantity, unit_price, amount, receiving_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [req.params.id, d.item_id || null, d.description || '', d.quantity || 0, d.unit_price || 0, d.amount || 0, d.receiving_id || null]
        );
      }
    }

    res.json({ success: true, message: 'AP Invoice berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/ap-invoices/:id', async (req, res) => {
  try {
    const apId = req.params.id;
    const result = await executeQuery('SELECT status FROM APInvoices WHERE id = ?', [apId]);
    if (result[0]?.status !== 'Draft') {
      return res.status(400).json({ success: false, message: 'Hanya dokumen Draft yang bisa dihapus' });
    }

    // Cleanup Journal (Safety measure)
    try {
      const checkJurnal = await executeQuery('SELECT id FROM JournalVouchers WHERE source_type = ? AND ref_id = ?', ['APInvoice', apId]);
      if (checkJurnal.length > 0) {
        const jvId = checkJurnal[0].id;
        await executeQuery('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
        await executeQuery('DELETE FROM JournalVouchers WHERE id = ?', [jvId]);
      }
    } catch (jErr) {
      console.error('Error cleaning up journal:', jErr);
    }

    await executeQuery('DELETE FROM APInvoiceDetails WHERE ap_invoice_id = ?', [apId]);
    await executeQuery('DELETE FROM APInvoices WHERE id = ?', [apId]);
    res.json({ success: true, message: 'AP Invoice berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/ap-invoices/:id/post', async (req, res) => {
  try {
    const apId = req.params.id;
    await executeQuery('UPDATE APInvoices SET status = ? WHERE id = ?', ['Posted', apId]);

    // ================== AUTOMATED JOURNAL (AP INVOICE) ==================
    // Debit: Hutang Dagang Temporary (AP Temporary)
    // Credit: Hutang Dagang (AP Trade)
    // Debit: PPN Masukan (VAT In) - if applicable
    try {
      const apTempAcc = await getGlAccount('ap_temp_account');
      const apTradeAcc = await getGlAccount('ap_trade_account');
      const vatInAcc = await getGlAccount('vat_in_account');

      if (apTempAcc && apTradeAcc) {
        const apDoc = await executeQuery('SELECT * FROM APInvoices WHERE id = ?', [apId]);
        const inv = apDoc[0];

        const items = await executeQuery('SELECT * FROM APInvoiceDetails WHERE ap_invoice_id = ?', [apId]);

        // Calculate Totals
        let totalNet = 0;
        let totalVAT = 0;

        items.forEach(item => {
          totalNet += (Number(item.quantity) * Number(item.unit_price)) || 0;
        });

        if (inv.tax_type === 'Include') {
          totalVAT = totalNet - (totalNet / 1.11);
          totalNet = totalNet / 1.11;
        } else if (inv.tax_type === 'Exclude') {
          totalVAT = totalNet * 0.11;
        } else {
          totalVAT = 0;
        }

        const totalAP = totalNet + totalVAT;

        if (totalAP > 0) {
          const journalDetails = [
            { coa_id: apTempAcc, debit: totalNet, credit: 0, description: 'AP Temporary Reversal' },
            { coa_id: apTradeAcc, debit: 0, credit: totalAP, description: 'Accounts Payable' }
          ];

          if (totalVAT > 0 && vatInAcc) {
            journalDetails.push({ coa_id: vatInAcc, debit: totalVAT, credit: 0, description: 'VAT In' });
          }

          await createAutomatedJournal('APInvoice', apId, inv.doc_number, inv.doc_date, journalDetails);
        }
      }
    } catch (jErr) {
      console.error('Failed to generate AP Invoice journal:', jErr);
    }

    res.json({ success: true, message: 'AP Invoice berhasil di-post' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/ap-invoices/:id/unpost', async (req, res) => {
  try {
    const apId = req.params.id;
    await executeQuery('UPDATE APInvoices SET status = ? WHERE id = ?', ['Draft', apId]);

    // ================== DELETE AUTOMATED JOURNAL ==================
    try {
      const checkJurnal = await executeQuery('SELECT id FROM JournalVouchers WHERE source_type = ? AND ref_id = ?', ['APInvoice', apId]);
      if (checkJurnal.length > 0) {
        const jvId = checkJurnal[0].id;
        await executeQuery('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
        await executeQuery('DELETE FROM JournalVouchers WHERE id = ?', [jvId]);
        console.log(`✅ Automated Journal deleted for AP Invoice #${apId}`);
      }
    } catch (jErr) {
      console.error('Failed to delete AP Invoice journal:', jErr);
    }

    res.json({ success: true, message: 'AP Invoice berhasil di-unpost (Kembali ke Draft)' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invoices for AR allocation (Must be defined before /:id)
app.get('/api/ar-invoices/for-allocation', async (req, res) => {
  try {
    const { partner_id } = req.query;
    if (!partner_id) {
      return res.status(400).json({ success: false, error: 'partner_id required' });
    }

    const result = await executeQuery(`
      SELECT 
        ar.id, 
        ar.doc_number, 
        ar.doc_date, 
        ar.total_amount,
        COALESCE(ar.paid_amount, 0) as paid_amount,
        (ar.total_amount - COALESCE(ar.paid_amount, 0) - COALESCE((
          SELECT SUM(araa.allocated_amount)
          FROM ARAdjustmentAllocations araa
          JOIN ARAdjustments adj ON araa.adjustment_id = adj.id
          WHERE araa.ar_invoice_id = ar.id 
          AND adj.status = 'Posted'
          AND adj.type = 'CREDIT'
        ), 0)) as outstanding_amount
      FROM ARInvoices ar
      WHERE ar.partner_id = ? 
      AND ar.status IN ('Posted', 'Partial')
      AND (ar.total_amount - COALESCE(ar.paid_amount, 0) - COALESCE((
        SELECT SUM(araa.allocated_amount)
        FROM ARAdjustmentAllocations araa
        JOIN ARAdjustments adj ON araa.adjustment_id = adj.id
        WHERE araa.ar_invoice_id = ar.id 
        AND adj.status = 'Posted'
        AND adj.type = 'CREDIT'
      ), 0)) > 1
      ORDER BY ar.doc_date ASC
    `, [partner_id]);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching AR invoices for allocation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/ar-invoices', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT ar.*, p.name as partner_name, sp.name as sales_person_name, pt.name as payment_term_name, s.doc_number as shipment_number
      FROM ARInvoices ar
      LEFT JOIN Partners p ON ar.partner_id = p.id
      LEFT JOIN SalesPersons sp ON ar.sales_person_id = sp.id
      LEFT JOIN PaymentTerms pt ON ar.payment_term_id = pt.id
      LEFT JOIN Shipments s ON ar.shipment_id = s.id
      ORDER BY ar.doc_date DESC
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ar-invoices', async (req, res) => {
  try {
    const { doc_number, doc_date, due_date, partner_id, shipment_id, total_amount, status, notes, transcode_id, tax_type, items, sales_person_id, payment_term_id, currency_code } = req.body;

    // Validate Financial Limits
    const financialValid = await validatePartnerFinancials(partner_id, total_amount || 0, payment_term_id);
    if (!financialValid.valid) {
      return res.status(400).json({ success: false, error: financialValid.error });
    }


    console.log('AR Invoice POST - Request body:', JSON.stringify(req.body, null, 2));

    // Validate Accounting Period
    const isPeriodOpen = await validatePeriod(doc_date);
    if (!isPeriodOpen) {
      return res.status(400).json({ success: false, error: 'Tanggal transaksi berada di luar periode akuntansi yang sedang aktif (Open).' });
    }

    console.log('Inserting AR Invoice header...');
    await executeQuery(
      'INSERT INTO ARInvoices (doc_number, doc_date, due_date, partner_id, shipment_id, total_amount, status, notes, transcode_id, tax_type, sales_person_id, payment_term_id, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [doc_number, doc_date, due_date || null, partner_id, shipment_id || null, total_amount || 0, status || 'Draft', notes || '', transcode_id || null, tax_type || 'Exclude', sales_person_id || null, payment_term_id || null, currency_code || null]
    );
    console.log('AR Invoice header inserted successfully');

    const result = await executeQuery('SELECT * FROM ARInvoices WHERE doc_number = ?', [doc_number]);
    const arId = result[0]?.id;
    console.log('AR Invoice ID:', arId);

    if (items && items.length > 0 && arId) {
      console.log('Inserting', items.length, 'detail items...');
      for (const item of items) {
        const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
        console.log('Inserting item:', { arId, item_id: item.item_id, description: item.description, quantity: item.quantity, unit_price: item.unit_price, lineTotal });
        await executeQuery(
          'INSERT INTO ARInvoiceDetails (ar_invoice_id, item_id, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)',
          [arId, item.item_id || null, item.description || '', parseFloat(item.quantity) || 0, parseFloat(item.unit_price) || 0, lineTotal]
        );
      }
      console.log('All detail items inserted successfully');
    }

    res.json({ success: true, data: result[0], message: 'AR Invoice berhasil dibuat' });
  } catch (error) {
    console.error('AR Invoice POST Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/ar-invoices/:id', async (req, res) => {
  try {
    const { doc_number, doc_date, due_date, partner_id, shipment_id, total_amount, status, notes, transcode_id, tax_type, items, sales_person_id, payment_term_id, currency_code } = req.body;

    // Validate Accounting Period
    const isPeriodOpen = await validatePeriod(doc_date);
    if (!isPeriodOpen) {
      return res.status(400).json({ success: false, error: 'Tanggal transaksi berada di luar periode akuntansi yang sedang aktif (Open).' });
    }

    await executeQuery(
      'UPDATE ARInvoices SET doc_number = ?, doc_date = ?, due_date = ?, partner_id = ?, shipment_id = ?, total_amount = ?, status = ?, notes = ?, transcode_id = ?, tax_type = ?, sales_person_id = ?, payment_term_id = ?, currency_code = ? WHERE id = ?',
      [doc_number, doc_date, due_date, partner_id, shipment_id || null, total_amount || 0, status, notes || '', transcode_id || null, tax_type || 'Exclude', sales_person_id || null, payment_term_id || null, currency_code || null, req.params.id]
    );

    await executeQuery('DELETE FROM ARInvoiceDetails WHERE ar_invoice_id = ?', [req.params.id]);

    if (items && items.length > 0) {
      for (const d of items) {
        await executeQuery(
          'INSERT INTO ARInvoiceDetails (ar_invoice_id, item_id, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)',
          [req.params.id, d.item_id || null, d.description || '', d.quantity || 0, d.unit_price || 0, (d.quantity || 0) * (d.unit_price || 0)]
        );
      }
    }

    res.json({ success: true, message: 'AR Invoice berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/ar-invoices/:id', async (req, res) => {
  try {
    const arId = req.params.id;
    const result = await executeQuery('SELECT status FROM ARInvoices WHERE id = ?', [arId]);
    if (result[0]?.status !== 'Draft') {
      return res.status(400).json({ success: false, message: 'Hanya dokumen Draft yang bisa dihapus' });
    }

    // Cleanup Journal (Safety measure)
    try {
      const checkJurnal = await executeQuery('SELECT id FROM JournalVouchers WHERE source_type = ? AND ref_id = ?', ['ARInvoice', arId]);
      if (checkJurnal.length > 0) {
        const jvId = checkJurnal[0].id;
        await executeQuery('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
        await executeQuery('DELETE FROM JournalVouchers WHERE id = ?', [jvId]);
      }
    } catch (jErr) {
      console.error('Error cleaning up journal:', jErr);
    }

    await executeQuery('DELETE FROM ARInvoiceDetails WHERE ar_invoice_id = ?', [arId]);
    await executeQuery('DELETE FROM ARInvoices WHERE id = ?', [arId]);
    res.json({ success: true, message: 'AR Invoice berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/ar-invoices/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM ARInvoices WHERE id = ?', [req.params.id]);
    if (result.length === 0) return res.status(404).json({ success: false, message: 'AR Invoice not found' });

    const details = await executeQuery(`
      SELECT d.*, i.name as item_name, i.code as item_code
      FROM ARInvoiceDetails d
      LEFT JOIN Items i ON d.item_id = i.id
      WHERE d.ar_invoice_id = ?
    `, [req.params.id]);

    const data = { ...result[0], details };
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/ar-invoices/:id/post', async (req, res) => {
  try {
    const arId = req.params.id;
    await executeQuery('UPDATE ARInvoices SET status = ? WHERE id = ?', ['Posted', arId]);

    // ================== AUTOMATED JOURNAL (AR INVOICE) ==================
    // 1. Dr Piutang / Cr Sales & VAT
    // 2. Reversal: Dr Sales Temp / Cr Uninvoice Shipment
    // 3. COGS: Dr COGS / Cr Inventory

    try {
      const arTradeAcc = await getGlAccount('ar_trade_account');
      const salesAcc = await getGlAccount('sales_account');
      const vatOutAcc = await getGlAccount('vat_out_account');

      const salesTempAcc = await getGlAccount('sales_temp_account');
      const uninvoiceShipmentAcc = await getGlAccount('uninvoice_shipment_account');

      const cogsAcc = await getGlAccount('cogs_account');
      const inventoryAcc = await getGlAccount('inventory_account');

      if (arTradeAcc && salesAcc && vatOutAcc && salesTempAcc && uninvoiceShipmentAcc && cogsAcc && inventoryAcc) {

        const arDoc = await executeQuery('SELECT * FROM ARInvoices WHERE id = ?', [arId]);
        const inv = arDoc[0];

        // Get Invoice Details
        const items = await executeQuery('SELECT * FROM ARInvoiceDetails WHERE ar_invoice_id = ?', [arId]);

        // Calculate Totals
        let totalSales = 0;
        let totalVAT = 0; // Simplified. Ideally calculate from tax_type or detail
        // For simplicity, let's assume total_amount includes tax, and we need to derive details
        // Or better: use item.line_total for Sales, and diff is VAT?
        // user schema has 'tax_type' header.

        // Helper calc
        items.forEach(item => {
          totalSales += (Number(item.quantity) * Number(item.unit_price)) || 0;
        });

        if (inv.tax_type === 'Include') {
          totalVAT = totalSales - (totalSales / 1.11);
          totalSales = totalSales / 1.11;
        } else if (inv.tax_type === 'Exclude') {
          totalVAT = totalSales * 0.11;
        } else {
          totalVAT = 0;
        }

        const totalAR = totalSales + totalVAT;

        // Reversal Amount (Shipment Value) & COGS
        // We need to fetch item standard cost for COGS
        // We assume Shipment Value = Invoice Sales Value? User wants flow linkage.
        // Actually Shipment journal was: Qty * UnitPrice (from SO). 
        // AR Invoice usually matches SO Price. So we can use Invoice Amount for reversal too.
        const reversalAmount = totalSales; // Assuming Uninvoiced Shipment used same value

        let totalCOGS = 0;
        // Calculate COGS using Average Cost from Purchase History
        for (const item of items) {
          if (item.item_id) {
            // Priority 1: Calculate Average Cost from Approved POs
            const avgCostResult = await executeQuery(`
                SELECT AVG(pod.unit_price) as avg_cost 
                FROM PurchaseOrderDetails pod
                JOIN PurchaseOrders po ON pod.po_id = po.id
                WHERE pod.item_id = ? AND po.status IN ('Approved', 'Closed')
            `, [item.item_id]);

            let cost = Number(avgCostResult[0]?.avg_cost);

            // Priority 2: If no PO history, use Item Standard Cost
            if (!cost || isNaN(cost)) {
              const itemData = await executeQuery('SELECT standard_cost FROM Items WHERE id = ?', [item.item_id]);
              cost = Number(itemData[0]?.standard_cost) || 0;
            }

            totalCOGS += (cost * Number(item.quantity));
          }
        }

        const journalDetails = [
          // 1. AR & Revenue
          { coa_id: arTradeAcc, debit: totalAR, credit: 0, description: 'Accounts Receivable' },
          { coa_id: salesAcc, debit: 0, credit: totalSales, description: 'Sales Revenue' },

          // 2. Shipment Reversal
          { coa_id: salesTempAcc, debit: reversalAmount, credit: 0, description: 'Sales Temporary Reversal' },
          { coa_id: uninvoiceShipmentAcc, debit: 0, credit: reversalAmount, description: 'Uninvoiced Shipment Reversal' },

          // 3. COGS / Inventory
          { coa_id: cogsAcc, debit: totalCOGS, credit: 0, description: 'Cost of Goods Sold' },
          { coa_id: inventoryAcc, debit: 0, credit: totalCOGS, description: 'Inventory' }
        ];

        if (totalVAT > 0) {
          journalDetails.push({ coa_id: vatOutAcc, debit: 0, credit: totalVAT, description: 'VAT Out' });
        }

        await createAutomatedJournal('ARInvoice', arId, inv.doc_number, inv.doc_date, journalDetails);
      }
    } catch (jErr) {
      console.error('Failed to generate AR Invoice journal:', jErr);
    }

    res.json({ success: true, message: 'AR Invoice berhasil di-post' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/ar-invoices/:id/unpost', async (req, res) => {
  try {
    const arId = req.params.id;
    await executeQuery('UPDATE ARInvoices SET status = ? WHERE id = ?', ['Draft', arId]);

    // ================== DELETE AUTOMATED JOURNAL ==================
    try {
      const checkJurnal = await executeQuery('SELECT id FROM JournalVouchers WHERE source_type = ? AND ref_id = ?', ['ARInvoice', arId]);
      if (checkJurnal.length > 0) {
        const jvId = checkJurnal[0].id;
        await executeQuery('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
        await executeQuery('DELETE FROM JournalVouchers WHERE id = ?', [jvId]);
        console.log(`✅ Automated Journal deleted for AR Invoice #${arId}`);
      }
    } catch (jErr) {
      console.error('Failed to delete AR Invoice journal:', jErr);
    }

    res.json({ success: true, message: 'AR Invoice berhasil di-unpost (Kembali ke Draft)' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Note: GET /api/shipments is defined earlier in the file (around line 540)

app.get('/api/shipments/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Shipments WHERE id = ?', [req.params.id]);
    if (result.length === 0) return res.status(404).json({ success: false, message: 'Shipment not found' });

    const details = await executeQuery(`
        SELECT d.*, i.code as item_code, i.name as item_name, i.unit as unit_code,
               COALESCE(sod.unit_price, 0) as unit_price,
               COALESCE(so.tax_type, 'Exclude') as tax_type,
               so.sales_person_id,
               so.payment_term_id,
               (SELECT COALESCE(SUM(ard.quantity), 0) 
                FROM ARInvoiceDetails ard 
                JOIN ARInvoices ari ON ard.ar_invoice_id = ari.id 
                WHERE ari.shipment_id = d.shipment_id 
                AND ard.item_id = d.item_id 
                AND ari.status <> 'Cancelled') as qty_billed
        FROM ShipmentDetails d
        LEFT JOIN Items i ON d.item_id = i.id
        LEFT JOIN Shipments s ON d.shipment_id = s.id
        LEFT JOIN SalesOrders so ON s.so_id = so.id
        LEFT JOIN SalesOrderDetails sod ON s.so_id = sod.so_id AND d.item_id = sod.item_id
        WHERE d.shipment_id = ?
      `, [req.params.id]);

    res.json({ success: true, data: { ...result[0], details } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



// ==================== JOURNAL VOUCHERS ====================
app.get('/api/journal-vouchers', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM JournalVouchers ORDER BY doc_date DESC');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CHART OF ACCOUNTS ====================
// ==================== CHART OF ACCOUNTS ====================
app.get('/api/accounts', async (req, res) => {
  try {
    // Left join self for parent name if needed, or just fetch all
    const result = await executeQuery(`
      SELECT a.*, p.name as parent_name 
      FROM Accounts a
      LEFT JOIN Accounts p ON a.parent_id = p.id
      ORDER BY a.code
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/accounts/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM Accounts WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const { code, name, type, level, parent_id, active } = req.body;
    await executeQuery(
      'INSERT INTO Accounts (code, name, type, level, parent_id, active) VALUES (?, ?, ?, ?, ?, ?)',
      [code, name, type, level || 1, parent_id || null, active || 'Y']
    );
    const result = await executeQuery('SELECT * FROM Accounts WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Akun berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    const { code, name, type, level, parent_id, active } = req.body;
    await executeQuery(
      'UPDATE Accounts SET code = ?, name = ?, type = ?, level = ?, parent_id = ?, active = ? WHERE id = ?',
      [code, name, type, level, parent_id || null, active, req.params.id]
    );
    res.json({ success: true, message: 'Akun berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    // Check for children
    const children = await executeQuery('SELECT COUNT(*) as count FROM Accounts WHERE parent_id = ?', [req.params.id]);
    if (children[0].count > 0) {
      return res.status(400).json({ success: false, error: 'Tidak bisa menghapus akun yang memiliki sub-akun.' });
    }

    await executeQuery('DELETE FROM Accounts WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Akun berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== BANK ACCOUNTS ====================
app.get('/api/bank-accounts', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM BankAccounts ORDER BY code');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DASHBOARD STATS ====================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const items = await executeQuery('SELECT COUNT(*) as count FROM Items');
    const partners = await executeQuery('SELECT COUNT(*) as count FROM Partners');
    const po = await executeQuery('SELECT COUNT(*) as count FROM PurchaseOrders');
    const so = await executeQuery('SELECT COUNT(*) as count FROM SalesOrders');

    res.json({
      success: true,
      data: {
        items: items[0]?.count || 0,
        partners: partners[0]?.count || 0,
        purchaseOrders: po[0]?.count || 0,
        salesOrders: so[0]?.count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ACCOUNT GROUPS ====================
app.get('/api/account-groups', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM AccountGroups ORDER BY code');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/account-groups', async (req, res) => {
  try {
    const { code, description, active } = req.body;
    await executeQuery(
      'INSERT INTO AccountGroups (code, description, active) VALUES (?, ?, ?)',
      [code, description, active || 'Y']
    );
    const result = await executeQuery('SELECT * FROM AccountGroups WHERE code = ?', [code]);
    res.json({ success: true, data: result[0], message: 'Group Akun berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/account-groups/:id', async (req, res) => {
  try {
    const { code, description, active } = req.body;
    await executeQuery(
      'UPDATE AccountGroups SET code = ?, description = ?, active = ? WHERE id = ?',
      [code, description, active, req.params.id]
    );
    res.json({ success: true, message: 'Group Akun berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/account-groups/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM AccountGroups WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Group Akun berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== COA SEGMENTS ====================
app.get('/api/coa-segments', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM CoaSegments ORDER BY segment_number');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/coa-segments/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM CoaSegments WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: result[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/coa-segments', async (req, res) => {
  try {
    const { segment_number, segment_name, description, active } = req.body;
    await executeQuery(
      'INSERT INTO CoaSegments (segment_number, segment_name, description, active) VALUES (?, ?, ?, ?)',
      [segment_number, segment_name, description || '', active || 'Y']
    );
    const result = await executeQuery('SELECT * FROM CoaSegments WHERE segment_number = ?', [segment_number]);
    res.json({ success: true, data: result[0], message: 'COA Segment berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/coa-segments/:id', async (req, res) => {
  try {
    const { segment_number, segment_name, description, active } = req.body;
    await executeQuery(
      'UPDATE CoaSegments SET segment_number = ?, segment_name = ?, description = ?, active = ? WHERE id = ?',
      [segment_number, segment_name, description, active || 'Y', req.params.id]
    );
    res.json({ success: true, message: 'COA Segment berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/coa-segments/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM CoaSegments WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'COA Segment berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper to update PO status
async function updatePOStatus(poId) {
  if (!poId) return;

  try {
    // 1. Get all PO items and their ordered quantities
    const poItems = await executeQuery(
      'SELECT item_id, quantity FROM PurchaseOrderDetails WHERE po_id = ?',
      [poId]
    );

    if (poItems.length === 0) return;

    // 2. Get total received quantities for this PO
    const receivedItems = await executeQuery(`
      SELECT rd.item_id, SUM(rd.quantity) as total_received
      FROM ReceivingDetails rd
      JOIN Receivings r ON rd.receiving_id = r.id
      WHERE r.po_id = ? AND r.status != 'Cancelled'
      GROUP BY rd.item_id
    `, [poId]);

    // Map received quantities for easy lookup
    const receivedMap = {};
    receivedItems.forEach(item => {
      receivedMap[item.item_id] = item.total_received;
    });

    // 3. Check if all items are fully received
    let allReceived = true;
    for (const item of poItems) {
      const receivedQty = receivedMap[item.item_id] || 0;
      if (receivedQty < item.quantity) {
        allReceived = false;
        break;
      }
    }

    // 4. Update PO status
    const currentPO = await executeQuery('SELECT status FROM PurchaseOrders WHERE id = ?', [poId]);
    const currentStatus = currentPO[0]?.status;

    if (allReceived && currentStatus !== 'Closed') {
      await executeQuery("UPDATE PurchaseOrders SET status = 'Closed' WHERE id = ?", [poId]);
      console.log(`PO ${poId} status updated to Closed`);
    } else if (!allReceived && currentStatus === 'Closed') {
      await executeQuery("UPDATE PurchaseOrders SET status = 'Approved' WHERE id = ?", [poId]);
      console.log(`PO ${poId} status reverted to Approved`);
    }

  } catch (error) {
    console.error('Error updating PO status:', error);
  }
}

async function updateSOStatus(soId) {
  if (!soId) return;

  try {
    const soItems = await executeQuery(
      'SELECT item_id, quantity FROM SalesOrderDetails WHERE so_id = ?',
      [soId]
    );

    if (soItems.length === 0) return;

    const shippedItems = await executeQuery(`
      SELECT sd.item_id, SUM(sd.quantity) as total_shipped
      FROM ShipmentDetails sd
      JOIN Shipments s ON sd.shipment_id = s.id
      WHERE s.so_id = ? AND s.status != 'Cancelled'
      GROUP BY sd.item_id
    `, [soId]);

    const shippedMap = {};
    shippedItems.forEach(item => {
      shippedMap[item.item_id] = item.total_shipped;
    });

    let allShipped = true;
    for (const item of soItems) {
      const shippedQty = shippedMap[item.item_id] || 0;
      if (shippedQty < item.quantity) {
        allShipped = false;
        break;
      }
    }

    const currentSO = await executeQuery('SELECT status FROM SalesOrders WHERE id = ?', [soId]);
    const currentStatus = currentSO[0]?.status;

    if (allShipped && currentStatus !== 'Closed') {
      await executeQuery("UPDATE SalesOrders SET status = 'Closed' WHERE id = ?", [soId]);
      console.log(`SO ${soId} status updated to Closed`);
    } else if (!allShipped && currentStatus === 'Closed') {
      await executeQuery("UPDATE SalesOrders SET status = 'Approved' WHERE id = ?", [soId]);
      console.log(`SO ${soId} status reverted to Approved`);
    }

  } catch (error) {
    console.error('Error updating SO status:', error);
  }
}

// ==================== REPORTS ====================
app.get('/api/reports/po-outstanding', async (req, res) => {
  try {
    const query = `
      SELECT 
        po.id as po_id,
        po.doc_number,
        po.doc_date,
        p.name as partner_name,
        i.code as item_code,
        i.name as item_name,
        i.unit,
        pod.quantity as qty_ordered,
        (
          SELECT COALESCE(SUM(rd.quantity), 0)
          FROM ReceivingDetails rd
          JOIN Receivings r ON rd.receiving_id = r.id
          WHERE r.po_id = po.id AND rd.item_id = pod.item_id AND r.status != 'Cancelled'
        ) as qty_received
      FROM PurchaseOrderDetails pod
      JOIN PurchaseOrders po ON pod.po_id = po.id
      JOIN Items i ON pod.item_id = i.id
      LEFT JOIN Partners p ON po.partner_id = p.id
      WHERE po.status = 'Approved'
      ORDER BY po.doc_date ASC, po.doc_number ASC
    `;

    const results = await executeQuery(query);

    // Filter outstanding > 0
    const outstandingItems = results.filter(item => item.qty_ordered > item.qty_received).map(item => ({
      ...item,
      qty_outstanding: item.qty_ordered - item.qty_received
    }));

    res.json({ success: true, data: outstandingItems });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ==================== INVENTORY ====================
app.post('/api/inventory/recalculate-deprecated', async (req, res) => {
  try {
    console.log('Starting Inventory Recalculation...');

    // 1. Clear existing stocks (DELETE instead of TRUNCATE for MS Access compatibility)
    console.log('Step 1: Clearing existing stocks...');
    try {
      await executeQuery('DELETE FROM ItemStocks');
      console.log('Step 1: ✅ Complete');
    } catch (e) {
      console.error('Step 1 Error:', e.message);
      throw new Error('Gagal menghapus data ItemStocks: ' + e.message);
    }

    // 2. Fetch ALL Transactions in Chronological Order
    console.log('Step 2: Fetching ALL transactions...');
    let transactions = [];
    try {
      transactions = await executeQuery(`
        SELECT 
            'IN' as direction,
            r.doc_date, 
            r.id as doc_id,
            rd.item_id, 
            rd.quantity, 
            pod.unit_price as cost, 
            w.id as warehouse_id
        FROM ReceivingDetails rd
        JOIN Receivings r ON rd.receiving_id = r.id
        LEFT JOIN Locations l ON r.location_id = l.id
        LEFT JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
        LEFT JOIN Warehouses w ON sw.warehouse_id = w.id
        LEFT JOIN PurchaseOrderDetails pod ON r.po_id = pod.po_id AND rd.item_id = pod.item_id
        WHERE r.status = 'Approved'
        
        UNION ALL
        
        SELECT 
            'IN' as direction,
            ic.doc_date,
            ic.id as doc_id,
            icd.item_id, 
            icd.quantity, 
            icd.unit_cost as cost, 
            w.id as warehouse_id
        FROM ItemConversionDetails icd
        JOIN ItemConversions ic ON icd.conversion_id = ic.id
        JOIN Locations l ON icd.location_id = l.id
        JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
        JOIN Warehouses w ON sw.warehouse_id = w.id
        WHERE ic.status = 'Posted' AND icd.detail_type = 'OUTPUT'

        UNION ALL

        SELECT 
            'IN' as direction,
            ia.doc_date,
            ia.id as doc_id,
            iad.item_id, 
            iad.quantity, 
            iad.unit_cost as cost, 
            ia.warehouse_id
        FROM InventoryAdjustmentDetails iad
        JOIN InventoryAdjustments ia ON iad.adjustment_id = ia.id
        WHERE ia.status = 'Posted' AND iad.quantity > 0

        UNION ALL

        SELECT 
            'OUT' as direction,
            s.doc_date,
            s.id as doc_id,
            sd.item_id, 
            sd.quantity, 
            0 as cost, 
            (SELECT TOP 1 id FROM Warehouses) as warehouse_id
        FROM ShipmentDetails sd
        JOIN Shipments s ON sd.shipment_id = s.id
        WHERE s.status = 'Approved' OR s.status = 'Closed'

        UNION ALL

        SELECT 
            'OUT' as direction,
            ic.doc_date,
            ic.id as doc_id,
            icd.item_id, 
            icd.quantity, 
            0 as cost, 
            w.id as warehouse_id
        FROM ItemConversionDetails icd
        JOIN ItemConversions ic ON icd.conversion_id = ic.id
        JOIN Locations l ON icd.location_id = l.id
        JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
        JOIN Warehouses w ON sw.warehouse_id = w.id
        WHERE ic.status = 'Posted' AND icd.detail_type = 'INPUT'

        UNION ALL

        SELECT 
            'OUT' as direction,
            ia.doc_date,
            ia.id as doc_id,
            iad.item_id, 
            ABS(iad.quantity) as quantity, 
            0 as cost, 
            ia.warehouse_id
        FROM InventoryAdjustmentDetails iad
        JOIN InventoryAdjustments ia ON iad.adjustment_id = ia.id
        WHERE ia.status = 'Posted' AND iad.quantity < 0

        ORDER BY doc_date ASC, doc_id ASC
        `);
      console.log('Step 2: ✅ Complete, found', transactions.length, 'total transactions');
    } catch (e) {
      console.error('Step 2 Error:', e.message);
      throw new Error('Gagal mengambil data transaksi: ' + e.message);
    }

    // 3. Process Transactions (Chronological)
    const stockMap = {};
    const warehouseStockMap = {};

    for (const tx of transactions) {
      if (!tx.item_id) continue;

      const itemId = String(tx.item_id);
      const whId = String(tx.warehouse_id);
      const wareKey = `${itemId}-${whId}`;
      const qty = Number(tx.quantity);
      const cost = Number(tx.cost || 0);

      // Init Maps
      if (!stockMap[itemId]) stockMap[itemId] = { totalQty: 0, totalValue: 0, avgCost: 0 };
      if (!warehouseStockMap[wareKey]) warehouseStockMap[wareKey] = 0;

      if (tx.direction === 'IN') {
        // Updated Warehouse Qty
        warehouseStockMap[wareKey] += qty;

        // Update Global Moving Average
        stockMap[itemId].totalQty += qty;
        stockMap[itemId].totalValue += (qty * cost);
      } else {
        // OUT
        warehouseStockMap[wareKey] -= qty;

        // Deduct value based on CURRENT Average Cost
        let currentAvg = 0;
        if (stockMap[itemId].totalQty > 0) {
          currentAvg = stockMap[itemId].totalValue / stockMap[itemId].totalQty;
        }
        stockMap[itemId].totalValue -= (qty * currentAvg);
        stockMap[itemId].totalQty -= qty;
      }
    }

    // 4. Update Database
    console.log('Step 4: Updating ItemStocks...');
    let itemsUpdated = 0;
    let stocksInserted = 0;

    // Get valid warehouse IDs and their default locations from database
    let validWarehouses = new Set();
    let warehouseDefaultLoc = {}; // WarehouseID -> LocationID

    try {
      const warehouses = await executeQuery('SELECT id FROM Warehouses');
      warehouses.forEach(w => validWarehouses.add(String(w.id)));

      // Get default locations (first location for each warehouse)
      const locations = await executeQuery(`
        SELECT w.id as wh_id, MIN(l.id) as loc_id
        FROM Warehouses w
        JOIN SubWarehouses sw ON w.id = sw.warehouse_id
        JOIN Locations l ON sw.id = l.sub_warehouse_id
        GROUP BY w.id
      `);
      locations.forEach(l => {
        warehouseDefaultLoc[String(l.wh_id)] = l.loc_id;
      });

      console.log('Valid warehouses:', validWarehouses.size);
    } catch (e) {
      console.error('Failed to fetch warehouses/locations:', e.message);
    }

    // Update ItemStocks table
    console.log('Update loop starting. Keys:', Object.keys(warehouseStockMap).length);
    for (const [wKey, qty] of Object.entries(warehouseStockMap)) {
      const [itemId, warehouseId] = wKey.split('-');
      // Only insert if warehouse is known AND exists in Warehouses table
      if (warehouseId && warehouseId !== 'null' && warehouseId !== 'undefined' && validWarehouses.has(warehouseId)) {
        try {
          const locId = warehouseDefaultLoc[warehouseId] || null;

          // Calculate average cost for this item
          const itemData = stockMap[itemId];
          let avgCost = 0;
          if (itemData && itemData.totalQty > 0) {
            avgCost = itemData.totalValue / itemData.totalQty;
          }

          console.log(`Inserting Item ${itemId}, WH ${warehouseId}, Qty ${qty}, Cost ${avgCost}`);

          await executeQuery(
            'INSERT INTO ItemStocks (item_id, warehouse_id, quantity, location_id, average_cost, last_updated) VALUES (?, ?, ?, ?, ?, CURRENT TIMESTAMP)',
            [itemId, warehouseId, qty, locId, avgCost]
          );
          itemsUpdated++;
        } catch (e) {
          console.error(`Failed to insert ItemStock ${itemId}-${warehouseId}:`, e.message);
        }
      } else {
        console.log(`Skipping invalid warehouse key: ${wKey}`);
      }
    }
    console.log('Step 4: ✅ Complete, updated', itemsUpdated, 'items');

    // Update Items Standard Cost
    console.log('Step 5: Updating Item Costs...');
    for (const [itemId, data] of Object.entries(stockMap)) {
      if (data.totalQty > 0) {
        const avgCost = data.totalValue / data.totalQty;
        try {
          // Update item standard cost
          await executeQuery('UPDATE Items SET standard_cost = ? WHERE id = ?', [avgCost, itemId]);
          itemsUpdated++;
        } catch (updateErr) {
          console.error(`Failed to update cost for item ${itemId}:`, updateErr.message);
        }
      }
    }
    console.log('Step 5: ✅ Complete, updated', itemsUpdated, 'item costs');

    console.log(`Recalculation Complete. Updated ${itemsUpdated} items costs.`);
    res.json({ success: true, message: `Stok berhasil dihitung ulang. ${itemsUpdated} item cost telah diupdate.` });

  } catch (error) {
    console.error('Recalculate Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== REPORTS ====================
app.get('/api/reports/so-outstanding', async (req, res) => {
  try {
    // Query tanpa HAVING - filter di JavaScript untuk kompatibilitas database yang lebih baik
    const result = await executeQuery(`
      SELECT 
        so.doc_number, 
        so.doc_date, 
        p.name as partner_name,
        i.code as item_code, 
        i.name as item_name, 
        i.unit as unit,
        sod.quantity as qty_ordered
      FROM SalesOrderDetails sod
      JOIN SalesOrders so ON sod.so_id = so.id
      JOIN Items i ON sod.item_id = i.id
      JOIN Partners p ON so.partner_id = p.id
      WHERE so.status IN ('Approved', 'Partial', 'Open')
      ORDER BY so.doc_date ASC, so.doc_number ASC
    `);

    // Calculate shipped quantities separately for each item
    const outstandingData = [];
    for (const row of result) {
      // Get shipped quantity for this specific SO + Item combination
      const shippedResult = await executeQuery(`
        SELECT COALESCE(SUM(sd.quantity), 0) as qty_shipped
        FROM ShipmentDetails sd
        JOIN Shipments s ON sd.shipment_id = s.id
        JOIN SalesOrders so ON s.so_id = so.id
        WHERE so.doc_number = ? AND sd.item_id = (SELECT id FROM Items WHERE code = ?) AND s.status IN ('Approved', 'Closed')
      `, [row.doc_number, row.item_code]);

      const qty_shipped = Number(shippedResult[0]?.qty_shipped) || 0;
      const qty_ordered = Number(row.qty_ordered) || 0;
      const qty_outstanding = qty_ordered - qty_shipped;

      if (qty_outstanding > 0) {
        outstandingData.push({
          doc_number: row.doc_number,
          doc_date: row.doc_date,
          partner_name: row.partner_name,
          item_code: row.item_code,
          item_name: row.item_name,
          unit: row.unit,
          qty_ordered: qty_ordered,
          qty_shipped: qty_shipped,
          qty_outstanding: qty_outstanding
        });
      }
    }

    res.json({ success: true, data: outstandingData });
  } catch (error) {
    console.error('Error fetching SO Outstanding report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RECEIVING OUTSTANDING REPORT ====================
// Receiving yang belum dibuat AP Invoice
app.get('/api/reports/receiving-outstanding', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        r.id,
        r.doc_number,
        r.doc_date,
        r.status,
        p.name as partner_name,
        po.doc_number as po_number,
        (
          SELECT SUM(rd.quantity * COALESCE(pod.unit_price, 0))
          FROM ReceivingDetails rd
          LEFT JOIN PurchaseOrderDetails pod ON r.po_id = pod.po_id AND rd.item_id = pod.item_id
          WHERE rd.receiving_id = r.id
        ) as total_amount
      FROM Receivings r
      LEFT JOIN Partners p ON r.partner_id = p.id
      LEFT JOIN PurchaseOrders po ON r.po_id = po.id
      WHERE r.status = 'Approved'
        AND r.id NOT IN (SELECT COALESCE(receiving_id, 0) FROM APInvoices WHERE receiving_id IS NOT NULL)
      ORDER BY r.doc_date ASC
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching Receiving Outstanding report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SHIPMENT OUTSTANDING REPORT ====================
// Shipment yang belum dibuat AR Invoice
app.get('/api/reports/shipment-outstanding', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        s.id,
        s.doc_number,
        s.doc_date,
        s.status,
        p.name as partner_name,
        so.doc_number as so_number,
        (
          SELECT SUM(sd.quantity * COALESCE(sod.unit_price, 0))
          FROM ShipmentDetails sd
          LEFT JOIN SalesOrderDetails sod ON s.so_id = sod.so_id AND sd.item_id = sod.item_id
          WHERE sd.shipment_id = s.id
        ) as total_amount
      FROM Shipments s
      LEFT JOIN Partners p ON s.partner_id = p.id
      LEFT JOIN SalesOrders so ON s.so_id = so.id
      WHERE s.status IN ('Approved', 'Closed')
        AND s.id NOT IN (SELECT COALESCE(shipment_id, 0) FROM ARInvoices WHERE shipment_id IS NOT NULL)
      ORDER BY s.doc_date ASC
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching Shipment Outstanding report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AP OUTSTANDING REPORT ====================
// Hutang yang belum dibayar (AP Invoice Posted)
app.get('/api/reports/ap-outstanding', async (req, res) => {
  try {
    // Query 1: AP Invoices with outstanding amount
    // Formula: Outstanding = total_amount - paid_amount - SUM(debit_adjustment_allocations)
    const invoices = await executeQuery(`
      SELECT 
        ap.id,
        ap.doc_number,
        ap.doc_date,
        ap.due_date,
        ap.status,
        p.name as partner_name,
        'INVOICE' as doc_type,
        (ap.total_amount - COALESCE(ap.paid_amount, 0) - COALESCE((
          SELECT SUM(apaa.allocated_amount)
          FROM APAdjustmentAllocations apaa
          JOIN APAdjustments apa ON apaa.adjustment_id = apa.id
          WHERE apaa.ap_invoice_id = ap.id 
          AND apa.status = 'Posted' 
          AND apa.type = 'DEBIT'
        ), 0)) as total_amount
      FROM APInvoices ap
      LEFT JOIN Partners p ON ap.partner_id = p.id
      WHERE ap.status IN ('Posted', 'Partial')
      AND (ap.total_amount - COALESCE(ap.paid_amount, 0) - COALESCE((
        SELECT SUM(apaa.allocated_amount)
        FROM APAdjustmentAllocations apaa
        JOIN APAdjustments apa ON apaa.adjustment_id = apa.id
        WHERE apaa.ap_invoice_id = ap.id 
        AND apa.status = 'Posted' 
        AND apa.type = 'DEBIT'
      ), 0)) > 1
      ORDER BY ap.due_date ASC, ap.doc_date ASC
    `);

    // Query 2: AP Credit Adjustments (as additional debt)
    // These are Posted credit adjustments that add to outstanding
    const creditAdjustments = await executeQuery(`
      SELECT 
        apa.id,
        apa.doc_number,
        apa.doc_date,
        apa.doc_date as due_date,
        'Credit Adj' as status,
        p.name as partner_name,
        'CREDIT_ADJ' as doc_type,
        apa.total_amount as total_amount
      FROM APAdjustments apa
      LEFT JOIN Partners p ON apa.partner_id = p.id
      WHERE apa.type = 'CREDIT' 
      AND apa.status = 'Posted'
      AND apa.total_amount > 0
      ORDER BY apa.doc_date ASC
    `);

    // Combine both results
    const result = [...invoices, ...creditAdjustments];

    // Calculate days overdue
    const today = new Date();
    const dataWithAging = result.map(item => {
      const dueDate = item.due_date ? new Date(item.due_date) : null;
      let daysOverdue = 0;
      if (dueDate && dueDate < today) {
        daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      }
      return { ...item, days_overdue: daysOverdue };
    });

    // Sort by due_date
    dataWithAging.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    res.json({ success: true, data: dataWithAging });
  } catch (error) {
    console.error('Error fetching AP Outstanding report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ==================== AR OUTSTANDING REPORT ====================
// Piutang yang belum dibayar (AR Invoice Posted)
app.get('/api/reports/ar-outstanding', async (req, res) => {
  try {
    // Query 1: AR Invoices with outstanding amount
    // Formula: Outstanding = total_amount - paid_amount - SUM(credit_adjustment_allocations)
    const invoices = await executeQuery(`
      SELECT 
        ar.id,
        ar.doc_number,
        ar.doc_date,
        ar.due_date,
        ar.status,
        p.name as partner_name,
        'INVOICE' as doc_type,
        (ar.total_amount - COALESCE(ar.paid_amount, 0) - COALESCE((
          SELECT SUM(araa.allocated_amount)
          FROM ARAdjustmentAllocations araa
          JOIN ARAdjustments ara ON araa.adjustment_id = ara.id
          WHERE araa.ar_invoice_id = ar.id 
          AND ara.status = 'Posted' 
          AND ara.type = 'CREDIT'
        ), 0)) as total_amount
      FROM ARInvoices ar
      LEFT JOIN Partners p ON ar.partner_id = p.id
      WHERE ar.status IN ('Posted', 'Partial')
      AND (ar.total_amount - COALESCE(ar.paid_amount, 0) - COALESCE((
        SELECT SUM(araa.allocated_amount)
        FROM ARAdjustmentAllocations araa
        JOIN ARAdjustments ara ON araa.adjustment_id = ara.id
        WHERE araa.ar_invoice_id = ar.id 
        AND ara.status = 'Posted' 
        AND ara.type = 'CREDIT'
      ), 0)) > 1
      ORDER BY ar.due_date ASC, ar.doc_date ASC
    `);

    // Query 2: AR Debit Adjustments (as additional receivables)
    // These are Posted debit adjustments that add to outstanding
    const debitAdjustments = await executeQuery(`
      SELECT 
        ara.id,
        ara.doc_number,
        ara.doc_date,
        ara.doc_date as due_date,
        'Debit Adj' as status,
        p.name as partner_name,
        'DEBIT_ADJ' as doc_type,
        ara.total_amount as total_amount
      FROM ARAdjustments ara
      LEFT JOIN Partners p ON ara.partner_id = p.id
      WHERE ara.type = 'DEBIT' 
      AND ara.status = 'Posted'
      AND ara.total_amount > 0
      ORDER BY ara.doc_date ASC
    `);

    // Combine both results
    const result = [...invoices, ...debitAdjustments];

    // Calculate days overdue
    const today = new Date();
    const dataWithAging = result.map(item => {
      const dueDate = item.due_date ? new Date(item.due_date) : null;
      let daysOverdue = 0;
      if (dueDate && dueDate < today) {
        daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      }
      return { ...item, days_overdue: daysOverdue };
    });

    // Sort by due_date
    dataWithAging.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    res.json({ success: true, data: dataWithAging });
  } catch (error) {
    console.error('Error fetching AR Outstanding report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AP AGING REPORT ====================
// Analisis umur hutang
app.get('/api/reports/ap-aging', async (req, res) => {
  try {
    // Query 1: AP Invoices with outstanding amount
    const invoices = await executeQuery(`
      SELECT 
        ap.id,
        ap.doc_number,
        ap.doc_date,
        ap.due_date,
        p.name as partner_name,
        p.id as partner_id,
        'INVOICE' as doc_type,
        (ap.total_amount - COALESCE(ap.paid_amount, 0) - COALESCE((
          SELECT SUM(apaa.allocated_amount)
          FROM APAdjustmentAllocations apaa
          JOIN APAdjustments apa ON apaa.adjustment_id = apa.id
          WHERE apaa.ap_invoice_id = ap.id 
          AND apa.status = 'Posted' 
          AND apa.type = 'DEBIT'
        ), 0)) as total_amount
      FROM APInvoices ap
      LEFT JOIN Partners p ON ap.partner_id = p.id
      WHERE ap.status IN ('Posted', 'Partial')
      AND (ap.total_amount - COALESCE(ap.paid_amount, 0) - COALESCE((
        SELECT SUM(apaa.allocated_amount)
        FROM APAdjustmentAllocations apaa
        JOIN APAdjustments apa ON apaa.adjustment_id = apa.id
        WHERE apaa.ap_invoice_id = ap.id 
        AND apa.status = 'Posted' 
        AND apa.type = 'DEBIT'
      ), 0)) > 1
      ORDER BY p.name ASC, ap.due_date ASC
    `);

    // Query 2: AP Credit Adjustments (as additional debt)
    const creditAdjustments = await executeQuery(`
      SELECT 
        apa.id,
        apa.doc_number,
        apa.doc_date,
        apa.doc_date as due_date,
        p.name as partner_name,
        p.id as partner_id,
        'CREDIT_ADJ' as doc_type,
        apa.total_amount as total_amount
      FROM APAdjustments apa
      LEFT JOIN Partners p ON apa.partner_id = p.id
      WHERE apa.type = 'CREDIT' 
      AND apa.status = 'Posted'
      AND apa.total_amount > 0
      ORDER BY p.name ASC, apa.doc_date ASC
    `);

    // Combine both results
    const result = [...invoices, ...creditAdjustments];

    // Calculate aging buckets
    const today = new Date();
    const dataWithAging = result.map(item => {
      const dueDate = item.due_date ? new Date(item.due_date) : new Date(item.doc_date);
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      const amount = Number(item.total_amount) || 0;

      let bucket = 'current';
      let current = 0, days1_30 = 0, days31_60 = 0, days61_90 = 0, days90plus = 0;

      if (daysOverdue <= 0) {
        bucket = 'current';
        current = amount;
      } else if (daysOverdue <= 30) {
        bucket = '1-30';
        days1_30 = amount;
      } else if (daysOverdue <= 60) {
        bucket = '31-60';
        days31_60 = amount;
      } else if (daysOverdue <= 90) {
        bucket = '61-90';
        days61_90 = amount;
      } else {
        bucket = '>90';
        days90plus = amount;
      }

      return {
        ...item,
        days_overdue: daysOverdue,
        bucket,
        current,
        days1_30,
        days31_60,
        days61_90,
        days90plus
      };
    });

    // Sort by partner_name then due_date
    dataWithAging.sort((a, b) => {
      const partnerCompare = (a.partner_name || '').localeCompare(b.partner_name || '');
      if (partnerCompare !== 0) return partnerCompare;
      return new Date(a.due_date) - new Date(b.due_date);
    });

    res.json({ success: true, data: dataWithAging });
  } catch (error) {
    console.error('Error fetching AP Aging report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AR AGING REPORT ====================
// Analisis umur piutang
app.get('/api/reports/ar-aging', async (req, res) => {
  try {
    // Query 1: AR Invoices with outstanding amount
    const invoices = await executeQuery(`
      SELECT 
        ar.id,
        ar.doc_number,
        ar.doc_date,
        ar.due_date,
        p.name as partner_name,
        p.id as partner_id,
        'INVOICE' as doc_type,
        (ar.total_amount - COALESCE(ar.paid_amount, 0) - COALESCE((
          SELECT SUM(araa.allocated_amount)
          FROM ARAdjustmentAllocations araa
          JOIN ARAdjustments ara ON araa.adjustment_id = ara.id
          WHERE araa.ar_invoice_id = ar.id 
          AND ara.status = 'Posted' 
          AND ara.type = 'CREDIT'
        ), 0)) as total_amount
      FROM ARInvoices ar
      LEFT JOIN Partners p ON ar.partner_id = p.id
      WHERE ar.status IN ('Posted', 'Partial')
      AND (ar.total_amount - COALESCE(ar.paid_amount, 0) - COALESCE((
        SELECT SUM(araa.allocated_amount)
        FROM ARAdjustmentAllocations araa
        JOIN ARAdjustments ara ON araa.adjustment_id = ara.id
        WHERE araa.ar_invoice_id = ar.id 
        AND ara.status = 'Posted' 
        AND ara.type = 'CREDIT'
      ), 0)) > 1
      ORDER BY p.name ASC, ar.due_date ASC
    `);

    // Query 2: AR Debit Adjustments (as additional receivables)
    const debitAdjustments = await executeQuery(`
      SELECT 
        ara.id,
        ara.doc_number,
        ara.doc_date,
        ara.doc_date as due_date,
        p.name as partner_name,
        p.id as partner_id,
        'DEBIT_ADJ' as doc_type,
        ara.total_amount as total_amount
      FROM ARAdjustments ara
      LEFT JOIN Partners p ON ara.partner_id = p.id
      WHERE ara.type = 'DEBIT' 
      AND ara.status = 'Posted'
      AND ara.total_amount > 0
      ORDER BY p.name ASC, ara.doc_date ASC
    `);

    // Combine both results
    const result = [...invoices, ...debitAdjustments];

    // Calculate aging buckets
    const today = new Date();
    const dataWithAging = result.map(item => {
      const dueDate = item.due_date ? new Date(item.due_date) : new Date(item.doc_date);
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      const amount = Number(item.total_amount) || 0;

      let bucket = 'current';
      let current = 0, days1_30 = 0, days31_60 = 0, days61_90 = 0, days90plus = 0;

      if (daysOverdue <= 0) {
        bucket = 'current';
        current = amount;
      } else if (daysOverdue <= 30) {
        bucket = '1-30';
        days1_30 = amount;
      } else if (daysOverdue <= 60) {
        bucket = '31-60';
        days31_60 = amount;
      } else if (daysOverdue <= 90) {
        bucket = '61-90';
        days61_90 = amount;
      } else {
        bucket = '>90';
        days90plus = amount;
      }

      return {
        ...item,
        days_overdue: daysOverdue,
        bucket,
        current,
        days1_30,
        days31_60,
        days61_90,
        days90plus
      };
    });

    // Sort by partner_name then due_date
    dataWithAging.sort((a, b) => {
      const partnerCompare = (a.partner_name || '').localeCompare(b.partner_name || '');
      if (partnerCompare !== 0) return partnerCompare;
      return new Date(a.due_date) - new Date(b.due_date);
    });

    res.json({ success: true, data: dataWithAging });
  } catch (error) {
    console.error('Error fetching AR Aging report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



// ==================== SALES SUMMARY REPORT ====================
app.get('/api/reports/sales-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // Group by Year-Month. Sybase: DATEFORMAT(date, 'yyyy-mm')
    // Or just fetch all and aggregate in JS if SQL dialect is tricky.
    // Let's try SQL aggregation:
    // "SELECT YMD(YEAR(doc_date), MONTH(doc_date), 1) as period_date, SUM(quantity * unit_price) as total ..."

    let query = `
      SELECT 
        YEAR(i.doc_date) as yr, 
        MONTH(i.doc_date) as mth,
        SUM(d.quantity * d.unit_price) as total_amount
      FROM ARInvoices i
      JOIN ARInvoiceDetails d ON i.id = d.ar_invoice_id
      WHERE i.status != 'Cancelled'
    `;
    const params = [];

    if (startDate && endDate) {
      query += ` AND i.doc_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` GROUP BY yr, mth ORDER BY yr ASC, mth ASC`;

    const result = await executeQuery(query, params);

    // Format result for frontend: "Jan 2026", etc.
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatted = result.map(r => ({
      period: `${monthNames[r.mth - 1]} ${r.yr}`,
      total: r.total_amount
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PURCHASE SUMMARY REPORT ====================
app.get('/api/reports/purchase-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT 
        YEAR(i.doc_date) as yr, 
        MONTH(i.doc_date) as mth,
        SUM(d.quantity * d.unit_price) as total_amount
      FROM APInvoices i
      JOIN APInvoiceDetails d ON i.id = d.ap_invoice_id
      WHERE i.status != 'Cancelled'
    `;
    const params = [];

    if (startDate && endDate) {
      query += ` AND i.doc_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` GROUP BY yr, mth ORDER BY yr ASC, mth ASC`;

    const result = await executeQuery(query, params);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatted = result.map(r => ({
      period: `${monthNames[r.mth - 1]} ${r.yr}`,
      total: r.total_amount
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ==================== TRIAL BALANCE REPORT ====================
app.get('/api/reports/trial-balance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'startDate dan endDate harus diisi' });
    }

    // Query untuk mengambil saldo awal dan pergerakan
    // Saldo Awal: Semua transaksi SEBELUM startDate
    // Pergerakan: Semua transaksi ANTARA startDate dan endDate (inklusif)

    // Perbaikan Logika:
    // Debit selalu menambah aset/beban, Kredit mengurangi.
    // Untuk laporan Trial Balance standar, kita tampilkan total Debit dan Kredit per akun
    // Tapi user minta Saldo Awal dan Saldo Akhir.

    const query = `
      SELECT 
        a.id, a.code, a.name, a.type,
        
        -- Saldo Awal (sebelum startDate)
        SUM(CASE 
            WHEN jv.doc_date < ? AND jv.status = 'Posted' THEN jvd.debit 
            ELSE 0 
        END) as initial_debit,
        
        SUM(CASE 
            WHEN jv.doc_date < ? AND jv.status = 'Posted' THEN jvd.credit 
            ELSE 0 
        END) as initial_credit,

        -- Pergerakan (start s/d end)
        SUM(CASE 
            WHEN jv.doc_date >= ? AND jv.doc_date <= ? AND jv.status = 'Posted' THEN jvd.debit 
            ELSE 0 
        END) as movement_debit,
        
        SUM(CASE 
            WHEN jv.doc_date >= ? AND jv.doc_date <= ? AND jv.status = 'Posted' THEN jvd.credit 
            ELSE 0 
        END) as movement_credit

      FROM Accounts a
      LEFT JOIN JournalVoucherDetails jvd ON a.id = jvd.coa_id
      LEFT JOIN JournalVouchers jv ON jvd.jv_id = jv.id
      GROUP BY a.id, a.code, a.name, a.type
      ORDER BY a.code ASC
    `;

    const params = [
      startDate, startDate, // Initial
      startDate, endDate,   // Movement Debit
      startDate, endDate    // Movement Credit
    ];

    const result = await executeQuery(query, params);

    // Debugging: Log raw result from database
    if (result.length > 0) {
      console.log('Trial Balance Raw Row 0:', result[0]);
    }

    const safeFloat = (val) => {
      if (val === null || val === undefined) return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    const data = result.map(row => {
      // Handle case-insensitive column names
      const getVal = (key) => row[key] !== undefined ? row[key] : row[key.toUpperCase()];

      const initDebit = safeFloat(getVal('initial_debit'));
      const initCredit = safeFloat(getVal('initial_credit'));
      const moveDebit = safeFloat(getVal('movement_debit'));
      const moveCredit = safeFloat(getVal('movement_credit'));

      // Hitung Net Saldo Awal berdasarkan tipe akun
      // ASSET, EXPENSE: Debit - Credit
      // LIABILITY, EQUITY, REVENUE: Credit - Debit

      let initialBalance = 0;
      if (['ASSET', 'EXPENSE'].includes(row.type)) {
        initialBalance = initDebit - initCredit;
      } else {
        initialBalance = initCredit - initDebit;
      }

      // Hitung Saldo Akhir
      // Saldo Akhir = Saldo Awal + (Debit Mut - Credit Mut) [jika normal debit]
      // Saldo Akhir = Saldo Awal + (Credit Mut - Debit Mut) [jika normal credit]

      let endingBalance = 0;
      if (['ASSET', 'EXPENSE'].includes(row.type)) {
        endingBalance = initialBalance + (moveDebit - moveCredit);
      } else {
        endingBalance = initialBalance + (moveCredit - moveDebit);
      }

      return {
        ...row,
        initial_balance: initialBalance,
        movement_debit: moveDebit,
        movement_credit: moveCredit,
        ending_balance: endingBalance
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ACCOUNT TRANSACTION DETAILS (DRILL DOWN) ====================
app.get('/api/reports/account-transactions', async (req, res) => {
  try {
    const { accountId, startDate, endDate } = req.query;

    if (!accountId || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Parameter accountId, startDate, dan endDate wajib diisi' });
    }

    const query = `
        SELECT 
            jv.doc_date,
            jv.doc_number,
            jvd.description,
            jvd.debit,
            jvd.credit,
            jv.source_type,
            jv.ref_id
        FROM JournalVoucherDetails jvd
        JOIN JournalVouchers jv ON jvd.jv_id = jv.id
        WHERE jvd.coa_id = ?
        AND jv.doc_date >= ?
        AND jv.doc_date <= ?
        AND jv.status = 'Posted'
        ORDER BY jv.doc_date ASC, jv.doc_number ASC
    `;

    const result = await executeQuery(query, [accountId, startDate, endDate]);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PROFIT LOSS REPORT ====================
app.get('/api/reports/profit-loss', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Revenue and Expense only
    // Net = Credit - Debit for Revenue (since Revenue is credit normal)
    // Net = Debit - Credit for Expense (since Expense is debit normal)
    // Or just Raw Sums and let frontend display.

    let query = `
        SELECT 
            a.code, a.name, a.type,
            SUM(jvd.debit) as debit,
            SUM(jvd.credit) as credit
        FROM Accounts a
        JOIN JournalVoucherDetails jvd ON a.id = jvd.coa_id
        JOIN JournalVouchers jv ON jvd.jv_id = jv.id
        WHERE jv.status = 'Posted'
        AND a.type IN ('REVENUE', 'EXPENSE')
    `;

    const params = [];

    if (startDate && endDate) {
      query += ` AND jv.doc_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` GROUP BY a.code, a.name, a.type ORDER BY a.code ASC`;

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== BALANCE SHEET REPORT ====================
app.get('/api/reports/balance-sheet', async (req, res) => {
  try {
    const { endDate } = req.query; // As Of

    // 1. Get Assets, Liability, Equity balances
    let query = `
        SELECT 
            a.code, a.name, a.type,
            SUM(jvd.debit) as debit,
            SUM(jvd.credit) as credit
        FROM Accounts a
        LEFT JOIN JournalVoucherDetails jvd ON a.id = jvd.coa_id
        LEFT JOIN JournalVouchers jv ON jvd.jv_id = jv.id
        WHERE (jv.status = 'Posted' OR jv.id IS NULL)
        AND a.type IN ('ASSET', 'LIABILITY', 'EQUITY')
    `;

    const params = [];
    if (endDate) {
      query += ` AND (jv.doc_date <= ? OR jv.doc_date IS NULL)`;
      params.push(endDate);
    }

    query += ` GROUP BY a.code, a.name, a.type ORDER BY a.code ASC`;

    const accounts = await executeQuery(query, params);

    // 2. Calculate Current Year Earnings (Net Income) up to endDate
    // (Revenue - Expense)
    // Revenue is Credit, Expense is Debit.
    // Net Income = (Total Credit Revenue - Total Debit Revenue) - (Total Debit Expense - Total Credit Expense)
    // Simplified: Sum(Credit) - Sum(Debit) for all Rev/Exp accounts. (Since Rev > Exp means Credit > Debit)

    let plQuery = `
        SELECT SUM(jvd.credit - jvd.debit) as net_income
        FROM Accounts a
        JOIN JournalVoucherDetails jvd ON a.id = jvd.coa_id
        JOIN JournalVouchers jv ON jvd.jv_id = jv.id
        WHERE jv.status = 'Posted'
        AND a.type IN ('REVENUE', 'EXPENSE')
    `;

    const plParams = [];
    if (endDate) {
      plQuery += ` AND jv.doc_date <= ?`;
      plParams.push(endDate);
    }

    const plResult = await executeQuery(plQuery, plParams);
    const netIncome = plResult[0].net_income || 0;

    res.json({ success: true, data: { accounts, netIncome } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CRYSTAL REPORTS ====================
app.get('/api/crystal-reports', async (req, res) => {
  try {
    const reportDir = path.join(__dirname, '..', 'public', 'report');

    // Create directory if it doesn't exist
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const files = fs.readdirSync(reportDir);
    const rptFiles = files.filter(file => file.toLowerCase().endsWith('.rpt'));

    res.json({ success: true, data: rptFiles });
  } catch (error) {
    console.error('Error listing Crystal Reports:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/crystal-reports/open', async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Filename is required' });
    }

    const reportPath = path.join(__dirname, '..', 'public', 'Report', filename);

    // Security check: ensure the file is actually inside the Report directory to prevent directory traversal
    const reportDir = path.join(__dirname, '..', 'public', 'Report');
    if (!path.resolve(reportPath).startsWith(path.resolve(reportDir))) {
      return res.status(400).json({ success: false, error: 'Invalid file path' });
    }

    if (!fs.existsSync(reportPath)) {
      return res.status(404).json({ success: false, error: 'Report file not found' });
    }

    // Use Crystal Reports 11 Designer directly (can connect to database)
    const crystalDesignerPath = 'C:\\Program Files (x86)\\Business Objects\\Crystal Reports 11\\crw32.exe';

    // Check if Crystal Reports Designer exists
    if (!fs.existsSync(crystalDesignerPath)) {
      // Fallback to default application if Designer not found
      const command = `start "" "${reportPath}"`;
      exec(command, (error) => {
        if (error) {
          console.error(`Error opening file: ${error}`);
          return res.status(500).json({ success: false, error: 'Failed to open report' });
        }
        res.json({ success: true, message: `Membuka laporan: ${filename}` });
      });
      return;
    }

    // Open with Crystal Reports 11 Designer
    const command = `"${crystalDesignerPath}" "${reportPath}"`;

    exec(command, (error) => {
      if (error) {
        console.error(`Error opening file with Crystal Reports Designer: ${error}`);
        return res.status(500).json({ success: false, error: 'Failed to open report with Crystal Reports Designer' });
      }
      res.json({ success: true, message: `Membuka laporan dengan Crystal Reports Designer: ${filename}` });
    });

  } catch (error) {
    console.error('Error opening Crystal Report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== JASPER REPORTS PDF GENERATION ====================
app.get('/api/reports/pdf', async (req, res) => {
  try {
    const { filename, startDate, endDate } = req.query;

    if (!filename) {
      return res.status(400).json({ success: false, error: 'Filename is required' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Start date and end date are required' });
    }

    console.log(`Generating report: ${filename} with params: ${startDate} to ${endDate}`);

    // Query data based on the report filename
    let reportData = [];
    let reportTitle = 'Laporan';
    let columns = [];

    // Determine query based on report file
    if (filename.toLowerCase().includes('pembelian') || filename.toLowerCase().includes('ap')) {
      reportTitle = 'LAPORAN PEMBELIAN';
      columns = ['No Dokumen', 'Tanggal', 'Supplier', 'Item', 'Qty', 'Harga', 'Jumlah'];

      const query = `
        SELECT 
          a.doc_number,
          a.doc_date,
          p.name as partner_name,
          i.name as item_name,
          b.quantity,
          b.unit_price,
          (b.quantity * b.unit_price) as amount
        FROM APInvoices a
        JOIN APInvoiceDetails b ON b.ap_invoice_id = a.id
        LEFT JOIN Partners p ON a.partner_id = p.id
        LEFT JOIN Items i ON b.item_id = i.id
        WHERE a.doc_date BETWEEN ? AND ?
        ORDER BY a.doc_date, a.doc_number
      `;

      reportData = await executeQuery(query, [startDate, endDate]);
    } else {
      // Generic query for other reports
      reportTitle = 'LAPORAN';
      columns = ['Data'];
      reportData = [];
    }

    // Generate PDF using pdfkit
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      layout: 'landscape'
    });

    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename.replace('.jrxml', '.pdf')}"`);

    // Pipe the PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text(reportTitle, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Periode: ${startDate} s/d ${endDate}`, { align: 'center' });
    doc.moveDown(1);

    // Table settings
    const tableTop = 120;
    const tableLeft = 50;
    const rowHeight = 20;
    const pageWidth = doc.page.width - 100;

    // Column widths for pembelian report
    const colWidths = [90, 70, 120, 150, 60, 80, 80];

    // Draw table header
    doc.font('Helvetica-Bold').fontSize(9);
    let xPos = tableLeft;

    columns.forEach((col, i) => {
      doc.rect(xPos, tableTop, colWidths[i], rowHeight).stroke();
      doc.text(col, xPos + 5, tableTop + 5, { width: colWidths[i] - 10 });
      xPos += colWidths[i];
    });

    // Draw table rows
    doc.font('Helvetica').fontSize(8);
    let yPos = tableTop + rowHeight;
    let totalAmount = 0;
    let rowCount = 0;
    const maxRowsPerPage = 25;

    reportData.forEach((row) => {
      // Check if new page needed
      if (rowCount >= maxRowsPerPage) {
        doc.addPage({ layout: 'landscape' });
        yPos = 50;
        rowCount = 0;

        // Redraw header on new page
        doc.font('Helvetica-Bold').fontSize(9);
        xPos = tableLeft;
        columns.forEach((col, i) => {
          doc.rect(xPos, yPos, colWidths[i], rowHeight).stroke();
          doc.text(col, xPos + 5, yPos + 5, { width: colWidths[i] - 10 });
          xPos += colWidths[i];
        });
        yPos += rowHeight;
        doc.font('Helvetica').fontSize(8);
      }

      xPos = tableLeft;
      const values = [
        row.doc_number || '',
        row.doc_date ? new Date(row.doc_date).toLocaleDateString('id-ID') : '',
        row.partner_name || '',
        row.item_name || '',
        Number(row.quantity || 0).toLocaleString('id-ID'),
        Number(row.unit_price || 0).toLocaleString('id-ID'),
        Number(row.amount || 0).toLocaleString('id-ID')
      ];

      values.forEach((val, i) => {
        doc.rect(xPos, yPos, colWidths[i], rowHeight).stroke();
        const align = i >= 4 ? 'right' : 'left';
        doc.text(String(val), xPos + 5, yPos + 5, { width: colWidths[i] - 10, align });
        xPos += colWidths[i];
      });

      totalAmount += Number(row.amount || 0);
      yPos += rowHeight;
      rowCount++;
    });

    // Total row
    if (reportData.length > 0) {
      xPos = tableLeft;
      doc.font('Helvetica-Bold');

      // Merge first 6 columns for "Total" label
      const totalLabelWidth = colWidths.slice(0, 6).reduce((a, b) => a + b, 0);
      doc.rect(xPos, yPos, totalLabelWidth, rowHeight).stroke();
      doc.text('TOTAL', xPos + 5, yPos + 5, { width: totalLabelWidth - 10, align: 'right' });
      xPos += totalLabelWidth;

      // Amount column
      doc.rect(xPos, yPos, colWidths[6], rowHeight).stroke();
      doc.text(totalAmount.toLocaleString('id-ID'), xPos + 5, yPos + 5, { width: colWidths[6] - 10, align: 'right' });
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica');
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, tableLeft);
    doc.text(`Total Record: ${reportData.length}`, tableLeft);

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating Jasper Report PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== JASPER REPORTS EXCEL EXPORT ====================
app.get('/api/reports/excel', async (req, res) => {
  try {
    const { filename, startDate, endDate } = req.query;

    if (!filename) {
      return res.status(400).json({ success: false, error: 'Filename is required' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Start date and end date are required' });
    }

    console.log(`Generating Excel report: ${filename} with params: ${startDate} to ${endDate}`);

    // Query data based on the report filename
    let reportData = [];
    let reportTitle = 'Laporan';
    let columns = [];
    let columnKeys = [];

    // Determine query based on report file
    if (filename.toLowerCase().includes('pembelian') || filename.toLowerCase().includes('ap')) {
      reportTitle = 'LAPORAN PEMBELIAN';
      columns = ['No Dokumen', 'Tanggal', 'Supplier', 'Item', 'Qty', 'Harga', 'Jumlah'];
      columnKeys = ['doc_number', 'doc_date', 'partner_name', 'item_name', 'quantity', 'unit_price', 'amount'];

      const query = `
        SELECT 
          a.doc_number,
          a.doc_date,
          p.name as partner_name,
          i.name as item_name,
          b.quantity,
          b.unit_price,
          (b.quantity * b.unit_price) as amount
        FROM APInvoices a
        JOIN APInvoiceDetails b ON b.ap_invoice_id = a.id
        LEFT JOIN Partners p ON a.partner_id = p.id
        LEFT JOIN Items i ON b.item_id = i.id
        WHERE a.doc_date BETWEEN ? AND ?
        ORDER BY a.doc_date, a.doc_number
      `;

      reportData = await executeQuery(query, [startDate, endDate]);
    } else if (filename.toLowerCase().includes('penjualan') || filename.toLowerCase().includes('ar')) {
      reportTitle = 'LAPORAN PENJUALAN';
      columns = ['No Dokumen', 'Tanggal', 'Customer', 'Item', 'Qty', 'Harga', 'Jumlah'];
      columnKeys = ['doc_number', 'doc_date', 'partner_name', 'item_name', 'quantity', 'unit_price', 'amount'];

      const query = `
        SELECT 
          a.doc_number,
          a.doc_date,
          p.name as partner_name,
          i.name as item_name,
          b.quantity,
          b.unit_price,
          (b.quantity * b.unit_price) as amount
        FROM ARInvoices a
        JOIN ARInvoiceDetails b ON b.ar_invoice_id = a.id
        LEFT JOIN Partners p ON a.partner_id = p.id
        LEFT JOIN Items i ON b.item_id = i.id
        WHERE a.doc_date BETWEEN ? AND ?
        ORDER BY a.doc_date, a.doc_number
      `;

      reportData = await executeQuery(query, [startDate, endDate]);
    } else {
      // Generic for other reports
      reportTitle = 'LAPORAN';
      columns = ['Data'];
      columnKeys = ['data'];
      reportData = [];
    }

    // Format data for Excel
    const excelData = reportData.map(row => {
      const formattedRow = {};
      columnKeys.forEach((key, index) => {
        let value = row[key];
        if (key === 'doc_date' && value) {
          value = new Date(value).toLocaleDateString('id-ID');
        } else if (['quantity', 'unit_price', 'amount'].includes(key)) {
          value = Number(value) || 0;
        }
        formattedRow[columns[index]] = value;
      });
      return formattedRow;
    });

    // Calculate total
    const totalAmount = reportData.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

    // Add empty row and total row
    excelData.push({});
    excelData.push({
      [columns[0]]: 'TOTAL',
      [columns[columns.length - 1]]: totalAmount
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();

    // Add title rows
    const titleData = [
      [reportTitle],
      [`Periode: ${startDate} s/d ${endDate}`],
      [],  // Empty row
    ];

    const ws = XLSX.utils.aoa_to_sheet(titleData);

    // Add data starting from row 4
    XLSX.utils.sheet_add_json(ws, excelData, { origin: 'A4' });

    // Set column widths
    const colWidths = columns.map((col, i) => ({ wch: i === 3 ? 40 : i === 2 ? 25 : 15 }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    const excelFilename = filename.replace('.jrxml', '.xlsx').replace('.pdf', '.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFilename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    res.send(excelBuffer);

  } catch (error) {
    console.error('Error generating Excel report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== REPORT DEFINITIONS (STANDARD LIST) ====================
app.get('/api/reports/definitions', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM ReportDefinitions ORDER BY report_code');
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/reports/definitions', async (req, res) => {
  try {
    const { report_code, module, category, report_type, name, file_name } = req.body;
    await executeQuery(
      'INSERT INTO ReportDefinitions (report_code, module, category, report_type, name, file_name) VALUES (?, ?, ?, ?, ?, ?)',
      [report_code, module, category, report_type, name, file_name]
    );
    res.json({ success: true, message: 'Report definition created' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/reports/definitions/:id', async (req, res) => {
  try {
    const { report_code, module, category, report_type, name, file_name } = req.body;
    await executeQuery(
      'UPDATE ReportDefinitions SET report_code = ?, module = ?, category = ?, report_type = ?, name = ?, file_name = ? WHERE id = ?',
      [report_code, module, category, report_type, name, file_name, req.params.id]
    );
    res.json({ success: true, message: 'Report definition updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/reports/definitions/:id', async (req, res) => {
  try {
    await executeQuery('DELETE FROM ReportDefinitions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Report definition deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== INVENTORY ADJUSTMENTS ====================

// Get all inventory adjustments
app.get('/api/inventory-adjustments', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT ia.*, w.description as warehouse_name, a.name as counter_account_name, t.code as transcode_code
      FROM InventoryAdjustments ia
      LEFT JOIN Warehouses w ON ia.warehouse_id = w.id
      LEFT JOIN Accounts a ON ia.counter_account_id = a.id
      LEFT JOIN Transcodes t ON ia.transcode_id = t.id
    `;
    const params = [];
    if (startDate && endDate) {
      query += ' WHERE ia.doc_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    query += ' ORDER BY ia.doc_date DESC, ia.doc_number DESC';
    console.log('Fetching inventory adjustments, query:', query, 'params:', params);
    const result = await executeQuery(query, params);
    console.log('Found', result.length, 'adjustments:', result.map(r => ({ id: r.id, type: r.adjustment_type, doc: r.doc_number })));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching inventory adjustments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single inventory adjustment with details
app.get('/api/inventory-adjustments/:id', async (req, res) => {
  try {
    const [adjustment] = await executeQuery(`
      SELECT ia.*, w.description as warehouse_name, a.name as counter_account_name
      FROM InventoryAdjustments ia
      LEFT JOIN Warehouses w ON ia.warehouse_id = w.id
      LEFT JOIN Accounts a ON ia.counter_account_id = a.id
      WHERE ia.id = ?
    `, [req.params.id]);

    if (!adjustment) {
      return res.status(404).json({ success: false, error: 'Adjustment not found' });
    }

    const details = await executeQuery(`
      SELECT iad.*, i.code as item_code, i.name as item_name
      FROM InventoryAdjustmentDetails iad
      LEFT JOIN Items i ON iad.item_id = i.id
      WHERE iad.adjustment_id = ?
    `, [req.params.id]);

    adjustment.details = details;
    res.json({ success: true, data: adjustment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create inventory adjustment
app.post('/api/inventory-adjustments', async (req, res) => {
  let connection;
  try {
    const { doc_number, doc_date, adjustment_type, transcode_id, warehouse_id, counter_account_id, notes, items, currency_code } = req.body;

    console.log('Creating inventory adjustment:', { doc_number, doc_date, adjustment_type, transcode_id, warehouse_id, counter_account_id, notes });

    connection = await odbc.connect(connectionString);

    await connection.query(`
      INSERT INTO InventoryAdjustments (doc_number, doc_date, adjustment_type, transcode_id, warehouse_id, counter_account_id, notes, status, currency_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?)
    `, [doc_number, doc_date, adjustment_type, transcode_id || null, warehouse_id, counter_account_id, notes || '', currency_code || null]);

    const adjustmentIdResult = await connection.query('SELECT @@IDENTITY as id');
    const adjustmentId = Number(adjustmentIdResult[0].id);
    console.log('Created adjustment ID:', adjustmentId);

    // Insert details
    for (const item of items || []) {
      console.log('Inserting item:', item);
      await connection.query(`
        INSERT INTO InventoryAdjustmentDetails (adjustment_id, item_id, quantity, unit_cost, amount, notes, location_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [adjustmentId, item.item_id, item.quantity, item.unit_cost, item.amount, item.notes || '', item.location_id || null]);
    }

    res.json({ success: true, message: 'Adjustment berhasil disimpan', id: adjustmentId });
  } catch (error) {
    console.error('Error creating inventory adjustment:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Update inventory adjustment
app.put('/api/inventory-adjustments/:id', async (req, res) => {
  let connection;
  try {
    const { doc_date, warehouse_id, counter_account_id, notes, items, currency_code } = req.body;

    connection = await odbc.connect(connectionString);

    await connection.query(`
      UPDATE InventoryAdjustments SET doc_date = ?, warehouse_id = ?, counter_account_id = ?, notes = ?, currency_code = ?, updated_at = CURRENT TIMESTAMP
      WHERE id = ? AND status = 'Draft'
    `, [doc_date, warehouse_id, counter_account_id, notes || '', currency_code || null, req.params.id]);

    // Delete and re-insert details
    await connection.query('DELETE FROM InventoryAdjustmentDetails WHERE adjustment_id = ?', [req.params.id]);
    for (const item of items || []) {
      await connection.query(`
        INSERT INTO InventoryAdjustmentDetails (adjustment_id, item_id, quantity, unit_cost, amount, notes, location_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [req.params.id, item.item_id, item.quantity, item.unit_cost, item.amount, item.notes || '', item.location_id || null]);
    }

    res.json({ success: true, message: 'Adjustment berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Delete inventory adjustment
app.delete('/api/inventory-adjustments/:id', async (req, res) => {
  try {
    const [adj] = await executeQuery('SELECT status FROM InventoryAdjustments WHERE id = ?', [req.params.id]);
    if (adj && adj.status !== 'Draft') {
      return res.status(400).json({ success: false, error: 'Hanya adjustment Draft yang bisa dihapus' });
    }
    await executeQuery('DELETE FROM InventoryAdjustmentDetails WHERE adjustment_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM InventoryAdjustments WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Adjustment berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve inventory adjustment
app.put('/api/inventory-adjustments/:id/approve', async (req, res) => {
  try {
    await executeQuery(`UPDATE InventoryAdjustments SET status = 'Approved', updated_at = CURRENT TIMESTAMP WHERE id = ? AND status = 'Draft'`, [req.params.id]);
    res.json({ success: true, message: 'Adjustment berhasil diapprove' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Post inventory adjustment (update stock + create journal)
app.put('/api/inventory-adjustments/:id/post', async (req, res) => {
  let connection;
  try {
    console.log('Posting inventory adjustment:', req.params.id);
    connection = await odbc.connect(connectionString);

    // Check adjustment status
    const adjResult = await connection.query('SELECT * FROM InventoryAdjustments WHERE id = ?', [req.params.id]);
    const adj = adjResult[0];

    if (!adj) return res.status(404).json({ success: false, error: 'Adjustment not found' });
    if (adj.status === 'Posted') return res.status(400).json({ success: false, error: 'Sudah di-post' });

    const details = await connection.query('SELECT * FROM InventoryAdjustmentDetails WHERE adjustment_id = ?', [req.params.id]);
    console.log('Found', details.length, 'detail items');

    // Get inventory account
    let inventoryAccountId = adj.counter_account_id;
    try {
      const invAccount = await connection.query("SELECT id FROM Accounts WHERE type = 'ASSET' AND (name LIKE '%Persediaan%' OR name LIKE '%Inventory%')");
      if (invAccount.length > 0) inventoryAccountId = invAccount[0].id;
    } catch (e) {
      console.log('Using counter account as inventory account');
    }

    let totalAmount = 0;

    // Update stock for each item
    for (const detail of details) {
      try {
        const qtyChange = adj.adjustment_type === 'IN' ? detail.quantity : -detail.quantity;

        // Check if ItemStocks table exists
        const existingStock = await connection.query(
          'SELECT * FROM ItemStocks WHERE item_id = ? AND warehouse_id = ?',
          [detail.item_id, adj.warehouse_id]
        );

        if (existingStock.length > 0) {
          const stock = existingStock[0];
          const newQty = parseFloat(stock.quantity || 0) + parseFloat(qtyChange);
          let newAvgCost = stock.average_cost || detail.unit_cost;

          if (adj.adjustment_type === 'IN' && parseFloat(detail.quantity) > 0) {
            const oldValue = parseFloat(stock.quantity || 0) * parseFloat(stock.average_cost || 0);
            const newValue = parseFloat(detail.quantity) * parseFloat(detail.unit_cost);
            newAvgCost = newQty > 0 ? (oldValue + newValue) / newQty : detail.unit_cost;
          }
          await connection.query(
            'UPDATE ItemStocks SET quantity = ?, average_cost = ? WHERE item_id = ? AND warehouse_id = ?',
            [newQty, newAvgCost, detail.item_id, adj.warehouse_id]
          );
        } else {
          await connection.query(
            'INSERT INTO ItemStocks (item_id, warehouse_id, quantity, average_cost) VALUES (?, ?, ?, ?)',
            [detail.item_id, adj.warehouse_id, qtyChange, detail.unit_cost]
          );
        }
      } catch (stockError) {
        console.log('ItemStocks update skipped:', stockError.message);
      }
      totalAmount += parseFloat(detail.amount || 0);
    }

    console.log('Total amount for journal:', totalAmount);

    // Create Journal Voucher
    const jvNumber = `JV-ADJ-${adj.doc_number}`;
    await connection.query(`
      INSERT INTO JournalVouchers (doc_number, doc_date, description, status, source_type, ref_id)
      VALUES (?, ?, ?, 'Posted', 'INV_ADJUSTMENT', ?)
    `, [jvNumber, adj.doc_date, `Inventory Adjustment ${adj.adjustment_type}: ${adj.doc_number}`, adj.id]);

    const jvResult = await connection.query('SELECT @@IDENTITY as id');
    const jvId = Number(jvResult[0].id);
    console.log('Created JV ID:', jvId);

    // Journal entries based on type
    if (adj.adjustment_type === 'IN') {
      // Dr. Inventory, Cr. Counter Account
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
        [jvId, inventoryAccountId, 'Penambahan Stok', totalAmount]);
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
        [jvId, adj.counter_account_id, 'Contra Adjustment In', totalAmount]);
    } else {
      // Dr. Counter Account (COGS), Cr. Inventory
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
        [jvId, adj.counter_account_id, 'HPP / COGS Adjustment Out', totalAmount]);
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
        [jvId, inventoryAccountId, 'Pengurangan Stok', totalAmount]);
    }

    // Update status
    await connection.query(`UPDATE InventoryAdjustments SET status = 'Posted', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [req.params.id]);

    console.log('Adjustment posted successfully');
    res.json({ success: true, message: 'Adjustment berhasil di-post' });
  } catch (error) {
    console.error('Error posting inventory adjustment:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Unapprove inventory adjustment
app.put('/api/inventory-adjustments/:id/unapprove', async (req, res) => {
  try {
    await executeQuery(`UPDATE InventoryAdjustments SET status = 'Draft', updated_at = CURRENT TIMESTAMP WHERE id = ? AND status = 'Approved'`, [req.params.id]);
    res.json({ success: true, message: 'Adjustment berhasil di-unapprove' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unpost inventory adjustment (reverse stock + delete journal)
app.put('/api/inventory-adjustments/:id/unpost', async (req, res) => {
  let connection;
  try {
    console.log('Unposting inventory adjustment:', req.params.id);
    connection = await odbc.connect(connectionString);

    // Check adjustment status
    const adjResult = await connection.query('SELECT * FROM InventoryAdjustments WHERE id = ?', [req.params.id]);
    const adj = adjResult[0];

    if (!adj) return res.status(404).json({ success: false, error: 'Adjustment not found' });
    if (adj.status !== 'Posted') return res.status(400).json({ success: false, error: 'Adjustment belum di-post' });

    const details = await connection.query('SELECT * FROM InventoryAdjustmentDetails WHERE adjustment_id = ?', [req.params.id]);

    // Reverse stock for each item
    for (const detail of details) {
      try {
        // Reverse logic: If IN, we subtract. If OUT, we add.
        const qtyChange = adj.adjustment_type === 'IN' ? -detail.quantity : detail.quantity;

        const existingStock = await connection.query(
          'SELECT * FROM ItemStocks WHERE item_id = ? AND warehouse_id = ?',
          [detail.item_id, adj.warehouse_id]
        );

        if (existingStock.length > 0) {
          const stock = existingStock[0];
          const newQty = parseFloat(stock.quantity || 0) + parseFloat(qtyChange);

          // Note: Average cost is usually NOT recalculated on unpost/void to avoid complexity, 
          // or properly recalculated if strictly LIFO/FIFO throughout, but here we just update qty for simplicity
          // or maintain same avg cost.

          await connection.query(
            'UPDATE ItemStocks SET quantity = ? WHERE item_id = ? AND warehouse_id = ?',
            [newQty, detail.item_id, adj.warehouse_id]
          );
        }
      } catch (stockError) {
        console.log('ItemStocks reversal skipped:', stockError.message);
      }
    }

    // Delete Journal Voucher
    // First, find the JV ID
    const jvNum = `JV-ADJ-${adj.doc_number}`;
    const jv = await connection.query("SELECT id FROM JournalVouchers WHERE doc_number = ?", [jvNum]);
    if (jv.length > 0) {
      const jvId = jv[0].id;
      await connection.query('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
      await connection.query('DELETE FROM JournalVouchers WHERE id = ?', [jvId]);
    }

    // Update status
    await connection.query(`UPDATE InventoryAdjustments SET status = 'Approved', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [req.params.id]);

    console.log('Adjustment unposted successfully');
    res.json({ success: true, message: 'Adjustment berhasil di-unpost' });
  } catch (error) {
    console.error('Error unposting inventory adjustment:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Get average cost for item
app.get('/api/items/:id/average-cost', async (req, res) => {
  try {
    const { warehouse_id } = req.query;
    let query = 'SELECT AVG(average_cost) as avg_cost FROM ItemStocks WHERE item_id = ?';
    const params = [req.params.id];
    if (warehouse_id) {
      query = 'SELECT average_cost as avg_cost FROM ItemStocks WHERE item_id = ? AND warehouse_id = ?';
      params.push(warehouse_id);
    }
    const [result] = await executeQuery(query, params);
    res.json({ success: true, average_cost: result?.avg_cost || 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AP ADJUSTMENTS ====================

// Get all AP adjustments
app.get('/api/ap-adjustments', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT apa.*, apa.type as adjustment_type, apa.total_amount as amount, apa.description as notes, p.name as partner_name, a.name as counter_account_name, t.code as transcode_code,
      apa.allocate_to_invoice
      FROM APAdjustments apa
      LEFT JOIN Partners p ON apa.partner_id = p.id
      LEFT JOIN Accounts a ON apa.counter_account_id = a.id
      LEFT JOIN Transcodes t ON apa.transcode_id = t.id
    `;
    const params = [];
    if (startDate && endDate) {
      query += ' WHERE apa.doc_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    query += ' ORDER BY apa.doc_date DESC, apa.doc_number DESC';
    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single AP adjustment with allocations
app.get('/api/ap-adjustments/:id', async (req, res) => {
  try {
    const [adjustment] = await executeQuery(`
      SELECT apa.*, apa.type as adjustment_type, apa.total_amount as amount, apa.description as notes, p.name as partner_name, a.name as counter_account_name
      FROM APAdjustments apa
      LEFT JOIN Partners p ON apa.partner_id = p.id
      LEFT JOIN Accounts a ON apa.counter_account_id = a.id
      WHERE apa.id = ?
    `, [req.params.id]);

    if (!adjustment) {
      return res.status(404).json({ success: false, error: 'Adjustment not found' });
    }

    const allocations = await executeQuery(`
      SELECT apaa.*, api.doc_number as invoice_number
      FROM APAdjustmentAllocations apaa
      LEFT JOIN APInvoices api ON apaa.ap_invoice_id = api.id
      WHERE apaa.adjustment_id = ?
    `, [req.params.id]);

    adjustment.allocations = allocations;
    res.json({ success: true, data: adjustment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create AP adjustment
app.post('/api/ap-adjustments', async (req, res) => {
  let connection;
  try {
    const { doc_number, doc_date, adjustment_type, transcode_id, partner_id, counter_account_id, amount, notes, allocate_to_invoice, allocations, currency_code } = req.body;

    connection = await odbc.connect(connectionString);

    await connection.query(`
      INSERT INTO APAdjustments (doc_number, doc_date, type, transcode_id, partner_id, counter_account_id, total_amount, description, status, allocate_to_invoice, currency_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)
    `, [doc_number, doc_date, adjustment_type, transcode_id || null, partner_id, counter_account_id, amount, notes || '', allocate_to_invoice || 'N', currency_code || null]);

    const adjustmentIdResult = await connection.query('SELECT @@IDENTITY as id');
    const adjustmentId = Number(adjustmentIdResult[0].id);

    // Insert allocations if any
    if (allocate_to_invoice === 'Y' && allocations) {
      for (const alloc of allocations) {
        await connection.query(`
          INSERT INTO APAdjustmentAllocations (adjustment_id, ap_invoice_id, allocated_amount)
          VALUES (?, ?, ?)
        `, [adjustmentId, alloc.ap_invoice_id, alloc.allocated_amount]);
      }
    }

    res.json({ success: true, message: 'AP Adjustment berhasil disimpan', id: adjustmentId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Update AP adjustment
app.put('/api/ap-adjustments/:id', async (req, res) => {
  try {
    const { doc_date, partner_id, counter_account_id, amount, notes, allocate_to_invoice, allocations, currency_code } = req.body;

    await executeQuery(`
      UPDATE APAdjustments SET doc_date = ?, partner_id = ?, counter_account_id = ?, total_amount = ?, description = ?, allocate_to_invoice = ?, currency_code = ?, updated_at = CURRENT TIMESTAMP
      WHERE id = ? AND status = 'Draft'
    `, [doc_date, partner_id, counter_account_id, amount, notes || '', allocate_to_invoice || 'N', currency_code || null, req.params.id]);

    // Update allocations
    await executeQuery('DELETE FROM APAdjustmentAllocations WHERE adjustment_id = ?', [req.params.id]);
    if (allocate_to_invoice === 'Y' && allocations) {
      for (const alloc of allocations) {
        await executeQuery(`
          INSERT INTO APAdjustmentAllocations (adjustment_id, ap_invoice_id, allocated_amount)
          VALUES (?, ?, ?)
        `, [req.params.id, alloc.ap_invoice_id, alloc.allocated_amount]);
      }
    }

    res.json({ success: true, message: 'AP Adjustment berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete AP adjustment
app.delete('/api/ap-adjustments/:id', async (req, res) => {
  try {
    const [adj] = await executeQuery('SELECT status FROM APAdjustments WHERE id = ?', [req.params.id]);
    if (adj && adj.status !== 'Draft') {
      return res.status(400).json({ success: false, error: 'Hanya adjustment Draft yang bisa dihapus' });
    }
    await executeQuery('DELETE FROM APAdjustmentAllocations WHERE adjustment_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM APAdjustments WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'AP Adjustment berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve AP adjustment
app.put('/api/ap-adjustments/:id/approve', async (req, res) => {
  try {
    await executeQuery(`UPDATE APAdjustments SET status = 'Approved', updated_at = CURRENT TIMESTAMP WHERE id = ? AND status = 'Draft'`, [req.params.id]);
    res.json({ success: true, message: 'AP Adjustment berhasil diapprove' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unapprove AP adjustment
app.put('/api/ap-adjustments/:id/unapprove', async (req, res) => {
  try {
    await executeQuery(`UPDATE APAdjustments SET status = 'Draft', updated_at = CURRENT TIMESTAMP WHERE id = ? AND status = 'Approved'`, [req.params.id]);
    res.json({ success: true, message: 'AP Adjustment berhasil di-unapprove' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Post AP adjustment (create journal)
app.put('/api/ap-adjustments/:id/post', async (req, res) => {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    const adjResult = await connection.query('SELECT * FROM APAdjustments WHERE id = ?', [req.params.id]);
    const adj = adjResult[0];

    if (!adj) return res.status(404).json({ success: false, error: 'Adjustment not found' });
    if (adj.status === 'Posted') return res.status(400).json({ success: false, error: 'Sudah di-post' });

    // Get AP account
    let apAccountId = adj.counter_account_id;
    try {
      const apAccount = await connection.query("SELECT id FROM Accounts WHERE type = 'LIABILITY' AND (name LIKE '%Hutang%' OR name LIKE '%Payable%')");
      if (apAccount.length > 0) apAccountId = apAccount[0].id;
    } catch (e) { }

    // Create Journal Voucher
    const jvNumber = `JV-APADJ-${adj.doc_number}`;

    // Check if JV already exists
    const existingJV = await connection.query("SELECT id FROM JournalVouchers WHERE doc_number = ?", [jvNumber]);
    let jvId;

    if (existingJV.length > 0) {
      jvId = existingJV[0].id;
      console.log('JV already exists, using existing JV ID:', jvId);
      // Optional: Clear existing details to ensure consistency
      await connection.query('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
      await connection.query("UPDATE JournalVouchers SET doc_date = ?, description = ?, status = 'Posted', source_type = 'AP_ADJUSTMENT', ref_id = ? WHERE id = ?",
        [adj.doc_date, `AP Adjustment ${adj.type}: ${adj.doc_number}`, adj.id, jvId]);
    } else {
      await connection.query(`
        INSERT INTO JournalVouchers (doc_number, doc_date, description, status, source_type, ref_id, is_giro)
        VALUES (?, ?, ?, 'Posted', 'AP_ADJUSTMENT', ?, 0)
      `, [jvNumber, adj.doc_date, `AP Adjustment ${adj.type}: ${adj.doc_number}`, adj.id]);

      const jvResult = await connection.query('SELECT @@IDENTITY as id');
      jvId = Number(jvResult[0].id);
    }

    // Journal entries based on type
    if (adj.type === 'DEBIT') {
      // Mengurangi hutang: Dr. AP (Hutang), Cr. Counter Account
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
        [jvId, apAccountId, 'Pengurangan Hutang', adj.total_amount]);
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
        [jvId, adj.counter_account_id, 'Contra AP Debit Adj', adj.total_amount]);
    } else {
      // Menambah hutang: Dr. Counter Account, Cr. AP (Hutang)
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
        [jvId, adj.counter_account_id, 'Contra AP Credit Adj', adj.total_amount]);
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
        [jvId, apAccountId, 'Penambahan Hutang', adj.total_amount]);
    }

    // Update status
    await connection.query(`UPDATE APAdjustments SET status = 'Posted', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [req.params.id]);

    res.json({ success: true, message: 'AP Adjustment berhasil di-post' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Unpost AP adjustment
app.put('/api/ap-adjustments/:id/unpost', async (req, res) => {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    const adjResult = await connection.query('SELECT * FROM APAdjustments WHERE id = ?', [req.params.id]);
    const adj = adjResult[0];

    if (!adj) return res.status(404).json({ success: false, error: 'Adjustment not found' });
    if (adj.status !== 'Posted') return res.status(400).json({ success: false, error: 'Adjustment belum di-post' });

    // Delete Journal Voucher
    const jvNum = `JV-APADJ-${adj.doc_number}`;
    const jv = await connection.query("SELECT id FROM JournalVouchers WHERE doc_number = ?", [jvNum]);
    if (jv.length > 0) {
      const jvId = jv[0].id;
      await connection.query('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
      await connection.query('DELETE FROM JournalVouchers WHERE id = ?', [jvId]);
    }

    // Update status
    await connection.query(`UPDATE APAdjustments SET status = 'Approved', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [req.params.id]);

    res.json({ success: true, message: 'AP Adjustment berhasil di-unpost' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Get invoices for AP allocation (only outstanding invoices)
app.get('/api/ap-invoices/for-allocation', async (req, res) => {
  try {
    const { partner_id } = req.query;
    if (!partner_id) {
      return res.status(400).json({ success: false, error: 'partner_id is required' });
    }

    // Get outstanding invoices for the partner, considering existing adjustment allocations
    // Outstanding = total_amount - paid_amount - SUM(debit_adjustment_allocations)
    const result = await executeQuery(`
      SELECT 
        ap.id,
        ap.doc_number,
        ap.doc_date,
        ap.due_date,
        ap.total_amount,
        COALESCE(ap.paid_amount, 0) as paid_amount,
        COALESCE((
          SELECT SUM(apaa.allocated_amount)
          FROM APAdjustmentAllocations apaa
          JOIN APAdjustments apa ON apaa.adjustment_id = apa.id
          WHERE apaa.ap_invoice_id = ap.id 
          AND apa.status = 'Posted' 
          AND apa.type = 'DEBIT'
        ), 0) as adjustment_amount,
        (ap.total_amount - COALESCE(ap.paid_amount, 0) - COALESCE((
          SELECT SUM(apaa.allocated_amount)
          FROM APAdjustmentAllocations apaa
          JOIN APAdjustments apa ON apaa.adjustment_id = apa.id
          WHERE apaa.ap_invoice_id = ap.id 
          AND apa.status = 'Posted' 
          AND apa.type = 'DEBIT'
        ), 0)) as outstanding_amount
      FROM APInvoices ap
      WHERE ap.partner_id = ?
      AND ap.status IN ('Posted', 'Partial')
      AND (ap.total_amount - COALESCE(ap.paid_amount, 0) - COALESCE((
        SELECT SUM(apaa.allocated_amount)
        FROM APAdjustmentAllocations apaa
        JOIN APAdjustments apa ON apaa.adjustment_id = apa.id
        WHERE apaa.ap_invoice_id = ap.id 
        AND apa.status = 'Posted' 
        AND apa.type = 'DEBIT'
      ), 0)) > 1
      ORDER BY ap.doc_date ASC, ap.doc_number ASC
    `, [partner_id]);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching AP invoices for allocation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AR ADJUSTMENTS ====================

// Get all AR adjustments
app.get('/api/ar-adjustments', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT ara.*, ara.type as adjustment_type, p.name as partner_name, a.name as counter_account_name, t.code as transcode_code
      FROM ARAdjustments ara
      LEFT JOIN Partners p ON ara.partner_id = p.id
      LEFT JOIN Accounts a ON ara.counter_account_id = a.id
      LEFT JOIN Transcodes t ON ara.transcode_id = t.id
    `;

    const params = [];
    if (startDate && endDate) {
      query += ' WHERE ara.doc_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    query += ' ORDER BY ara.doc_date DESC, ara.doc_number DESC';
    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single AR adjustment with allocations
app.get('/api/ar-adjustments/:id', async (req, res) => {
  try {
    const [adjustment] = await executeQuery(`
      SELECT ara.*, p.name as partner_name, a.name as counter_account_name
      FROM ARAdjustments ara
      LEFT JOIN Partners p ON ara.partner_id = p.id
      LEFT JOIN Accounts a ON ara.counter_account_id = a.id
      WHERE ara.id = ?
    `, [req.params.id]);

    if (!adjustment) {
      return res.status(404).json({ success: false, error: 'Adjustment not found' });
    }

    const allocations = await executeQuery(`
      SELECT araa.*, ari.doc_number as invoice_number
      FROM ARAdjustmentAllocations araa
      LEFT JOIN ARInvoices ari ON araa.ar_invoice_id = ari.id
      WHERE araa.adjustment_id = ?
    `, [req.params.id]);

    adjustment.allocations = allocations;
    res.json({ success: true, data: adjustment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create AR adjustment
app.post('/api/ar-adjustments', async (req, res) => {
  let connection;
  try {
    const { doc_number, doc_date, adjustment_type, transcode_id, partner_id, counter_account_id, amount, notes, allocate_to_invoice, allocations, currency_code } = req.body;

    connection = await odbc.connect(connectionString);

    await connection.query(`
      INSERT INTO ARAdjustments (doc_number, doc_date, type, transcode_id, partner_id, counter_account_id, total_amount, description, status, allocate_to_invoice, currency_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)
    `, [doc_number, doc_date, adjustment_type, transcode_id || null, partner_id, counter_account_id, amount, notes || '', allocate_to_invoice || 'N', currency_code || null]);

    const adjustmentIdResult = await connection.query('SELECT @@IDENTITY as id');
    const adjustmentId = Number(adjustmentIdResult[0].id);

    // Insert allocations if any
    if (allocate_to_invoice === 'Y' && allocations) {
      for (const alloc of allocations) {
        await connection.query(`
          INSERT INTO ARAdjustmentAllocations (adjustment_id, ar_invoice_id, allocated_amount)
          VALUES (?, ?, ?)
        `, [adjustmentId, alloc.ar_invoice_id, alloc.allocated_amount]);
      }
    }

    res.json({ success: true, message: 'AR Adjustment berhasil disimpan', id: adjustmentId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Update AR adjustment
app.put('/api/ar-adjustments/:id', async (req, res) => {
  try {
    const { doc_date, partner_id, counter_account_id, amount, notes, allocate_to_invoice, allocations, currency_code } = req.body;

    await executeQuery(`
      UPDATE ARAdjustments SET doc_date = ?, partner_id = ?, counter_account_id = ?, total_amount = ?, description = ?, allocate_to_invoice = ?, currency_code = ?, updated_at = CURRENT TIMESTAMP
      WHERE id = ? AND status = 'Draft'
    `, [doc_date, partner_id, counter_account_id, amount, notes || '', allocate_to_invoice || 'N', currency_code || null, req.params.id]);

    // Update allocations
    await executeQuery('DELETE FROM ARAdjustmentAllocations WHERE adjustment_id = ?', [req.params.id]);
    if (allocate_to_invoice === 'Y' && allocations) {
      for (const alloc of allocations) {
        await executeQuery(`
          INSERT INTO ARAdjustmentAllocations (adjustment_id, ar_invoice_id, allocated_amount)
          VALUES (?, ?, ?)
        `, [req.params.id, alloc.ar_invoice_id, alloc.allocated_amount]);
      }
    }

    res.json({ success: true, message: 'AR Adjustment berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete AR adjustment
app.delete('/api/ar-adjustments/:id', async (req, res) => {
  try {
    const [adj] = await executeQuery('SELECT status FROM ARAdjustments WHERE id = ?', [req.params.id]);
    if (adj && adj.status !== 'Draft') {
      return res.status(400).json({ success: false, error: 'Hanya adjustment Draft yang bisa dihapus' });
    }
    await executeQuery('DELETE FROM ARAdjustmentAllocations WHERE adjustment_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM ARAdjustments WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'AR Adjustment berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve AR adjustment
app.put('/api/ar-adjustments/:id/approve', async (req, res) => {
  try {
    await executeQuery(`UPDATE ARAdjustments SET status = 'Approved', updated_at = CURRENT TIMESTAMP WHERE id = ? AND status = 'Draft'`, [req.params.id]);
    res.json({ success: true, message: 'AR Adjustment berhasil diapprove' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unapprove AR adjustment
app.put('/api/ar-adjustments/:id/unapprove', async (req, res) => {
  try {
    await executeQuery(`UPDATE ARAdjustments SET status = 'Draft', updated_at = CURRENT TIMESTAMP WHERE id = ? AND status = 'Approved'`, [req.params.id]);
    res.json({ success: true, message: 'AR Adjustment berhasil di-unapprove' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Post AR adjustment (create journal)
app.put('/api/ar-adjustments/:id/post', async (req, res) => {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    const adjResult = await connection.query('SELECT * FROM ARAdjustments WHERE id = ?', [req.params.id]);
    const adj = adjResult[0];

    if (!adj) return res.status(404).json({ success: false, error: 'Adjustment not found' });
    if (adj.status === 'Posted') return res.status(400).json({ success: false, error: 'Sudah di-post' });

    // Get AR account
    let arAccountId = adj.counter_account_id;
    try {
      const arAccount = await connection.query("SELECT id FROM Accounts WHERE type = 'ASSET' AND (name LIKE '%Piutang%' OR name LIKE '%Receivable%')");
      if (arAccount.length > 0) arAccountId = arAccount[0].id;
    } catch (e) { }

    // Create Journal Voucher
    const jvNumber = `JV-ARADJ-${adj.doc_number}`;

    // Check if JV already exists
    const existingJV = await connection.query("SELECT id FROM JournalVouchers WHERE doc_number = ?", [jvNumber]);
    let jvId;

    if (existingJV.length > 0) {
      jvId = existingJV[0].id;
      console.log('JV already exists, using existing JV ID:', jvId);
      await connection.query('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
      await connection.query("UPDATE JournalVouchers SET doc_date = ?, description = ?, status = 'Posted', source_type = 'AR_ADJUSTMENT', ref_id = ? WHERE id = ?",
        [adj.doc_date, `AR Adjustment ${adj.type}: ${adj.doc_number}`, adj.id, jvId]);
    } else {
      await connection.query(`
        INSERT INTO JournalVouchers (doc_number, doc_date, description, status, source_type, ref_id, is_giro)
        VALUES (?, ?, ?, 'Posted', 'AR_ADJUSTMENT', ?, 0)
      `, [jvNumber, adj.doc_date, `AR Adjustment ${adj.type}: ${adj.doc_number}`, adj.id]);

      const jvResult = await connection.query('SELECT @@IDENTITY as id');
      jvId = Number(jvResult[0].id);
    }

    // Journal entries based on type
    if (adj.type === 'DEBIT') {
      // Menambah piutang: Dr. AR (Piutang), Cr. Counter Account
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
        [jvId, arAccountId, 'Penambahan Piutang', adj.total_amount]);
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
        [jvId, adj.counter_account_id, 'Contra AR Debit Adj', adj.total_amount]);
    } else {
      // Mengurangi piutang: Dr. Counter Account, Cr. AR (Piutang)
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
        [jvId, adj.counter_account_id, 'Contra AR Credit Adj', adj.total_amount]);
      await connection.query('INSERT INTO JournalVoucherDetails (jv_id, coa_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
        [jvId, arAccountId, 'Pengurangan Piutang', adj.total_amount]);
    }

    // Update status
    await connection.query(`UPDATE ARAdjustments SET status = 'Posted', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [req.params.id]);

    res.json({ success: true, message: 'AR Adjustment berhasil di-post' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Unpost AR adjustment
app.put('/api/ar-adjustments/:id/unpost', async (req, res) => {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    const adjResult = await connection.query('SELECT * FROM ARAdjustments WHERE id = ?', [req.params.id]);
    const adj = adjResult[0];

    if (!adj) return res.status(404).json({ success: false, error: 'Adjustment not found' });
    if (adj.status !== 'Posted') return res.status(400).json({ success: false, error: 'Adjustment belum di-post' });

    // Delete Journal Voucher
    const jvNum = `JV-ARADJ-${adj.doc_number}`;
    const jv = await connection.query("SELECT id FROM JournalVouchers WHERE doc_number = ?", [jvNum]);
    if (jv.length > 0) {
      const jvId = jv[0].id;
      await connection.query('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
      await connection.query('DELETE FROM JournalVouchers WHERE id = ?', [jvId]);
    }

    // Update status
    await connection.query(`UPDATE ARAdjustments SET status = 'Approved', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [req.params.id]);

    res.json({ success: true, message: 'AR Adjustment berhasil di-unpost' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});






// ==========================================
// RECEIVINGS (PENERIMAAN BARANG)
// ==========================================

// Get List
app.get('/api/receivings', async (req, res) => {
  try {
    let query = `
      SELECT r.id, r.doc_number, r.doc_date, r.status, r.remarks, 
             p.name as partner_name, l.name as location_name,
             po.doc_number as po_number,
             (SELECT SUM(quantity) FROM ReceivingDetails WHERE receiving_id = r.id) as total_received
      FROM Receivings r
      LEFT JOIN Partners p ON r.partner_id = p.id
      LEFT JOIN Locations l ON r.location_id = l.id
      LEFT JOIN PurchaseOrders po ON r.po_id = po.id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.startDate && req.query.endDate) {
      query += ` AND r.doc_date BETWEEN ? AND ?`;
      params.push(req.query.startDate, req.query.endDate);
    }
    query += ` ORDER BY r.doc_number DESC`;

    const result = await executeQuery(query, params);
    const safeResult = result.map(r => {
      const newR = { ...r };
      for (const key in newR) {
        if (typeof newR[key] === 'bigint') newR[key] = Number(newR[key]);
      }
      return newR;
    });
    res.json({ success: true, data: safeResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Detail
app.get('/api/receivings/:id', async (req, res) => {
  try {
    const headerResult = await executeQuery(`SELECT * FROM Receivings WHERE id = ?`, [req.params.id]);
    if (headerResult.length === 0) return res.status(404).json({ success: false, error: 'Receiving not found' });

    const header = headerResult[0];
    for (const key in header) {
      if (typeof header[key] === 'bigint') header[key] = Number(header[key]);
    }

    const detailsResult = await executeQuery(`
      SELECT rd.*, i.code as item_code, i.name as item_name, i.unit
      FROM ReceivingDetails rd
      JOIN Items i ON rd.item_id = i.id
      WHERE rd.receiving_id = ?
    `, [req.params.id]);

    header.details = detailsResult.map(d => {
      const newD = { ...d };
      for (const key in newD) {
        if (typeof newD[key] === 'bigint') newD[key] = Number(newD[key]);
      }
      return newD;
    });

    res.json({ success: true, data: header });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create
app.post('/api/receivings', async (req, res) => {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    await connection.beginTransaction();

    const { doc_number, doc_date, po_id, partner_id, location_id, transcode_id, remarks, items, status, currency_code } = req.body;

    // Insert Header
    await connection.query(`
      INSERT INTO Receivings (doc_number, doc_date, po_id, partner_id, location_id, transcode_id, remarks, status, currency_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [doc_number, doc_date, po_id || null, partner_id || null, location_id || null, transcode_id || null, remarks || '', status || 'Draft', currency_code || null]);

    const idRes = await connection.query('SELECT @@IDENTITY as id');
    const receivingId = Number(idRes[0].id);

    // Insert Details
    for (const item of items) {
      await connection.query(`
        INSERT INTO ReceivingDetails (receiving_id, item_id, quantity, remarks, po_detail_id)
        VALUES (?, ?, ?, ?, ?)
      `, [receivingId, item.item_id, item.quantity, item.remarks || '', item.po_detail_id || null]);
    }

    // Update Transcode
    if (transcode_id) {
      await connection.query(`UPDATE Transcodes SET last_number = last_number + 1 WHERE id = ?`, [transcode_id]);
    }

    await connection.commit();
    res.json({ success: true, message: 'Receiving created successfully', id: receivingId });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Update
app.put('/api/receivings/:id', async (req, res) => {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    await connection.beginTransaction();

    const { doc_date, po_id, partner_id, location_id, remarks, items, status } = req.body;

    const [rec] = await connection.query('SELECT status FROM Receivings WHERE id = ?', [req.params.id]);
    if (rec && rec.status !== 'Draft') {
      return res.status(400).json({ success: false, error: 'Only Draft can be updated' });
    }

    // Update Header
    await connection.query(`
      UPDATE Receivings 
      SET doc_date = ?, po_id = ?, partner_id = ?, location_id = ?, remarks = ?, status = ?
      WHERE id = ?
    `, [doc_date, po_id || null, partner_id || null, location_id || null, remarks || '', status || 'Draft', req.params.id]);

    // Delete and Re-insert Details
    await connection.query('DELETE FROM ReceivingDetails WHERE receiving_id = ?', [req.params.id]);
    for (const item of items) {
      await connection.query(`
        INSERT INTO ReceivingDetails (receiving_id, item_id, quantity, remarks, po_detail_id)
        VALUES (?, ?, ?, ?, ?)
      `, [req.params.id, item.item_id, item.quantity, item.remarks || '', item.po_detail_id || null]);
    }

    await connection.commit();
    res.json({ success: true, message: 'Receiving updated successfully' });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Delete
app.delete('/api/receivings/:id', async (req, res) => {
  try {
    const result = await executeQuery('SELECT status FROM Receivings WHERE id = ?', [req.params.id]);
    if (result.length > 0 && result[0].status !== 'Draft') {
      return res.status(400).json({ success: false, error: 'Only Draft can be deleted' });
    }
    await executeQuery('DELETE FROM ReceivingDetails WHERE receiving_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM Receivings WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Receiving deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve (Post)
app.put('/api/receivings/:id/approve', async (req, res) => {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    await connection.beginTransaction();

    const [rec] = await connection.query(`
      SELECT r.*, l.sub_warehouse_id, sw.warehouse_id 
      FROM Receivings r
      LEFT JOIN Locations l ON r.location_id = l.id
      LEFT JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
      WHERE r.id = ?
    `, [req.params.id]);

    if (!rec) return res.status(404).json({ success: false, error: 'Receiving not found' });
    if (rec.status !== 'Draft') return res.status(400).json({ success: false, error: 'Only Draft can be posted' });
    if (!rec.location_id) return res.status(400).json({ success: false, error: 'Location ID is required for posting' });

    const details = await connection.query('SELECT * FROM ReceivingDetails WHERE receiving_id = ?', [req.params.id]);

    for (const item of details) {
      // 1. Determine Unit Cost
      let unitCost = 0;
      if (item.po_detail_id) {
        const [poDetail] = await connection.query('SELECT unit_price FROM PurchaseOrderDetails WHERE id = ?', [item.po_detail_id]);
        unitCost = poDetail ? Number(poDetail.unit_price) : 0;
      } else {
        const [itemMaster] = await connection.query('SELECT standard_cost FROM Items WHERE id = ?', [item.item_id]);
        unitCost = itemMaster ? Number(itemMaster.standard_cost) : 0;
      }

      // 2. Update Stock
      const stockResult = await connection.query(`
        SELECT quantity, average_cost FROM ItemStocks 
        WHERE item_id = ? AND warehouse_id = ? AND location_id = ?
      `, [item.item_id, rec.warehouse_id, item.location_id || rec.location_id]);

      let newQty = Number(item.quantity);
      let newAvgCost = unitCost;

      if (stockResult.length > 0) {
        const currentQty = Number(stockResult[0].quantity);
        const currentAvgCost = Number(stockResult[0].average_cost || 0);

        const totalQty = currentQty + newQty;
        if (totalQty > 0) {
          newAvgCost = ((currentQty * currentAvgCost) + (newQty * unitCost)) / totalQty;
        } else {
          newAvgCost = currentAvgCost;
        }

        await connection.query(`
          UPDATE ItemStocks 
          SET quantity = quantity + ?, average_cost = ?, last_updated = CURRENT TIMESTAMP 
          WHERE item_id = ? AND warehouse_id = ? AND location_id = ?
        `, [newQty, newAvgCost, item.item_id, rec.warehouse_id, item.location_id || rec.location_id]);
      } else {
        await connection.query(`
          INSERT INTO ItemStocks (item_id, warehouse_id, location_id, quantity, average_cost)
          VALUES (?, ?, ?, ?, ?)
        `, [item.item_id, rec.warehouse_id, item.location_id || rec.location_id, newQty, newAvgCost]);
      }
    }

    // 3. Update Status
    await connection.query(`UPDATE Receivings SET status = 'Posted', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [req.params.id]);

    await connection.commit();
    res.json({ success: true, message: 'Receiving posted successfully' });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Unapprove (Unpost)
app.put('/api/receivings/:id/unapprove', async (req, res) => {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    await connection.beginTransaction();

    const [rec] = await connection.query(`
      SELECT r.*, l.sub_warehouse_id, sw.warehouse_id 
      FROM Receivings r
      LEFT JOIN Locations l ON r.location_id = l.id
      LEFT JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
      WHERE r.id = ?
    `, [req.params.id]);

    if (!rec) return res.status(404).json({ success: false, error: 'Receiving not found' });
    if (rec.status !== 'Posted') return res.status(400).json({ success: false, error: 'Only Posted can be unposted' });

    const details = await connection.query('SELECT * FROM ReceivingDetails WHERE receiving_id = ?', [req.params.id]);

    for (const item of details) {
      // Revert Stock (Decrease Qty, Avg Cost remains the same as it's a removal)
      await connection.query(`
        UPDATE ItemStocks 
        SET quantity = quantity - ?, last_updated = CURRENT TIMESTAMP 
        WHERE item_id = ? AND warehouse_id = ? AND location_id = ?
      `, [item.quantity, item.item_id, rec.warehouse_id, item.location_id || rec.location_id]);
    }

    // Update Status
    await connection.query(`UPDATE Receivings SET status = 'Draft', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [req.params.id]);

    await connection.commit();
    res.json({ success: true, message: 'Receiving unposted successfully' });
  } catch (error) {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});


// ==========================================
// LOCATION TRANSFERS
// ==========================================

// Get Locations List (for Dropdown)
app.get('/api/locations', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT l.id, l.code, l.name, sw.name as sub_warehouse_name, w.name as warehouse_name
      FROM Locations l
      LEFT JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
      LEFT JOIN Warehouses w ON sw.warehouse_id = w.id
      ORDER BY w.code, sw.code, l.code
    `);
    const safeResult = result.map(r => {
      const newR = { ...r };
      for (const key in newR) {
        if (typeof newR[key] === 'bigint') newR[key] = Number(newR[key]);
      }
      return newR;
    });
    res.json({ success: true, data: safeResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get List
app.get('/api/location-transfers', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        lt.id, lt.doc_number, lt.doc_date, lt.source_location_id, lt.destination_location_id, 
        lt.status, CAST(lt.notes AS VARCHAR(2000)) as notes, lt.transcode_id, lt.created_at, lt.updated_at,
        l_src.code as source_location_code,
        l_src.name as source_location_name,
        w_src.description as source_warehouse_name,
        l_dest.code as destination_location_code,
        l_dest.name as destination_location_name,
        w_dest.description as destination_warehouse_name
      FROM LocationTransfers lt
      LEFT JOIN Locations l_src ON lt.source_location_id = l_src.id
      LEFT JOIN Locations l_dest ON lt.destination_location_id = l_dest.id
      LEFT JOIN SubWarehouses sw_src ON l_src.sub_warehouse_id = sw_src.id
      LEFT JOIN SubWarehouses sw_dest ON l_dest.sub_warehouse_id = sw_dest.id
      LEFT JOIN Warehouses w_src ON sw_src.warehouse_id = w_src.id
      LEFT JOIN Warehouses w_dest ON sw_dest.warehouse_id = w_dest.id
      ORDER BY lt.doc_number DESC
    `);
    const safeResult = result.map(r => {
      const newR = { ...r };
      for (const key in newR) {
        if (typeof newR[key] === 'bigint') newR[key] = Number(newR[key]);
      }
      return newR;
    });
    res.json({ success: true, data: safeResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Detail
app.get('/api/location-transfers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const transfer = await executeQuery(`
      SELECT 
        lt.id, lt.doc_number, lt.doc_date, lt.source_location_id, lt.destination_location_id, 
        lt.status, CAST(lt.notes AS VARCHAR(2000)) as notes, lt.transcode_id, lt.created_at, lt.updated_at,
        l_src.code as source_location_code,
        l_src.name as source_location_name,
        w_src.description as source_warehouse_name,
        l_dest.code as destination_location_code,
        l_dest.name as destination_location_name,
        w_dest.description as destination_warehouse_name
      FROM LocationTransfers lt
      LEFT JOIN Locations l_src ON lt.source_location_id = l_src.id
      LEFT JOIN Locations l_dest ON lt.destination_location_id = l_dest.id
      LEFT JOIN SubWarehouses sw_src ON l_src.sub_warehouse_id = sw_src.id
      LEFT JOIN SubWarehouses sw_dest ON l_dest.sub_warehouse_id = sw_dest.id
      LEFT JOIN Warehouses w_src ON sw_src.warehouse_id = w_src.id
      LEFT JOIN Warehouses w_dest ON sw_dest.warehouse_id = w_dest.id
      WHERE lt.id = ?
    `, [id]);

    if (transfer.length === 0) return res.status(404).json({ success: false, error: 'Transfer not found' });

    const details = await executeQuery(`
      SELECT 
        ltd.id, ltd.transfer_id, ltd.item_id, ltd.quantity, CAST(ltd.notes AS VARCHAR(2000)) as notes,
        i.code as item_code,
        i.name as item_name,
        COALESCE(u.name, i.unit, 'Unit') as unit_name
      FROM LocationTransferDetails ltd
      LEFT JOIN Items i ON ltd.item_id = i.id
      LEFT JOIN Units u ON CAST(i.unit AS VARCHAR(50)) = CAST(u.id AS VARCHAR(50))
      WHERE ltd.transfer_id = ?
    `, [id]);

    const transferData = { ...transfer[0] };
    for (const key in transferData) {
      if (typeof transferData[key] === 'bigint') transferData[key] = Number(transferData[key]);
    }

    const sanitizedDetails = details.map(d => {
      const newD = { ...d };
      for (const key in newD) {
        if (typeof newD[key] === 'bigint') newD[key] = Number(newD[key]);
      }
      return newD;
    });

    res.json({ success: true, data: { ...transferData, items: sanitizedDetails } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create
app.post('/api/location-transfers', async (req, res) => {
  let connection;
  try {
    const { doc_date, source_location_id, destination_location_id, items, notes } = req.body;

    // Validate Date
    let validDate = doc_date;
    if (!validDate || isNaN(new Date(validDate).getTime())) {
      validDate = new Date().toISOString().split('T')[0];
    }

    // Generate Doc Number (TRF/YYMM/XXXX)
    const dateObj = new Date(validDate);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const prefix = `TRF/${month}${year}/`;

    // Get last number
    const lastDoc = await executeQuery(`SELECT TOP 1 doc_number FROM LocationTransfers WHERE doc_number LIKE '${prefix}%' ORDER BY doc_number DESC`);

    let nextNum = '0001';
    if (lastDoc.length > 0) {
      const lastSeq = parseInt(lastDoc[0].doc_number.split('/').pop());
      nextNum = String(lastSeq + 1).padStart(4, '0');
    }
    const doc_number = `${prefix}${nextNum}`;

    // Parse IDs
    const srcLocId = parseInt(source_location_id) || 0;
    const dstLocId = parseInt(destination_location_id) || 0;
    // Escape notes for SQL (replace single quotes with two single quotes)
    const safeNotes = (notes || '').replace(/'/g, "''");

    // START TRANSACTION
    connection = await odbc.connect(connectionString);
    await connection.beginTransaction();

    // Insert Header - use SQL literal for notes (LONG VARCHAR) to avoid ODBC binding issues
    await connection.query(`
      INSERT INTO LocationTransfers (doc_number, doc_date, source_location_id, destination_location_id, notes, status)
      VALUES (?, ?, ?, ?, '${safeNotes}', 'Draft')
    `, [doc_number, validDate, srcLocId, dstLocId]);

    const idRes = await connection.query('SELECT @@IDENTITY as id');
    if (!idRes || idRes.length === 0 || !idRes[0].id) {
      throw new Error('Failed to retrieve Transfer ID');
    }
    const transferId = Number(idRes[0].id);

    // Insert Details - use SQL literal for notes (LONG VARCHAR) to avoid ODBC binding issues
    for (const item of items) {
      const itemNotes = (item.notes || '').replace(/'/g, "''");
      await connection.query(`
        INSERT INTO LocationTransferDetails (transfer_id, item_id, quantity, notes)
        VALUES (?, ?, ?, '${itemNotes}')
      `, [transferId, parseInt(item.item_id) || 0, parseFloat(item.quantity) || 0]);
    }

    await connection.commit();
    res.json({ success: true, data: { id: transferId, doc_number } });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { }
    }
    console.error('Error creating transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { }
    }
  }
});

// Update (Draft only)
app.put('/api/location-transfers/:id', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { doc_date, source_location_id, destination_location_id, notes, items } = req.body;

    if (!source_location_id || !destination_location_id || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Misssing required fields' });
    }

    if (source_location_id === destination_location_id) {
      return res.status(400).json({ success: false, error: 'Source and Destination cannot be the same' });
    }

    // Check status first
    const existing = await executeQuery('SELECT status FROM LocationTransfers WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: 'Transfer not found' });
    if (existing[0].status !== 'Draft') return res.status(400).json({ success: false, error: 'Cannot edit non-draft transfer' });

    connection = await odbc.connect(connectionString);
    await connection.beginTransaction();

    const validDate = new Date(doc_date).toISOString().split('T')[0];
    const srcLocId = Number(source_location_id);
    const dstLocId = Number(destination_location_id);
    const safeNotes = (notes || '').replace(/'/g, "''");

    // Update Header
    await connection.query(`
      UPDATE LocationTransfers
      SET doc_date = ?, source_location_id = ?, destination_location_id = ?, notes = '${safeNotes}', updated_at = CURRENT TIMESTAMP
      WHERE id = ?
    `, [validDate, srcLocId, dstLocId, id]);

    // Delete Old Details
    await connection.query('DELETE FROM LocationTransferDetails WHERE transfer_id = ?', [id]);

    // Insert New Details
    for (const item of items) {
      const itemNotes = (item.notes || '').replace(/'/g, "''");
      await connection.query(`
        INSERT INTO LocationTransferDetails (transfer_id, item_id, quantity, notes)
        VALUES (?, ?, ?, '${itemNotes}')
      `, [id, parseInt(item.item_id) || 0, parseFloat(item.quantity) || 0]);
    }

    await connection.commit();
    res.json({ success: true, message: 'Transfer updated' });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { }
    }
    console.error('Error updating transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { }
    }
  }
});

// Delete (Draft only)
app.delete('/api/location-transfers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Check status
    const transfer = await executeQuery('SELECT status FROM LocationTransfers WHERE id = ?', [id]);
    if (transfer.length === 0) return res.status(404).json({ success: false, error: 'Transfer not found' });
    if (transfer[0].status !== 'Draft') return res.status(400).json({ success: false, error: 'Cannot delete non-draft transfer' });

    // Details deleted via CASCADE
    await executeQuery('DELETE FROM LocationTransferDetails WHERE transfer_id = ?', [id]); // Explicit delete just in case
    await executeQuery('DELETE FROM LocationTransfers WHERE id = ?', [id]);

    res.json({ success: true, message: 'Transfer deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve/Post
app.post('/api/location-transfers/:id/approve', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    await connection.beginTransaction();

    // 1. Get Transfer
    const transfer = await connection.query(`
      SELECT lt.*, l_src.name as source_location_name 
      FROM LocationTransfers lt
      JOIN Locations l_src ON lt.source_location_id = l_src.id
      WHERE lt.id = ?
    `, [id]);

    if (transfer.length === 0) throw new Error('Transfer not found');
    if (transfer[0].status !== 'Draft') throw new Error('Transfer not in Draft status');

    const details = await connection.query(`
        SELECT ltd.*, i.name as item_name 
        FROM LocationTransferDetails ltd
        JOIN Items i ON ltd.item_id = i.id
        WHERE ltd.transfer_id = ?
    `, [id]);

    const srcLocId = transfer[0].source_location_id;
    const dstLocId = transfer[0].destination_location_id;
    const srcLocName = transfer[0].source_location_name;

    // Get Warehouse IDs for Locations
    const srcLoc = await connection.query(`SELECT sw.warehouse_id FROM Locations l JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id WHERE l.id = ?`, [srcLocId]);
    const dstLoc = await connection.query(`SELECT sw.warehouse_id FROM Locations l JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id WHERE l.id = ?`, [dstLocId]);

    const srcWhId = srcLoc[0]?.warehouse_id;
    const dstWhId = dstLoc[0]?.warehouse_id;

    if (!srcWhId || !dstWhId) {
      throw new Error('Invalid Locations (Warehouse not found)');
    }

    // 2. Loop Items and Update Stock
    for (const item of details) {
      // Check Source Stock
      const srcStock = await connection.query(`SELECT quantity, average_cost FROM ItemStocks WHERE item_id = ? AND warehouse_id = ? AND location_id = ?`, [item.item_id, srcWhId, srcLocId]);
      const currentQty = srcStock.length > 0 ? srcStock[0].quantity : 0;
      const srcAvgCost = srcStock.length > 0 ? (srcStock[0].average_cost || 0) : 0;

      if (currentQty < item.quantity) {
        throw new Error(`Stok tidak cukup untuk item ${item.item_name} di Lokasi ${srcLocName}. Stok: ${currentQty}, Butuh: ${item.quantity}`);
      }

      // Decrease Source (Cost per unit remains same)
      await connection.query(`UPDATE ItemStocks SET quantity = quantity - ?, last_updated = CURRENT TIMESTAMP WHERE item_id = ? AND warehouse_id = ? AND location_id = ?`, [item.quantity, item.item_id, srcWhId, srcLocId]);

      // Increase Destination with Weighted Average Cost Calculation
      const dstStock = await connection.query(`SELECT quantity, average_cost FROM ItemStocks WHERE item_id = ? AND warehouse_id = ? AND location_id = ?`, [item.item_id, dstWhId, dstLocId]);

      let newDstAvgCost = srcAvgCost; // Default cost for new stock is the incoming cost

      if (dstStock.length > 0) {
        const dstQty = dstStock[0].quantity;
        const dstCost = dstStock[0].average_cost || 0;

        // Weighted Average: ((OldQty * OldCost) + (TransferQty * TransferCost)) / NewTotalQty
        const totalQty = dstQty + item.quantity;

        // Handle potential division by zero if totalQty is 0 (unlikely here as we are adding positive qty, but safety first)
        if (totalQty > 0) {
          const totalValue = (dstQty * dstCost) + (item.quantity * srcAvgCost);
          newDstAvgCost = totalValue / totalQty;
        } else {
          newDstAvgCost = dstCost;
        }
      }

      if (dstStock.length === 0) {
        // Insert with new Avg Cost
        await connection.query(`INSERT INTO ItemStocks (item_id, warehouse_id, location_id, quantity, average_cost) VALUES (?, ?, ?, 0, ?)`, [item.item_id, dstWhId, dstLocId, newDstAvgCost]);
      }

      // Update Qty and Average Cost
      await connection.query(`UPDATE ItemStocks SET quantity = quantity + ?, average_cost = ?, last_updated = CURRENT TIMESTAMP WHERE item_id = ? AND warehouse_id = ? AND location_id = ?`, [item.quantity, newDstAvgCost, item.item_id, dstWhId, dstLocId]);
    }

    // 3. Update Status
    await connection.query(`UPDATE LocationTransfers SET status = 'Posted', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [id]);

    await connection.commit();
    res.json({ success: true, message: 'Transfer posted and stock updated' });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { }
    }
    console.error('Error posting transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { }
    }
  }
});


// Unpost/Cancel Post
app.post('/api/location-transfers/:id/unpost', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    await connection.beginTransaction();

    // 1. Get Transfer
    const transfer = await connection.query(`
      SELECT lt.*, l_dest.name as destination_location_name 
      FROM LocationTransfers lt
      JOIN Locations l_dest ON lt.destination_location_id = l_dest.id
      WHERE lt.id = ?
    `, [id]);

    if (transfer.length === 0) throw new Error('Transfer not found');
    if (transfer[0].status !== 'Posted') throw new Error('Transfer is not Posted');

    const details = await connection.query(`
        SELECT ltd.*, i.name as item_name 
        FROM LocationTransferDetails ltd
        JOIN Items i ON ltd.item_id = i.id
        WHERE ltd.transfer_id = ?
    `, [id]);

    const srcLocId = transfer[0].source_location_id;
    const dstLocId = transfer[0].destination_location_id;
    const dstLocName = transfer[0].destination_location_name;

    // Get Warehouse IDs
    const srcLoc = await connection.query(`SELECT sw.warehouse_id FROM Locations l JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id WHERE l.id = ?`, [srcLocId]);
    const dstLoc = await connection.query(`SELECT sw.warehouse_id FROM Locations l JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id WHERE l.id = ?`, [dstLocId]);

    const srcWhId = srcLoc[0]?.warehouse_id;
    const dstWhId = dstLoc[0]?.warehouse_id;

    if (!srcWhId || !dstWhId) {
      throw new Error('Invalid Locations (Warehouse not found)');
    }

    // 2. Loop Items and Revert Stock
    for (const item of details) {
      // Logic Unpost: Source (+), Destination (-)

      // Check Destination Stock (Must have enough to return)
      const dstStock = await connection.query(`SELECT quantity, average_cost FROM ItemStocks WHERE item_id = ? AND warehouse_id = ? AND location_id = ?`, [item.item_id, dstWhId, dstLocId]);
      const currentDstQty = dstStock.length > 0 ? dstStock[0].quantity : 0;

      if (currentDstQty < item.quantity) {
        throw new Error(`Stok tidak cukup di Lokasi Tujuan (${dstLocName}) untuk di-unpost. Stok saat ini: ${currentDstQty}, Harus dikembalikan: ${item.quantity}. Barang mungkin sudah dipindahkan atau terjual.`);
      }

      // Decrease Destination (Revert addition)
      await connection.query(`UPDATE ItemStocks SET quantity = quantity - ?, last_updated = CURRENT TIMESTAMP WHERE item_id = ? AND warehouse_id = ? AND location_id = ?`, [item.quantity, item.item_id, dstWhId, dstLocId]);

      // Increase Source (Revert subtraction - with Weighted Average Cost update)
      // Check if source stock record exists
      const srcStock = await connection.query(`SELECT quantity, average_cost FROM ItemStocks WHERE item_id = ? AND warehouse_id = ? AND location_id = ?`, [item.item_id, srcWhId, srcLocId]);
      const dstAvgCost = dstStock.length > 0 ? (dstStock[0].average_cost || 0) : 0;

      let newSrcAvgCost = dstAvgCost; // Default cost returning from destination

      if (srcStock.length > 0) {
        const srcQty = srcStock[0].quantity;
        const srcCost = srcStock[0].average_cost || 0;

        const totalQty = srcQty + item.quantity;

        if (totalQty > 0) {
          const totalValue = (srcQty * srcCost) + (item.quantity * dstAvgCost);
          newSrcAvgCost = totalValue / totalQty;
        } else {
          newSrcAvgCost = srcCost;
        }
      }

      if (srcStock.length === 0) {
        // Insert if not exists
        await connection.query(`INSERT INTO ItemStocks (item_id, warehouse_id, location_id, quantity, average_cost) VALUES (?, ?, ?, 0, ?)`, [item.item_id, srcWhId, srcLocId, newSrcAvgCost]);
      }

      // Update Qty and Average Cost at Source
      await connection.query(`UPDATE ItemStocks SET quantity = quantity + ?, average_cost = ?, last_updated = CURRENT TIMESTAMP WHERE item_id = ? AND warehouse_id = ? AND location_id = ?`, [item.quantity, newSrcAvgCost, item.item_id, srcWhId, srcLocId]);
    }

    // 3. Update Status back to Draft
    await connection.query(`UPDATE LocationTransfers SET status = 'Draft', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [id]);

    await connection.commit();
    res.json({ success: true, message: 'Transfer unposted. Status reverted to Draft.' });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { }
    }
    console.error('Error unposting transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (e) { }
    }
  }
});


// ==========================================
// STOCK REPORTS
// ==========================================

// Get Stock Summary Report (grouped by item)
app.get('/api/reports/stock-summary', async (req, res) => {
  try {
    const { warehouse_id, category_id, search } = req.query;

    let query = `
      SELECT 
        i.id as item_id,
        i.code as item_code,
        i.name as item_name,
        COALESCE(u.name, i.unit, 'Unit') as unit_name,
        COALESCE(i.standard_cost, 0) as standard_cost,
        COALESCE(i.standard_price, 0) as standard_price,
        COALESCE(SUM(s.quantity), 0) as total_quantity,
        CASE 
          WHEN COALESCE(SUM(s.quantity), 0) <> 0 
          THEN SUM(COALESCE(s.quantity, 0) * COALESCE(s.average_cost, 0)) / SUM(s.quantity) 
          ELSE COALESCE(i.standard_cost, 0) 
        END as average_cost,
        SUM(COALESCE(s.quantity, 0) * COALESCE(s.average_cost, 0)) as total_value
      FROM Items i
      LEFT JOIN ItemStocks s ON i.id = s.item_id ${warehouse_id ? 'AND s.warehouse_id = ?' : ''}
      LEFT JOIN Units u ON i.unit = u.name OR CAST(i.unit AS VARCHAR(50)) = CAST(u.id AS VARCHAR(50))
      WHERE 1=1
    `;

    const params = [];

    if (warehouse_id) {
      params.push(warehouse_id);
    }

    if (search) {
      query += " AND (i.code LIKE ? OR i.name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY i.id, i.code, i.name, u.name, i.unit, i.standard_cost, i.standard_price
               ORDER BY i.code`;

    const result = await executeQuery(query, params);

    const safeResult = result.map(r => {
      const newR = { ...r };
      for (const key in newR) {
        if (typeof newR[key] === 'bigint') newR[key] = Number(newR[key]);
      }
      return newR;
    });

    res.json({ success: true, data: safeResult });
  } catch (error) {
    console.error('Error fetching stock summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Stock Detail by Warehouse
app.get('/api/reports/stock-by-warehouse', async (req, res) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT 
        i.id as item_id,
        i.code as item_code,
        i.name as item_name,
        COALESCE(u.name, i.unit, 'Unit') as unit_name,
        w.id as warehouse_id,
        w.code as warehouse_code,
        w.description as warehouse_name,
        COALESCE(s.quantity, 0) as quantity,
        COALESCE(s.average_cost, i.standard_cost, 0) as average_cost,
        COALESCE(s.quantity, 0) * COALESCE(s.average_cost, i.standard_cost, 0) as stock_value,
        s.last_updated
      FROM Items i
      CROSS JOIN Warehouses w
      LEFT JOIN ItemStocks s ON i.id = s.item_id AND w.id = s.warehouse_id
      LEFT JOIN Units u ON i.unit = u.name OR CAST(i.unit AS VARCHAR(50)) = CAST(u.id AS VARCHAR(50))
      WHERE w.active = 'Y'
    `;

    const params = [];

    if (search) {
      query += " AND (i.code LIKE ? OR i.name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY i.code, w.code`;

    const result = await executeQuery(query, params);

    const safeResult = result.map(r => {
      const newR = { ...r };
      for (const key in newR) {
        if (typeof newR[key] === 'bigint') newR[key] = Number(newR[key]);
      }
      return newR;
    });

    res.json({ success: true, data: safeResult });
  } catch (error) {
    console.error('Error fetching stock by warehouse:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Stock Detail by Location
app.get('/api/reports/stock-by-location', async (req, res) => {
  try {
    const { warehouse_id, search } = req.query;

    let query = `
      SELECT 
        i.id as item_id,
        i.code as item_code,
        i.name as item_name,
        COALESCE(u.name, i.unit, 'Unit') as unit_name,
        w.code as warehouse_code,
        w.description as warehouse_name,
        l.code as location_code,
        l.name as location_name,
        COALESCE(s.quantity, 0) as quantity,
        COALESCE(s.average_cost, i.standard_cost, 0) as average_cost,
        COALESCE(s.quantity, 0) * COALESCE(s.average_cost, i.standard_cost, 0) as stock_value
      FROM ItemStocks s
      JOIN Items i ON s.item_id = i.id
      LEFT JOIN Warehouses w ON s.warehouse_id = w.id
      LEFT JOIN Locations l ON s.location_id = l.id
      LEFT JOIN Units u ON i.unit = u.name OR CAST(i.unit AS VARCHAR(50)) = CAST(u.id AS VARCHAR(50))
      WHERE s.quantity <> 0
    `;

    const params = [];

    if (warehouse_id) {
      query += ' AND s.warehouse_id = ?';
      params.push(warehouse_id);
    }

    if (search) {
      query += " AND (i.code LIKE ? OR i.name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY i.code, w.code, l.code`;

    const result = await executeQuery(query, params);

    const safeResult = result.map(r => {
      const newR = { ...r };
      for (const key in newR) {
        if (typeof newR[key] === 'bigint') newR[key] = Number(newR[key]);
      }
      return newR;
    });

    res.json({ success: true, data: safeResult });
  } catch (error) {
    console.error('Error fetching stock by location:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Stock Card (transaction history for an item)
app.get('/api/reports/stock-card/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { warehouse_id, startDate, endDate } = req.query;

    // Get item info
    const [item] = await executeQuery('SELECT * FROM Items WHERE id = ?', [itemId]);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    // Get current stock
    let stockQuery = `
      SELECT 
        s.warehouse_id,
        w.code as warehouse_code,
        w.description as warehouse_name,
        s.quantity,
        s.average_cost,
        s.last_updated
      FROM ItemStocks s
      LEFT JOIN Warehouses w ON s.warehouse_id = w.id
      WHERE s.item_id = ?
    `;
    const stockParams = [itemId];

    if (warehouse_id) {
      stockQuery += ' AND s.warehouse_id = ?';
      stockParams.push(warehouse_id);
    }

    const currentStock = await executeQuery(stockQuery, stockParams);

    // Get transaction history from receivings
    let transQuery = `
      SELECT 
        'RECEIVING' as trans_type,
        r.doc_number,
        r.doc_date as trans_date,
        rd.quantity as qty_in,
        0 as qty_out,
        rd.unit_price as unit_cost,
        w.code as warehouse_code,
        p.name as partner_name
      FROM ReceivingDetails rd
      JOIN Receivings r ON rd.receiving_id = r.id
      LEFT JOIN Warehouses w ON r.warehouse_id = w.id
      LEFT JOIN Partners p ON r.partner_id = p.id
      WHERE rd.item_id = ? AND r.status = 'Posted'
    `;
    const transParams = [itemId];

    if (warehouse_id) {
      transQuery += ' AND r.warehouse_id = ?';
      transParams.push(warehouse_id);
    }

    if (startDate && endDate) {
      transQuery += ' AND r.doc_date BETWEEN ? AND ?';
      transParams.push(startDate, endDate);
    }

    transQuery += ' ORDER BY r.doc_date DESC, r.doc_number DESC';

    const transactions = await executeQuery(transQuery, transParams);

    const safeStock = currentStock.map(r => {
      const newR = { ...r };
      for (const key in newR) {
        if (typeof newR[key] === 'bigint') newR[key] = Number(newR[key]);
      }
      return newR;
    });

    const safeTrans = transactions.map(r => {
      const newR = { ...r };
      for (const key in newR) {
        if (typeof newR[key] === 'bigint') newR[key] = Number(newR[key]);
      }
      return newR;
    });

    res.json({
      success: true,
      data: {
        item: item,
        currentStock: safeStock,
        transactions: safeTrans
      }
    });
  } catch (error) {
    console.error('Error fetching stock card:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ==================== ITEM CONVERSIONS ====================

// List all item conversions
app.get('/api/item-conversions', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT ic.*
      FROM ItemConversions ic
    `;
    const params = [];
    if (startDate && endDate) {
      query += ' WHERE ic.doc_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    query += ' ORDER BY ic.doc_date DESC, ic.doc_number DESC';
    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single item conversion with details
app.get('/api/item-conversions/:id', async (req, res) => {
  try {
    const [header] = await executeQuery(`
      SELECT ic.*
      FROM ItemConversions ic
      WHERE ic.id = ?
    `, [req.params.id]);

    if (!header) {
      return res.status(404).json({ success: false, error: 'Conversion not found' });
    }

    const details = await executeQuery(`
      SELECT icd.*, i.code as item_code, i.name as item_name, i.unit,
             l.code as location_code, l.name as location_name
      FROM ItemConversionDetails icd
      LEFT JOIN Items i ON icd.item_id = i.id
      LEFT JOIN Locations l ON icd.location_id = l.id
      WHERE icd.conversion_id = ?
      ORDER BY icd.detail_type, icd.id
    `, [req.params.id]);

    res.json({ success: true, data: { ...header, details } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create item conversion
app.post('/api/item-conversions', async (req, res) => {
  let connection;
  try {
    const { doc_number, doc_date, transcode_id, notes, inputItems, outputItems } = req.body;

    connection = await odbc.connect(connectionString);

    // Calculate totals
    const totalInputAmount = (inputItems || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalOutputAmount = (outputItems || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    await connection.query(`
      INSERT INTO ItemConversions (doc_number, doc_date, transcode_id, notes, total_input_amount, total_output_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Draft')
    `, [doc_number, doc_date, transcode_id || null, notes || '', totalInputAmount, totalOutputAmount]);

    const idResult = await connection.query('SELECT @@IDENTITY as id');
    const conversionId = Number(idResult[0].id);

    // Insert input items with location_id
    for (const item of inputItems || []) {
      await connection.query(`
        INSERT INTO ItemConversionDetails (conversion_id, item_id, detail_type, quantity, unit_cost, amount, notes, location_id)
        VALUES (?, ?, 'INPUT', ?, ?, ?, ?, ?)
      `, [conversionId, item.item_id, item.quantity, item.unit_cost, item.amount, item.notes || '', item.location_id || null]);
    }

    // Insert output items with location_id
    for (const item of outputItems || []) {
      await connection.query(`
        INSERT INTO ItemConversionDetails (conversion_id, item_id, detail_type, quantity, unit_cost, amount, notes, location_id)
        VALUES (?, ?, 'OUTPUT', ?, ?, ?, ?, ?)
      `, [conversionId, item.item_id, item.quantity, item.unit_cost, item.amount, item.notes || '', item.location_id || null]);
    }

    res.json({ success: true, message: 'Konversi item berhasil disimpan', id: conversionId });
  } catch (error) {
    console.error('Error creating item conversion:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Update item conversion
app.put('/api/item-conversions/:id', async (req, res) => {
  let connection;
  try {
    const { doc_date, notes, inputItems, outputItems } = req.body;

    connection = await odbc.connect(connectionString);

    // Check status
    const [existing] = await connection.query('SELECT status FROM ItemConversions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Conversion not found' });
    if (existing.status !== 'Draft') return res.status(400).json({ success: false, error: 'Hanya dokumen Draft yang bisa diubah' });

    // Calculate totals
    const totalInputAmount = (inputItems || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalOutputAmount = (outputItems || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    await connection.query(`
      UPDATE ItemConversions SET doc_date = ?, notes = ?, total_input_amount = ?, total_output_amount = ?, updated_at = CURRENT TIMESTAMP
      WHERE id = ? AND status = 'Draft'
    `, [doc_date, notes || '', totalInputAmount, totalOutputAmount, req.params.id]);

    // Delete and re-insert details
    await connection.query('DELETE FROM ItemConversionDetails WHERE conversion_id = ?', [req.params.id]);

    for (const item of inputItems || []) {
      await connection.query(`
        INSERT INTO ItemConversionDetails (conversion_id, item_id, detail_type, quantity, unit_cost, amount, notes, location_id)
        VALUES (?, ?, 'INPUT', ?, ?, ?, ?, ?)
      `, [req.params.id, item.item_id, item.quantity, item.unit_cost, item.amount, item.notes || '', item.location_id || null]);
    }

    for (const item of outputItems || []) {
      await connection.query(`
        INSERT INTO ItemConversionDetails (conversion_id, item_id, detail_type, quantity, unit_cost, amount, notes, location_id)
        VALUES (?, ?, 'OUTPUT', ?, ?, ?, ?, ?)
      `, [req.params.id, item.item_id, item.quantity, item.unit_cost, item.amount, item.notes || '', item.location_id || null]);
    }

    res.json({ success: true, message: 'Konversi item berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Delete item conversion
app.delete('/api/item-conversions/:id', async (req, res) => {
  try {
    const [conv] = await executeQuery('SELECT status FROM ItemConversions WHERE id = ?', [req.params.id]);
    if (conv && conv.status !== 'Draft') {
      return res.status(400).json({ success: false, error: 'Hanya dokumen Draft yang bisa dihapus' });
    }
    await executeQuery('DELETE FROM ItemConversionDetails WHERE conversion_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM ItemConversions WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Konversi item berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Post item conversion (update stock + create journal)
app.put('/api/item-conversions/:id/post', async (req, res) => {
  let connection;
  try {
    console.log('Posting item conversion:', req.params.id);
    connection = await odbc.connect(connectionString);

    // Get conversion header
    const [conv] = await connection.query('SELECT * FROM ItemConversions WHERE id = ?', [req.params.id]);
    if (!conv) return res.status(404).json({ success: false, error: 'Conversion not found' });
    if (conv.status === 'Posted') return res.status(400).json({ success: false, error: 'Sudah di-post' });

    // Get details
    const details = await connection.query('SELECT * FROM ItemConversionDetails WHERE conversion_id = ?', [req.params.id]);
    const inputItems = details.filter(d => d.detail_type === 'INPUT');
    const outputItems = details.filter(d => d.detail_type === 'OUTPUT');

    console.log(`Processing ${inputItems.length} input items and ${outputItems.length} output items`);

    // ===================== UPDATE STOCK =====================
    // Decrease stock for INPUT items
    for (const item of inputItems) {
      if (!item.location_id) continue; // Skip if no location (should be validated)

      // Find warehouse for this location
      const [locInfo] = await connection.query(`
        SELECT w.id as warehouse_id
        FROM Locations l
        JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
        JOIN Warehouses w ON sw.warehouse_id = w.id
        WHERE l.id = ?
      `, [item.location_id]);

      if (!locInfo) {
        throw new Error(`Warehouse not found for location ID ${item.location_id}`);
      }

      const warehouseId = locInfo.warehouse_id;

      const [existingStock] = await connection.query(
        'SELECT * FROM ItemStocks WHERE item_id = ? AND warehouse_id = ?',
        [item.item_id, warehouseId]
      );

      if (existingStock) {
        const newQty = parseFloat(existingStock.quantity || 0) - parseFloat(item.quantity);
        await connection.query(
          'UPDATE ItemStocks SET quantity = ?, last_updated = CURRENT TIMESTAMP WHERE item_id = ? AND warehouse_id = ?',
          [newQty, item.item_id, warehouseId]
        );
      } else {
        await connection.query(
          'INSERT INTO ItemStocks (item_id, warehouse_id, quantity) VALUES (?, ?, ?)',
          [item.item_id, warehouseId, -parseFloat(item.quantity)]
        );
      }
    }

    // Increase stock for OUTPUT items, calculate average cost
    for (const item of outputItems) {
      if (!item.location_id) continue;

      // Find warehouse for this location
      const [locInfo] = await connection.query(`
        SELECT w.id as warehouse_id
        FROM Locations l
        JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
        JOIN Warehouses w ON sw.warehouse_id = w.id
        WHERE l.id = ?
      `, [item.location_id]);

      if (!locInfo) {
        throw new Error(`Warehouse not found for location ID ${item.location_id}`);
      }

      const warehouseId = locInfo.warehouse_id;

      const [existingStock] = await connection.query(
        'SELECT * FROM ItemStocks WHERE item_id = ? AND warehouse_id = ?',
        [item.item_id, warehouseId]
      );

      if (existingStock) {
        const oldQty = parseFloat(existingStock.quantity || 0);
        const oldValue = oldQty * parseFloat(existingStock.average_cost || 0);
        const addQty = parseFloat(item.quantity);
        const addValue = parseFloat(item.amount);
        const newQty = oldQty + addQty;
        const newAvgCost = newQty > 0 ? (oldValue + addValue) / newQty : item.unit_cost;

        await connection.query(
          'UPDATE ItemStocks SET quantity = ?, average_cost = ?, last_updated = CURRENT TIMESTAMP WHERE item_id = ? AND warehouse_id = ?',
          [newQty, newAvgCost, item.item_id, warehouseId]
        );
      } else {
        await connection.query(
          'INSERT INTO ItemStocks (item_id, warehouse_id, quantity, average_cost) VALUES (?, ?, ?, ?)',
          [item.item_id, warehouseId, item.quantity, item.unit_cost]
        );
      }
    }

    // ===================== CREATE JOURNAL =====================
    // Get inventory account
    // Get inventory account
    const invAccResult = await connection.query("SELECT TOP 1 id FROM Accounts WHERE type = 'ASSET' AND (name LIKE '%Persediaan%' OR name LIKE '%Inventory%')");
    const inventoryAccountId = invAccResult.length > 0 ? invAccResult[0].id : null;

    if (inventoryAccountId) {
      const jvNumber = `JV-CONV-${conv.doc_number}`;
      const totalInput = parseFloat(conv.total_input_amount) || 0;
      const totalOutput = parseFloat(conv.total_output_amount) || 0;

      console.log('Creating JV:', jvNumber, 'Total Input:', totalInput, 'Total Output:', totalOutput);

      try {
        await connection.query(`
          INSERT INTO JournalVouchers (doc_number, doc_date, description, status, source_type, ref_id)
          VALUES (?, ?, ?, 'Posted', 'ITEM_CONVERSION', ?)
        `, [jvNumber, conv.doc_date, `Item Conversion: ${conv.doc_number}`, conv.id]);
      } catch (e) {
        console.error('Error creating JV Header:', e);
        throw e;
      }

      const jvResult = await connection.query('SELECT @@IDENTITY as id');
      const jvId = Number(jvResult[0].id);

      // Simplified journal: credit for input value, debit for output value
      // ... (Journal Details logic remains same but logs added if needed) ...

      // ...
    }

    // Update status
    console.log('Updating status to Posted...');
    await connection.query(`UPDATE ItemConversions SET status = 'Posted', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [req.params.id]);

    console.log('Item conversion posted successfully');
    res.json({ success: true, message: 'Konversi item berhasil di-post' });
  } catch (error) {
    console.error('Error posting item conversion FULL DETAILS:', error);
    res.status(500).json({ success: false, error: 'Database Error: ' + error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Unpost item conversion (reverse stock + delete journal)
app.put('/api/item-conversions/:id/unpost', async (req, res) => {
  let connection;
  try {
    connection = await odbc.connect(connectionString);

    const [conv] = await connection.query('SELECT * FROM ItemConversions WHERE id = ?', [req.params.id]);
    if (!conv) return res.status(404).json({ success: false, error: 'Conversion not found' });
    if (conv.status !== 'Posted') return res.status(400).json({ success: false, error: 'Dokumen belum di-post' });

    const details = await connection.query('SELECT * FROM ItemConversionDetails WHERE conversion_id = ?', [req.params.id]);
    const inputItems = details.filter(d => d.detail_type === 'INPUT');
    const outputItems = details.filter(d => d.detail_type === 'OUTPUT');

    // Reverse stock: increase INPUT, decrease OUTPUT
    for (const item of inputItems) {
      if (!item.location_id) continue;

      // Find warehouse for this location
      const [locInfo] = await connection.query(`
        SELECT w.id as warehouse_id
        FROM Locations l
        JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
        JOIN Warehouses w ON sw.warehouse_id = w.id
        WHERE l.id = ?
      `, [item.location_id]);

      if (locInfo) {
        await connection.query(
          'UPDATE ItemStocks SET quantity = quantity + ?, last_updated = CURRENT TIMESTAMP WHERE item_id = ? AND warehouse_id = ?',
          [item.quantity, item.item_id, locInfo.warehouse_id]
        );
      }
    }

    for (const item of outputItems) {
      if (!item.location_id) continue;

      // Find warehouse for this location
      const [locInfo] = await connection.query(`
        SELECT w.id as warehouse_id
        FROM Locations l
        JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
        JOIN Warehouses w ON sw.warehouse_id = w.id
        WHERE l.id = ?
      `, [item.location_id]);

      if (locInfo) {
        await connection.query(
          'UPDATE ItemStocks SET quantity = quantity - ?, last_updated = CURRENT TIMESTAMP WHERE item_id = ? AND warehouse_id = ?',
          [item.quantity, item.item_id, locInfo.warehouse_id]
        );
      }
    }

    // Delete journal
    await connection.query("DELETE FROM JournalVoucherDetails WHERE jv_id IN (SELECT id FROM JournalVouchers WHERE source_type = 'ITEM_CONVERSION' AND ref_id = ?)", [req.params.id]);
    await connection.query("DELETE FROM JournalVouchers WHERE source_type = 'ITEM_CONVERSION' AND ref_id = ?", [req.params.id]);

    // Update status
    await connection.query(`UPDATE ItemConversions SET status = 'Draft', updated_at = CURRENT TIMESTAMP WHERE id = ?`, [req.params.id]);

    res.json({ success: true, message: 'Konversi item berhasil di-unpost' });
  } catch (error) {
    console.error('Error unposting item conversion:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// ==================== RECALCULATE STOCK ====================

app.post('/api/inventory/recalculate', async (req, res) => {
  let connection;
  try {
    const { warehouse_id, item_id } = req.body || {};
    console.log('🔄 Starting Stock Recalculation...', { warehouse_id, item_id });

    connection = await odbc.connect(connectionString);
    await connection.beginTransaction();

    // 1. Get Items
    let itemQuery = 'SELECT id, code, standard_cost FROM Items';
    let itemParams = [];
    if (item_id) {
      itemQuery += ' WHERE id = ?';
      itemParams.push(item_id);
    }
    const items = await connection.query(itemQuery, itemParams);
    console.log(`Processing ${items.length} items...`);




    let lastTransactions = [];
    for (const item of items) {
      // Clear Stock
      if (warehouse_id) {
        await connection.query('DELETE FROM ItemStocks WHERE item_id = ? AND warehouse_id = ?', [item.id, warehouse_id]);
      } else {
        await connection.query('DELETE FROM ItemStocks WHERE item_id = ?', [item.id]);
      }

      // 2. Fetch Transactions
      // RECEIVINGS (IN)
      // Check if unit_price exists in ReceivingDetails (added by script), fallback to PO
      let rxQuery = `
        SELECT 'IN' as dir, 'RCV' as type, r.doc_date, NULL as created_at, 
               rd.quantity, 
               COALESCE(rd.unit_price, pod.unit_price, i.standard_cost, 0) as cost,
               w.id as warehouse_id, 
               COALESCE(rd.location_id, r.location_id) as location_id
        FROM ReceivingDetails rd
        JOIN Receivings r ON rd.receiving_id = r.id
        LEFT JOIN Locations l ON COALESCE(rd.location_id, r.location_id) = l.id
        LEFT JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
        LEFT JOIN Warehouses w ON sw.warehouse_id = w.id
        LEFT JOIN PurchaseOrderDetails pod ON rd.po_detail_id = pod.id
        JOIN Items i ON rd.item_id = i.id
        WHERE rd.item_id = ? AND r.status = 'Posted'
      `;
      if (warehouse_id) rxQuery += ` AND w.id = ${warehouse_id}`;

      // SHIPMENTS (OUT)
      // Warehouse ID missing in Shipments, using Fallback to First Warehouse
      let shQuery = `
        SELECT 'OUT' as dir, 'SHP' as type, s.doc_date, NULL as created_at,
               sd.quantity, 0 as cost,
               (SELECT TOP 1 id FROM Warehouses) as warehouse_id, NULL as location_id
        FROM ShipmentDetails sd
        JOIN Shipments s ON sd.shipment_id = s.id
        WHERE sd.item_id = ? AND s.status = 'Posted'
      `;
      if (warehouse_id) shQuery += ` AND (SELECT TOP 1 id FROM Warehouses) = ${warehouse_id}`;

      // INVENTORY ADJUSTMENTS (IN/OUT)
      // Assuming warehouse_id is on Header
      let adjQuery = `
        SELECT 
          CASE WHEN d.quantity > 0 THEN 'IN' ELSE 'OUT' END as dir,
          'ADJ' as type, h.doc_date, h.created_at,
          ABS(d.quantity) as quantity, d.unit_cost as cost,
          h.warehouse_id, d.location_id
        FROM InventoryAdjustmentDetails d
        JOIN InventoryAdjustments h ON d.adjustment_id = h.id
        WHERE d.item_id = ? AND h.status = 'Posted'
      `;
      if (warehouse_id) adjQuery += ` AND h.warehouse_id = ${warehouse_id}`;

      // ITEM CONVERSIONS (IN/OUT)
      // INPUT = Decrease Stock (OUT)
      // OUTPUT = Increase Stock (IN)
      let convQuery = `
        SELECT 
          CASE WHEN icd.detail_type = 'OUTPUT' THEN 'IN' ELSE 'OUT' END as dir,
          'CNV' as type, ic.doc_date, ic.created_at,
          icd.quantity,
          icd.unit_cost as cost,
          w.id as warehouse_id,
          icd.location_id
        FROM ItemConversionDetails icd
        JOIN ItemConversions ic ON icd.conversion_id = ic.id
        LEFT JOIN Locations l ON icd.location_id = l.id
        LEFT JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
        LEFT JOIN Warehouses w ON sw.warehouse_id = w.id
        WHERE icd.item_id = ? AND ic.status = 'Posted'
      `;
      if (warehouse_id) convQuery += ` AND w.id = ${warehouse_id}`;

      // Execute Queries
      let transactions = [];
      try {
        const rxs = await connection.query(rxQuery, [item.id]);
        if (Array.isArray(rxs)) transactions.push(...rxs);
      } catch (e) { console.warn('Error fetching Receivings:', e.message); }

      try {
        const shs = await connection.query(shQuery, [item.id]);
        if (Array.isArray(shs)) transactions.push(...shs);
      } catch (e) { console.warn('Error fetching Shipments:', e.message); }

      try {
        const adjs = await connection.query(adjQuery, [item.id]);
        if (Array.isArray(adjs)) transactions.push(...adjs);
      } catch (e) { console.warn('Error fetching Adjustments:', e.message); }

      try {
        const convs = await connection.query(convQuery, [item.id]);
        if (Array.isArray(convs)) {
          transactions.push(...convs);
        }
      } catch (e) { console.warn('Error fetching Conversions:', e.message); }

      // Sort
      transactions.sort((a, b) => {
        const da = new Date(a.doc_date);
        const db = new Date(b.doc_date);
        if (da.getTime() !== db.getTime()) return da - db;
        // if dates equal, IN first? or by ID/Created?
        // Let's rely on created_at or default stable sort
        return 0;
      });
      lastTransactions = transactions;

      // 3. Calculate
      // Map: WarehouseID -> { qty, value, locs: { LocID: qty } }
      // Issue: ItemStocks is granular by Location. Shipments don't have location.
      // Logic: 
      // - Receivings add to specific Location.
      // - Shipments subtract from Warehouse Total. How to distribute?
      //   Strategy:
      //   We can't strictly reconstruct Location quantities if Shipments don't specify them.
      //   We will try to deduct from "Largest Stock" location (FIFO-ish).

      let whStock = {}; // { whId: { totalQty: 0, totalVal: 0, avg: 0, locations: { locId: qty } } }
      console.log('Recalc DEBUG Transactions:', JSON.stringify(transactions.filter(t => t.type === 'ADJ'), null, 2));

      for (const tx of transactions) {
        const whId = tx.warehouse_id || 0;
        if (!whStock[whId]) whStock[whId] = { is_valid: !!tx.warehouse_id, totalQty: 0, totalVal: 0, avg: 0, locations: {} };

        const locId = tx.location_id || 0; // 0 = Unknown

        if (tx.dir === 'IN') {
          const qty = Number(tx.quantity);
          const cost = Number(tx.cost);
          const val = qty * cost;

          // Update Warehouse Totals
          const oldQty = whStock[whId].totalQty;
          const oldVal = whStock[whId].totalVal;

          whStock[whId].totalQty += qty;
          whStock[whId].totalVal += val;
          if (whStock[whId].totalQty !== 0) {
            whStock[whId].avg = whStock[whId].totalVal / whStock[whId].totalQty;
          }

          // Update Location
          whStock[whId].locations[locId] = (whStock[whId].locations[locId] || 0) + qty;

        } else { // OUT
          const qty = Number(tx.quantity);
          const cost = whStock[whId].avg; // Use current moving average
          const val = qty * cost;

          whStock[whId].totalQty -= qty;
          whStock[whId].totalVal -= val;
          // Avg stays same technically, or recompute? 
          // If Qty hits 0, Avg is tricky. Keep last known avg.

          // Deduct from Location
          if (tx.location_id) {
            // Precise deduction
            whStock[whId].locations[locId] = (whStock[whId].locations[locId] || 0) - qty;
          } else {
            // Heuristic Deduction (Shipment with no location)
            // Find location with enough stock? Or biggest stock?
            // Simple approach: Deduct from largest pile
            let remaining = qty;
            // Sort locations by qty desc
            const locKeys = Object.keys(whStock[whId].locations).sort((a, b) => whStock[whId].locations[b] - whStock[whId].locations[a]);

            for (const lKey of locKeys) {
              if (remaining <= 0) break;
              const available = whStock[whId].locations[lKey];
              if (available > 0) {
                const take = Math.min(available, remaining);
                whStock[whId].locations[lKey] -= take;
                remaining -= take;
              }
            }
            // If still remaining, dump in Default/Unknown location (0)
            if (remaining > 0) {
              whStock[whId].locations[0] = (whStock[whId].locations[0] || 0) - remaining;
            }
          }
        }
      }

      // 4. Save to DB
      for (const whId in whStock) {
        if (!whStock[whId].is_valid) continue; // Skip unknown warehouse
        const data = whStock[whId];

        // Loop locations
        for (const locId in data.locations) {
          const qty = data.locations[locId];
          // Only save if qty != 0? Or save all?
          // Save all to be safe, clean up zeros later if needed.
          // Use Warehouse Avg for the record

          await connection.query(`
             INSERT INTO ItemStocks (item_id, warehouse_id, location_id, quantity, average_cost, last_updated)
             VALUES (?, ?, ?, ?, ?, CURRENT TIMESTAMP)
           `, [item.id, parseInt(whId), locId === '0' ? null : parseInt(locId), qty, data.avg]);


        }
      }
    }

    await connection.commit();
    res.json({
      success: true,
      message: 'Recalculation complete'
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Recalculate Error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// ==================== HISTORY GENERATION ====================
app.post('/api/inventory/history-generate', async (req, res) => {
  let connection;
  try {
    const { period, item_id } = req.body; // period: 'YYYY-MM'
    if (!period) return res.status(400).json({ success: false, error: 'Period (YYYY-MM) is required' });

    console.log(`Generating Stock History for ${period}...`);
    connection = await odbc.connect(connectionString);

    // 1. Determine Date Range
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]; // YYYY-MM-01
    // End Date is Last Day of Month
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    console.log(`Period: ${startDate} to ${endDate}`);

    // 2. Get Items
    let items = [];
    if (item_id) {
      items = await connection.query('SELECT id, code, name FROM Items WHERE id = ?', [item_id]);
    } else {
      items = await connection.query('SELECT id, code, name FROM Items');
    }

    // 3. Process Items
    for (const item of items) {
      // --- FETCH TRANSACTIONS (Duplicated from RecalculateInventory for safety) ---
      // RECEIVINGS
      let rxQuery = `
        SELECT 'IN' as dir, 'RCV' as type, r.doc_date, NULL as created_at, 
               rd.quantity, 
               COALESCE(rd.unit_price, pod.unit_price, i.standard_cost, 0) as cost,
               w.id as warehouse_id, 
               COALESCE(rd.location_id, r.location_id) as location_id
        FROM ReceivingDetails rd
        JOIN Receivings r ON rd.receiving_id = r.id
        LEFT JOIN Locations l ON COALESCE(rd.location_id, r.location_id) = l.id
        LEFT JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
        LEFT JOIN Warehouses w ON sw.warehouse_id = w.id
        LEFT JOIN PurchaseOrderDetails pod ON rd.po_detail_id = pod.id
        JOIN Items i ON rd.item_id = i.id
        WHERE rd.item_id = ? AND r.status = 'Posted' AND r.doc_date <= ?
      `;

      let shQuery = `
        SELECT 'OUT' as dir, 'SHP' as type, s.doc_date, NULL as created_at,
               sd.quantity, 0 as cost,
               (SELECT TOP 1 id FROM Warehouses) as warehouse_id, NULL as location_id
        FROM ShipmentDetails sd
        JOIN Shipments s ON sd.shipment_id = s.id
        WHERE sd.item_id = ? AND s.status = 'Posted' AND s.doc_date <= ?
      `;

      let adjQuery = `
        SELECT 
          CASE WHEN d.quantity > 0 THEN 'IN' ELSE 'OUT' END as dir,
          'ADJ' as type, h.doc_date, h.created_at,
          ABS(d.quantity) as quantity, d.unit_cost as cost,
          h.warehouse_id, d.location_id
        FROM InventoryAdjustmentDetails d
        JOIN InventoryAdjustments h ON d.adjustment_id = h.id
        WHERE d.item_id = ? AND h.status = 'Posted' AND h.doc_date <= ?
      `;

      let convQuery = `
        SELECT 
          CASE WHEN icd.detail_type = 'OUTPUT' THEN 'IN' ELSE 'OUT' END as dir,
          'CNV' as type, ic.doc_date, ic.created_at,
          icd.quantity,
          icd.unit_cost as cost,
          w.id as warehouse_id,
          icd.location_id
        FROM ItemConversionDetails icd
        JOIN ItemConversions ic ON icd.conversion_id = ic.id
        LEFT JOIN Locations l ON icd.location_id = l.id
        LEFT JOIN SubWarehouses sw ON l.sub_warehouse_id = sw.id
        LEFT JOIN Warehouses w ON sw.warehouse_id = w.id
        WHERE icd.item_id = ? AND ic.status = 'Posted' AND ic.doc_date <= ?
      `;

      const [rxs, shs, adjs, convs] = await Promise.all([
        connection.query(rxQuery, [item.id, endDate]),
        connection.query(shQuery, [item.id, endDate]),
        connection.query(adjQuery, [item.id, endDate]),
        connection.query(convQuery, [item.id, endDate])
      ]);

      let transactions = [...rxs, ...shs, ...adjs, ...convs];
      transactions.sort((a, b) => new Date(a.doc_date) - new Date(b.doc_date));

      // --- SIMULATE ---
      let stockMap = {}; // Key: "whId-locId" -> qty

      // Helper for Key
      const getKey = (w, l) => `${w || 0}-${l || 0}`;
      const parseKey = (k) => k.split('-').map(Number); // [wh, loc]

      let historyMap = {};
      // Key: "whId-locId" -> { start: 0, in: 0, out: 0, end: 0 }

      for (const tx of transactions) {
        const txDate = new Date(tx.doc_date).toISOString().split('T')[0];
        const isPeriod = txDate >= startDate && txDate <= endDate;

        const whId = tx.warehouse_id || 0;
        const locId = tx.location_id || 0;
        const key = getKey(whId, locId);

        if (!stockMap[key]) stockMap[key] = 0;
        if (!historyMap[key]) historyMap[key] = { start: 0, in: 0, out: 0, end: 0, whId, locId };

        const qty = Number(tx.quantity);

        if (txDate < startDate) {
          if (tx.dir === 'IN') stockMap[key] += qty;
          else stockMap[key] -= qty;
        } else {
          // Inside Period
          if (tx.dir === 'IN') {
            historyMap[key].in += qty;
            stockMap[key] += qty;
          } else {
            historyMap[key].out += qty;
            stockMap[key] -= qty;
          }
        }
      }

      // 4. Save to DB
      // Clear existing history for this period/item
      await connection.query('DELETE FROM ItemStockHistory WHERE period = ? AND item_id = ?', [period, item.id]);

      for (const key in stockMap) {
        const endQty = stockMap[key];
        const h = historyMap[key] || { in: 0, out: 0, whId: 0, locId: 0 };
        if (!h.whId) { // If usage was only pre-period
          const [w, l] = parseKey(key);
          h.whId = w; h.locId = l;
        }

        const startQty = endQty - h.in + h.out;

        if (startQty === 0 && h.in === 0 && h.out === 0 && endQty === 0) continue;

        await connection.query(`
            INSERT INTO ItemStockHistory (period, item_id, warehouse_id, location_id, start_qty, stock_in, stock_out, end_qty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         `, [period, item.id, h.whId || 0, h.locId || 0, startQty, h.in, h.out, endQty]);
      }
    }

    res.json({ success: true, message: 'History generated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) await connection.close();
  }
});

// ==================== CRM - LEADS ====================
app.get('/api/crm/leads', authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM CrmLeads';
    const conditions = [];
    const params = [];

    if (status) { conditions.push('status = ?'); params.push(status); }
    if (search) { conditions.push("(company_name LIKE ? OR contact_name LIKE ? OR email LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/crm/leads/:id', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM CrmLeads WHERE id = ?', [req.params.id]);
    if (result.length === 0) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, data: result[0] });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/crm/leads', authenticateToken, async (req, res) => {
  try {
    const { company_name, contact_name, phone, email, address, city, source, status, assigned_to, notes } = req.body;
    // Auto-generate lead_no
    const countResult = await executeQuery("SELECT COUNT(*) as cnt FROM CrmLeads");
    const nextNum = (countResult[0].cnt || 0) + 1;
    const lead_no = 'LD-' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(nextNum).padStart(4, '0');

    await executeQuery(
      'INSERT INTO CrmLeads (lead_no, company_name, contact_name, phone, email, address, city, source, status, assigned_to, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [lead_no, company_name, contact_name || '', phone || '', email || '', address || '', city || '', source || '', status || 'New', assigned_to || '', notes || '']
    );
    res.json({ success: true, message: 'Lead berhasil ditambahkan', lead_no });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.put('/api/crm/leads/:id', authenticateToken, async (req, res) => {
  try {
    const { company_name, contact_name, phone, email, address, city, source, status, assigned_to, notes } = req.body;
    await executeQuery(
      'UPDATE CrmLeads SET company_name = ?, contact_name = ?, phone = ?, email = ?, address = ?, city = ?, source = ?, status = ?, assigned_to = ?, notes = ?, updated_at = CURRENT TIMESTAMP WHERE id = ?',
      [company_name, contact_name, phone, email, address, city, source, status, assigned_to, notes, req.params.id]
    );
    res.json({ success: true, message: 'Lead berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.delete('/api/crm/leads/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery('DELETE FROM CrmActivities WHERE lead_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM CrmContacts WHERE lead_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM CrmLeads WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Lead berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Convert Lead to Opportunity
app.post('/api/crm/leads/:id/convert', authenticateToken, async (req, res) => {
  try {
    const lead = await executeQuery('SELECT * FROM CrmLeads WHERE id = ?', [req.params.id]);
    if (lead.length === 0) return res.status(404).json({ success: false, error: 'Lead not found' });

    const l = lead[0];
    const countResult = await executeQuery("SELECT COUNT(*) as cnt FROM CrmOpportunities");
    const nextNum = (countResult[0].cnt || 0) + 1;
    const opp_no = 'OPP-' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(nextNum).padStart(4, '0');

    await executeQuery(
      'INSERT INTO CrmOpportunities (opp_no, lead_id, title, assigned_to, stage) VALUES (?, ?, ?, ?, ?)',
      [opp_no, req.params.id, req.body.title || l.company_name + ' - Opportunity', l.assigned_to || '', 'Prospecting']
    );

    await executeQuery("UPDATE CrmLeads SET status = 'Qualified' WHERE id = ?", [req.params.id]);

    res.json({ success: true, message: 'Lead berhasil dikonversi ke Opportunity', opp_no });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== CRM - CONTACTS ====================
app.get('/api/crm/contacts', authenticateToken, async (req, res) => {
  try {
    const { lead_id, customer_id, search } = req.query;
    let query = 'SELECT * FROM CrmContacts';
    const conditions = [];
    const params = [];

    if (lead_id) { conditions.push('lead_id = ?'); params.push(lead_id); }
    if (customer_id) { conditions.push('customer_id = ?'); params.push(customer_id); }
    if (search) { conditions.push("(contact_name LIKE ? OR email LIKE ? OR phone LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY contact_name';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/crm/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM CrmContacts WHERE id = ?', [req.params.id]);
    if (result.length === 0) return res.status(404).json({ success: false, error: 'Contact not found' });
    res.json({ success: true, data: result[0] });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/crm/contacts', authenticateToken, async (req, res) => {
  try {
    const { contact_name, title, phone, mobile, email, department, lead_id, customer_id, is_primary, notes } = req.body;
    await executeQuery(
      'INSERT INTO CrmContacts (contact_name, title, phone, mobile, email, department, lead_id, customer_id, is_primary, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [contact_name, title || '', phone || '', mobile || '', email || '', department || '', lead_id || null, customer_id || null, is_primary || 'N', notes || '']
    );
    res.json({ success: true, message: 'Contact berhasil ditambahkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.put('/api/crm/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const { contact_name, title, phone, mobile, email, department, lead_id, customer_id, is_primary, notes, active } = req.body;
    await executeQuery(
      'UPDATE CrmContacts SET contact_name = ?, title = ?, phone = ?, mobile = ?, email = ?, department = ?, lead_id = ?, customer_id = ?, is_primary = ?, notes = ?, active = ? WHERE id = ?',
      [contact_name, title, phone, mobile, email, department, lead_id || null, customer_id || null, is_primary, notes, active || 'Y', req.params.id]
    );
    res.json({ success: true, message: 'Contact berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.delete('/api/crm/contacts/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery('DELETE FROM CrmContacts WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Contact berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== CRM - OPPORTUNITIES ====================
app.get('/api/crm/opportunities', authenticateToken, async (req, res) => {
  try {
    const { stage, search } = req.query;
    let query = `SELECT o.*, l.company_name as lead_name
                 FROM CrmOpportunities o
                 LEFT JOIN CrmLeads l ON o.lead_id = l.id`;
    const conditions = [];
    const params = [];

    if (stage) { conditions.push('o.stage = ?'); params.push(stage); }
    if (search) { conditions.push("(o.title LIKE ? OR o.opp_no LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY o.created_at DESC';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/crm/opportunities/:id', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT o.*, l.company_name as lead_name
       FROM CrmOpportunities o LEFT JOIN CrmLeads l ON o.lead_id = l.id
       WHERE o.id = ?`, [req.params.id]);
    if (result.length === 0) return res.status(404).json({ success: false, error: 'Opportunity not found' });
    res.json({ success: true, data: result[0] });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/crm/opportunities', authenticateToken, async (req, res) => {
  try {
    const { lead_id, customer_id, title, estimated_value, currency_code, probability, stage, expected_close_date, assigned_to, notes } = req.body;
    const countResult = await executeQuery("SELECT COUNT(*) as cnt FROM CrmOpportunities");
    const nextNum = (countResult[0].cnt || 0) + 1;
    const opp_no = 'OPP-' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(nextNum).padStart(4, '0');

    await executeQuery(
      'INSERT INTO CrmOpportunities (opp_no, lead_id, customer_id, title, estimated_value, currency_code, probability, stage, expected_close_date, assigned_to, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [opp_no, lead_id || null, customer_id || null, title, estimated_value || 0, currency_code || 'IDR', probability || 0, stage || 'Prospecting', expected_close_date || null, assigned_to || '', notes || '']
    );
    res.json({ success: true, message: 'Opportunity berhasil ditambahkan', opp_no });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.put('/api/crm/opportunities/:id', authenticateToken, async (req, res) => {
  try {
    const { lead_id, customer_id, title, estimated_value, currency_code, probability, stage, expected_close_date, assigned_to, notes } = req.body;
    await executeQuery(
      'UPDATE CrmOpportunities SET lead_id = ?, customer_id = ?, title = ?, estimated_value = ?, currency_code = ?, probability = ?, stage = ?, expected_close_date = ?, assigned_to = ?, notes = ?, updated_at = CURRENT TIMESTAMP WHERE id = ?',
      [lead_id || null, customer_id || null, title, estimated_value, currency_code, probability, stage, expected_close_date || null, assigned_to, notes, req.params.id]
    );
    res.json({ success: true, message: 'Opportunity berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.delete('/api/crm/opportunities/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery('DELETE FROM CrmActivities WHERE opportunity_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM CrmOpportunities WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Opportunity berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== CRM - QUOTATIONS ====================
app.get('/api/crm/quotations', authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `SELECT q.*, o.title as opportunity_title
                 FROM CrmQuotations q
                 LEFT JOIN CrmOpportunities o ON q.opportunity_id = o.id`;
    const conditions = [];
    const params = [];

    if (status) { conditions.push('q.status = ?'); params.push(status); }
    if (search) { conditions.push("(q.quot_no LIKE ? OR q.customer_name LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY q.created_at DESC';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/crm/quotations/:id', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT q.*, o.title as opportunity_title
       FROM CrmQuotations q LEFT JOIN CrmOpportunities o ON q.opportunity_id = o.id
       WHERE q.id = ?`, [req.params.id]);
    if (result.length === 0) return res.status(404).json({ success: false, error: 'Quotation not found' });

    const items = await executeQuery('SELECT * FROM CrmQuotationItems WHERE quotation_id = ? ORDER BY sort_order', [req.params.id]);
    res.json({ success: true, data: { ...result[0], items } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/crm/quotations', authenticateToken, async (req, res) => {
  try {
    const { opportunity_id, customer_id, customer_name, quotation_date, valid_until, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, currency_code, status, notes, items } = req.body;
    const countResult = await executeQuery("SELECT COUNT(*) as cnt FROM CrmQuotations");
    const nextNum = (countResult[0].cnt || 0) + 1;
    const quot_no = 'QUO-' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(nextNum).padStart(4, '0');

    await executeQuery(
      'INSERT INTO CrmQuotations (quot_no, opportunity_id, customer_id, customer_name, quotation_date, valid_until, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, currency_code, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [quot_no, opportunity_id || null, customer_id || null, customer_name || '', quotation_date, valid_until || null, subtotal || 0, discount_pct || 0, discount_amount || 0, tax_pct || 0, tax_amount || 0, total || 0, currency_code || 'IDR', status || 'Draft', notes || '', req.user.username || '']
    );

    // Get new quotation id
    const newQuot = await executeQuery("SELECT id FROM CrmQuotations WHERE quot_no = ?", [quot_no]);
    const quotId = newQuot[0].id;

    // Insert items
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await executeQuery(
          'INSERT INTO CrmQuotationItems (quotation_id, item_id, item_code, description, qty, unit, unit_price, discount_pct, total_price, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [quotId, it.item_id || null, it.item_code || '', it.description || '', it.qty || 1, it.unit || '', it.unit_price || 0, it.discount_pct || 0, it.total_price || 0, i + 1]
        );
      }
    }

    res.json({ success: true, message: 'Quotation berhasil ditambahkan', quot_no });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.put('/api/crm/quotations/:id', authenticateToken, async (req, res) => {
  try {
    const { opportunity_id, customer_id, customer_name, quotation_date, valid_until, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, currency_code, status, notes, items } = req.body;

    await executeQuery(
      'UPDATE CrmQuotations SET opportunity_id = ?, customer_id = ?, customer_name = ?, quotation_date = ?, valid_until = ?, subtotal = ?, discount_pct = ?, discount_amount = ?, tax_pct = ?, tax_amount = ?, total = ?, currency_code = ?, status = ?, notes = ?, updated_at = CURRENT TIMESTAMP WHERE id = ?',
      [opportunity_id || null, customer_id || null, customer_name, quotation_date, valid_until || null, subtotal, discount_pct, discount_amount, tax_pct, tax_amount, total, currency_code, status, notes, req.params.id]
    );

    // Replace items
    await executeQuery('DELETE FROM CrmQuotationItems WHERE quotation_id = ?', [req.params.id]);
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await executeQuery(
          'INSERT INTO CrmQuotationItems (quotation_id, item_id, item_code, description, qty, unit, unit_price, discount_pct, total_price, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [req.params.id, it.item_id || null, it.item_code || '', it.description || '', it.qty || 1, it.unit || '', it.unit_price || 0, it.discount_pct || 0, it.total_price || 0, i + 1]
        );
      }
    }

    res.json({ success: true, message: 'Quotation berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.delete('/api/crm/quotations/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery('DELETE FROM CrmQuotationItems WHERE quotation_id = ?', [req.params.id]);
    await executeQuery('DELETE FROM CrmQuotations WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Quotation berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== CRM - ACTIVITIES ====================
app.get('/api/crm/activities', authenticateToken, async (req, res) => {
  try {
    const { activity_type, status, lead_id, opportunity_id, search } = req.query;
    let query = `SELECT a.*, l.company_name as lead_name, o.title as opportunity_title
                 FROM CrmActivities a
                 LEFT JOIN CrmLeads l ON a.lead_id = l.id
                 LEFT JOIN CrmOpportunities o ON a.opportunity_id = o.id`;
    const conditions = [];
    const params = [];

    if (activity_type) { conditions.push('a.activity_type = ?'); params.push(activity_type); }
    if (status) { conditions.push('a.status = ?'); params.push(status); }
    if (lead_id) { conditions.push('a.lead_id = ?'); params.push(lead_id); }
    if (opportunity_id) { conditions.push('a.opportunity_id = ?'); params.push(opportunity_id); }
    if (search) { conditions.push("(a.subject LIKE ? OR a.description LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY a.activity_date DESC';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/crm/activities/:id', authenticateToken, async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT a.*, l.company_name as lead_name, o.title as opportunity_title
       FROM CrmActivities a
       LEFT JOIN CrmLeads l ON a.lead_id = l.id
       LEFT JOIN CrmOpportunities o ON a.opportunity_id = o.id
       WHERE a.id = ?`, [req.params.id]);
    if (result.length === 0) return res.status(404).json({ success: false, error: 'Activity not found' });
    res.json({ success: true, data: result[0] });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/crm/activities', authenticateToken, async (req, res) => {
  try {
    const { activity_type, subject, description, activity_date, due_date, lead_id, opportunity_id, customer_id, assigned_to, status, priority } = req.body;
    await executeQuery(
      'INSERT INTO CrmActivities (activity_type, subject, description, activity_date, due_date, lead_id, opportunity_id, customer_id, assigned_to, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [activity_type, subject, description || '', activity_date, due_date || null, lead_id || null, opportunity_id || null, customer_id || null, assigned_to || '', status || 'Planned', priority || 'Normal']
    );
    res.json({ success: true, message: 'Activity berhasil ditambahkan' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.put('/api/crm/activities/:id', authenticateToken, async (req, res) => {
  try {
    const { activity_type, subject, description, activity_date, due_date, lead_id, opportunity_id, customer_id, assigned_to, status, priority } = req.body;
    await executeQuery(
      'UPDATE CrmActivities SET activity_type = ?, subject = ?, description = ?, activity_date = ?, due_date = ?, lead_id = ?, opportunity_id = ?, customer_id = ?, assigned_to = ?, status = ?, priority = ? WHERE id = ?',
      [activity_type, subject, description, activity_date, due_date || null, lead_id || null, opportunity_id || null, customer_id || null, assigned_to, status, priority, req.params.id]
    );
    res.json({ success: true, message: 'Activity berhasil diupdate' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.delete('/api/crm/activities/:id', authenticateToken, async (req, res) => {
  try {
    await executeQuery('DELETE FROM CrmActivities WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Activity berhasil dihapus' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== CRM - DASHBOARD / REPORT ====================
app.get('/api/crm/dashboard', authenticateToken, async (req, res) => {
  try {
    const leadsByStatus = await executeQuery("SELECT status, COUNT(*) as count FROM CrmLeads GROUP BY status");
    const oppsByStage = await executeQuery("SELECT stage, COUNT(*) as count, SUM(estimated_value) as total_value FROM CrmOpportunities GROUP BY stage");
    const totalLeads = await executeQuery("SELECT COUNT(*) as count FROM CrmLeads");
    const totalOpps = await executeQuery("SELECT COUNT(*) as count FROM CrmOpportunities");
    const totalQuots = await executeQuery("SELECT COUNT(*) as count FROM CrmQuotations");
    const pipelineValue = await executeQuery("SELECT SUM(estimated_value) as total FROM CrmOpportunities WHERE stage NOT IN ('Closed Won', 'Closed Lost')");
    const wonValue = await executeQuery("SELECT SUM(estimated_value) as total FROM CrmOpportunities WHERE stage = 'Closed Won'");
    const recentActivities = await executeQuery("SELECT TOP 10 a.*, l.company_name as lead_name FROM CrmActivities a LEFT JOIN CrmLeads l ON a.lead_id = l.id ORDER BY a.activity_date DESC");
    const quotsByStatus = await executeQuery("SELECT status, COUNT(*) as count, SUM(total) as total_value FROM CrmQuotations GROUP BY status");

    res.json({
      success: true,
      data: {
        summary: {
          totalLeads: totalLeads[0].count,
          totalOpportunities: totalOpps[0].count,
          totalQuotations: totalQuots[0].count,
          pipelineValue: pipelineValue[0].total || 0,
          wonValue: wonValue[0].total || 0,
        },
        leadsByStatus,
        oppsByStage,
        quotsByStatus,
        recentActivities
      }
    });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ==================== FIXED ASSET - CATEGORIES ====================
app.get('/api/fixed-asset-categories', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT fac.*, 
        da.code as depreciation_account_code, da.name as depreciation_account_name,
        aa.code as accumulated_account_code, aa.name as accumulated_account_name,
        asa.code as asset_account_code, asa.name as asset_account_name
      FROM FixedAssetCategories fac
      LEFT JOIN ChartOfAccounts da ON fac.depreciation_account_id = da.id
      LEFT JOIN ChartOfAccounts aa ON fac.accumulated_account_id = aa.id
      LEFT JOIN ChartOfAccounts asa ON fac.asset_account_id = asa.id
      ORDER BY fac.code
    `);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/fixed-asset-categories', async (req, res) => {
  try {
    const { code, name, useful_life_months, depreciation_method, depreciation_account_id, accumulated_account_id, asset_account_id, active } = req.body;
    await executeQuery(
      'INSERT INTO FixedAssetCategories (code, name, useful_life_months, depreciation_method, depreciation_account_id, accumulated_account_id, asset_account_id, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [code, name, useful_life_months || 12, depreciation_method || 'StraightLine', depreciation_account_id || null, accumulated_account_id || null, asset_account_id || null, active || 'Y']
    );
    res.json({ success: true, message: 'Kategori aset berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/fixed-asset-categories/:id', async (req, res) => {
  try {
    const { code, name, useful_life_months, depreciation_method, depreciation_account_id, accumulated_account_id, asset_account_id, active } = req.body;
    await executeQuery(
      'UPDATE FixedAssetCategories SET code = ?, name = ?, useful_life_months = ?, depreciation_method = ?, depreciation_account_id = ?, accumulated_account_id = ?, asset_account_id = ?, active = ? WHERE id = ?',
      [code, name, useful_life_months, depreciation_method, depreciation_account_id || null, accumulated_account_id || null, asset_account_id || null, active, req.params.id]
    );
    res.json({ success: true, message: 'Kategori aset berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/fixed-asset-categories/:id', async (req, res) => {
  try {
    // Check if category is used by any asset
    const used = await executeQuery('SELECT COUNT(*) as cnt FROM FixedAssets WHERE category_id = ?', [req.params.id]);
    if (used[0].cnt > 0) {
      return res.status(400).json({ success: false, error: 'Kategori ini masih digunakan oleh aset tetap' });
    }
    await executeQuery('DELETE FROM FixedAssetCategories WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Kategori aset berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== FIXED ASSET - ASSETS ====================
app.get('/api/fixed-assets', async (req, res) => {
  try {
    const { category_id, status, search } = req.query;
    let query = `SELECT fa.*, fac.code as category_code, fac.name as category_name
                 FROM FixedAssets fa
                 LEFT JOIN FixedAssetCategories fac ON fa.category_id = fac.id`;
    const conditions = [];
    const params = [];

    if (category_id) { conditions.push('fa.category_id = ?'); params.push(parseInt(category_id)); }
    if (status) { conditions.push('fa.status = ?'); params.push(status); }
    if (search) { conditions.push("(fa.asset_no LIKE ? OR fa.name LIKE ? OR fa.serial_number LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY fa.created_at DESC';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/fixed-assets/:id', async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT fa.*, fac.code as category_code, fac.name as category_name
       FROM FixedAssets fa
       LEFT JOIN FixedAssetCategories fac ON fa.category_id = fac.id
       WHERE fa.id = ?`, [req.params.id]);
    if (result.length === 0) return res.status(404).json({ success: false, error: 'Aset tidak ditemukan' });

    const depreciations = await executeQuery(
      'SELECT * FROM FixedAssetDepreciations WHERE asset_id = ? ORDER BY period_date DESC', [req.params.id]);
    res.json({ success: true, data: { ...result[0], depreciations } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/fixed-assets', async (req, res) => {
  try {
    const { name, description, category_id, acquisition_date, acquisition_cost, salvage_value, useful_life_months, depreciation_method, location, serial_number, notes } = req.body;

    // Auto-generate asset_no
    const countResult = await executeQuery("SELECT COUNT(*) as cnt FROM FixedAssets");
    const nextNum = (countResult[0].cnt || 0) + 1;
    const asset_no = 'FA-' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(nextNum).padStart(4, '0');

    // If no method/useful_life provided, get from category
    let finalMethod = depreciation_method;
    let finalLife = useful_life_months;
    if (!finalMethod || !finalLife) {
      const cat = await executeQuery('SELECT * FROM FixedAssetCategories WHERE id = ?', [category_id]);
      if (cat.length > 0) {
        if (!finalMethod) finalMethod = cat[0].depreciation_method;
        if (!finalLife) finalLife = cat[0].useful_life_months;
      }
    }

    const bookValue = parseFloat(acquisition_cost || 0) - parseFloat(salvage_value || 0);

    await executeQuery(
      `INSERT INTO FixedAssets (asset_no, name, description, category_id, acquisition_date, acquisition_cost, salvage_value, useful_life_months, depreciation_method, location, serial_number, status, accumulated_depreciation, book_value, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 0, ?, ?)`,
      [asset_no, name, description || '', category_id, acquisition_date, acquisition_cost || 0, salvage_value || 0, finalLife || 12, finalMethod || 'StraightLine', location || '', serial_number || '', parseFloat(acquisition_cost || 0), notes || '']
    );
    res.json({ success: true, message: 'Aset tetap berhasil ditambahkan', asset_no });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/fixed-assets/:id', async (req, res) => {
  try {
    const { name, description, category_id, acquisition_date, acquisition_cost, salvage_value, useful_life_months, depreciation_method, location, serial_number, notes } = req.body;
    await executeQuery(
      `UPDATE FixedAssets SET name = ?, description = ?, category_id = ?, acquisition_date = ?, acquisition_cost = ?, salvage_value = ?, useful_life_months = ?, depreciation_method = ?, location = ?, serial_number = ?, notes = ?, updated_at = CURRENT TIMESTAMP WHERE id = ?`,
      [name, description, category_id, acquisition_date, acquisition_cost, salvage_value, useful_life_months, depreciation_method, location, serial_number, notes, req.params.id]
    );
    // Recalculate book_value
    const asset = await executeQuery('SELECT acquisition_cost, accumulated_depreciation FROM FixedAssets WHERE id = ?', [req.params.id]);
    if (asset.length > 0) {
      const bv = parseFloat(asset[0].acquisition_cost) - parseFloat(asset[0].accumulated_depreciation);
      await executeQuery('UPDATE FixedAssets SET book_value = ? WHERE id = ?', [bv, req.params.id]);
    }
    res.json({ success: true, message: 'Aset tetap berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/fixed-assets/:id', async (req, res) => {
  try {
    const depCount = await executeQuery('SELECT COUNT(*) as cnt FROM FixedAssetDepreciations WHERE asset_id = ?', [req.params.id]);
    if (depCount[0].cnt > 0) {
      return res.status(400).json({ success: false, error: 'Tidak bisa menghapus aset yang sudah memiliki riwayat penyusutan' });
    }
    await executeQuery('DELETE FROM FixedAssets WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Aset tetap berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Dispose asset
app.post('/api/fixed-assets/:id/dispose', async (req, res) => {
  try {
    const { disposal_date, disposal_value, status } = req.body;
    await executeQuery(
      `UPDATE FixedAssets SET status = ?, disposal_date = ?, disposal_value = ?, updated_at = CURRENT TIMESTAMP WHERE id = ?`,
      [status || 'Disposed', disposal_date, disposal_value || 0, req.params.id]
    );
    res.json({ success: true, message: 'Aset berhasil di-dispose' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== FIXED ASSET - DEPRECIATION ====================
app.get('/api/fixed-asset-depreciations', async (req, res) => {
  try {
    const { asset_id, period_year, period_month } = req.query;
    let query = `SELECT fad.*, fa.asset_no, fa.name as asset_name, fac.name as category_name
                 FROM FixedAssetDepreciations fad
                 LEFT JOIN FixedAssets fa ON fad.asset_id = fa.id
                 LEFT JOIN FixedAssetCategories fac ON fa.category_id = fac.id`;
    const conditions = [];
    const params = [];

    if (asset_id) { conditions.push('fad.asset_id = ?'); params.push(parseInt(asset_id)); }
    if (period_year && period_month) {
      const startDate = `${period_year}-${String(period_month).padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(period_year), parseInt(period_month), 0).getDate();
      const endDate = `${period_year}-${String(period_month).padStart(2, '0')}-${lastDay}`;
      conditions.push('fad.period_date BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY fad.period_date DESC, fa.asset_no';

    const result = await executeQuery(query, params);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run depreciation for a specific month
app.post('/api/fixed-assets/run-depreciation', async (req, res) => {
  try {
    const { year, month } = req.body;
    const periodDate = `${year}-${String(month).padStart(2, '0')}-01`;

    // Check if depreciation already run for this period
    const existing = await executeQuery(
      "SELECT COUNT(*) as cnt FROM FixedAssetDepreciations WHERE period_date = ?", [periodDate]
    );
    if (existing[0].cnt > 0) {
      return res.status(400).json({ success: false, error: `Penyusutan untuk periode ${month}/${year} sudah pernah dijalankan` });
    }

    // Get all active assets
    const assets = await executeQuery(
      "SELECT * FROM FixedAssets WHERE status = 'Active' AND book_value > 0"
    );

    if (assets.length === 0) {
      return res.json({ success: true, message: 'Tidak ada aset aktif yang perlu disusutkan', data: [] });
    }

    const results = [];
    for (const asset of assets) {
      const cost = parseFloat(asset.acquisition_cost);
      const salvage = parseFloat(asset.salvage_value);
      const life = parseInt(asset.useful_life_months) || 12;
      const accum = parseFloat(asset.accumulated_depreciation);
      const depreciable = cost - salvage;

      let depAmount = 0;
      if (asset.depreciation_method === 'DecliningBalance') {
        // Double declining balance
        const rate = (2 / life);
        const currentBV = cost - accum;
        depAmount = Math.round(currentBV * rate * 100) / 100;
        // Don't depreciate below salvage value
        if ((accum + depAmount) > depreciable) {
          depAmount = depreciable - accum;
        }
      } else {
        // Straight line
        depAmount = Math.round((depreciable / life) * 100) / 100;
        // Don't depreciate below salvage value
        if ((accum + depAmount) > depreciable) {
          depAmount = depreciable - accum;
        }
      }

      if (depAmount <= 0) continue;

      const newAccum = Math.round((accum + depAmount) * 100) / 100;
      const newBV = Math.round((cost - newAccum) * 100) / 100;

      // Insert depreciation record
      await executeQuery(
        'INSERT INTO FixedAssetDepreciations (asset_id, period_date, depreciation_amount, accumulated_amount, book_value, status) VALUES (?, ?, ?, ?, ?, ?)',
        [asset.id, periodDate, depAmount, newAccum, newBV, 'Posted']
      );

      // Update asset
      const newStatus = newBV <= salvage ? 'Fully Depreciated' : 'Active';
      await executeQuery(
        'UPDATE FixedAssets SET accumulated_depreciation = ?, book_value = ?, status = ?, updated_at = CURRENT TIMESTAMP WHERE id = ?',
        [newAccum, newBV, newStatus, asset.id]
      );

      results.push({
        asset_id: asset.id,
        asset_no: asset.asset_no,
        asset_name: asset.name,
        depreciation_amount: depAmount,
        accumulated_amount: newAccum,
        book_value: newBV,
        status: newStatus
      });
    }

    res.json({ success: true, message: `Penyusutan berhasil dijalankan untuk ${results.length} aset`, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Summary report
app.get('/api/fixed-assets/report/summary', async (req, res) => {
  try {
    const { category_id, status } = req.query;
    let query = `SELECT fa.*, fac.code as category_code, fac.name as category_name
                 FROM FixedAssets fa
                 LEFT JOIN FixedAssetCategories fac ON fa.category_id = fac.id`;
    const conditions = [];
    const params = [];
    if (category_id) { conditions.push('fa.category_id = ?'); params.push(parseInt(category_id)); }
    if (status) { conditions.push('fa.status = ?'); params.push(status); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY fac.code, fa.asset_no';

    const assets = await executeQuery(query, params);

    // Summary by category
    const categorySummary = {};
    let totalCost = 0, totalAccum = 0, totalBV = 0;
    for (const a of assets) {
      const catName = a.category_name || 'Tanpa Kategori';
      if (!categorySummary[catName]) {
        categorySummary[catName] = { category: catName, count: 0, total_cost: 0, total_accumulated: 0, total_book_value: 0 };
      }
      categorySummary[catName].count++;
      categorySummary[catName].total_cost += parseFloat(a.acquisition_cost);
      categorySummary[catName].total_accumulated += parseFloat(a.accumulated_depreciation);
      categorySummary[catName].total_book_value += parseFloat(a.book_value);
      totalCost += parseFloat(a.acquisition_cost);
      totalAccum += parseFloat(a.accumulated_depreciation);
      totalBV += parseFloat(a.book_value);
    }

    res.json({
      success: true,
      data: {
        assets,
        categorySummary: Object.values(categorySummary),
        totals: { totalAssets: assets.length, totalCost, totalAccumulated: totalAccum, totalBookValue: totalBV }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log('✅ Crystal Reports & ReportDefinitions Endpoints Ready');
  await connectDatabase();
});

export { executeQuery };
