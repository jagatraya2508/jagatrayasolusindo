import express from 'express';
import { executeQuery, getSetting } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = express.Router();
router.use(authMiddleware);

// Helper: Get applicable taxes for a transaction type
async function getApplicableTaxes(transactionType) {
  const type = transactionType === 'RESTO' ? 'RESTO' : 'RETAIL';
  const taxes = await executeQuery(
    `SELECT * FROM POS_Taxes WHERE active = 'Y' AND (apply_to = ? OR apply_to = 'ALL') ORDER BY sort_order`,
    [type]
  );
  return taxes;
}

// Helper: Get service charge settings
async function getServiceChargeConfig() {
  const enabled = await getSetting('SERVICE_CHARGE_ENABLED');
  const rate = await getSetting('SERVICE_CHARGE_RATE');
  const applyTo = await getSetting('SERVICE_CHARGE_APPLY_TO');
  return {
    enabled: enabled === 'Y',
    rate: parseFloat(rate) || 0,
    applyTo: applyTo || 'RESTO'
  };
}

// Helper: Check if SC applies to tx type
function scAppliesTo(scConfig, txType) {
  if (!scConfig.enabled) return false;
  if (scConfig.applyTo === 'ALL') return true;
  if (scConfig.applyTo === 'RESTO' && txType === 'RESTO') return true;
  if (scConfig.applyTo === 'RETAIL' && txType === 'RETAIL') return true;
  return false;
}

// Helper: Calculate tax + SC and return breakdown
async function calculateTaxAndSC(subtotal, discountAmount, txType) {
  const dpp = subtotal - (discountAmount || 0);
  
  // Get taxes
  const taxes = await getApplicableTaxes(txType);
  let totalTax = 0;
  const taxBreakdown = [];
  for (const tax of taxes) {
    const amount = Math.round(dpp * (parseFloat(tax.rate) / 100));
    totalTax += amount;
    taxBreakdown.push({ code: tax.code, name: tax.name, rate: parseFloat(tax.rate), amount });
  }

  // Get SC
  const scConfig = await getServiceChargeConfig();
  let scAmount = 0;
  if (scAppliesTo(scConfig, txType)) {
    scAmount = Math.round(dpp * (scConfig.rate / 100));
  }

  const grandTotal = dpp + totalTax + scAmount;

  return { dpp, totalTax, scAmount, grandTotal, taxBreakdown, scConfig };
}

// Generate transaction number
async function generateTransactionNo(type) {
  const code = type === 'RESTO' ? 'POS_RESTO' : 'POS_RETAIL';
  const transcodes = await executeQuery('SELECT * FROM Transcodes WHERE code = ?', [code]);
  
  if (transcodes.length > 0) {
    const tc = transcodes[0];
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const seqNum = (tc.last_number || 0) + 1;
    const seq = String(seqNum).padStart(4, '0');

    let docNumber = tc.format
      .replace('{PREFIX}', tc.prefix || '')
      .replace('{YYYY}', year)
      .replace('{YY}', year.slice(-2))
      .replace('{MM}', month)
      .replace('{DD}', day)
      .replace('{SEQ}', seq);

    // Update last number
    await executeQuery('UPDATE Transcodes SET last_number = ? WHERE code = ?', [seqNum, code]);

    return docNumber;
  }

  // Fallback to legacy count-based generator if Transcode is not found
  const prefix = type === 'RESTO' ? 'RST' : 'RTL';
  const today = new Date();
  const dateStr = today.getFullYear().toString().slice(-2) +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');
  const pattern = `${prefix}${dateStr}%`;
  const result = await executeQuery(
    `SELECT COUNT(*) as cnt FROM POS_Transactions WHERE transaction_no LIKE ?`, [pattern]
  );
  const seqFallback = (result[0].cnt || 0) + 1;
  return `${prefix}${dateStr}${String(seqFallback).padStart(4, '0')}`;
}

// Get all transactions with filters
router.get('/', async (req, res) => {
  try {
    const { date, status, type, outlet_id, limit } = req.query;
    let sql = `SELECT ${limit ? `TOP ${parseInt(limit)}` : ''} t.*, u.full_name as cashier_name, o.name as outlet_name, tb.table_number
               FROM POS_Transactions t
               LEFT JOIN POS_Users u ON t.user_id = u.id
               LEFT JOIN POS_Outlets o ON t.outlet_id = o.id
               LEFT JOIN POS_Tables tb ON t.table_id = tb.id
               WHERE 1=1`;
    const params = [];

    if (date) {
      sql += ` AND CAST(t.transaction_date AS DATE) = ?`;
      params.push(date);
    }
    if (status) { sql += ` AND t.status = ?`; params.push(status); }
    if (type) { sql += ` AND t.transaction_type = ?`; params.push(type); }
    if (outlet_id) { sql += ` AND t.outlet_id = ?`; params.push(parseInt(outlet_id)); }
    
    // Access Check
    if (req.user && req.user.access_level === 'CUSTOM') {
      if (req.user.outlet_ids && req.user.outlet_ids.length > 0) {
        sql += ` AND t.outlet_id IN (${req.user.outlet_ids.map(()=>'?').join(',')})`;
        params.push(...req.user.outlet_ids);
      } else {
        sql += ` AND 1 = 0`; // NO ACCESS
      }
    }

    sql += ` ORDER BY t.transaction_date DESC`;

    const transactions = await executeQuery(sql, params);
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get transaction detail
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const transactions = await executeQuery(
      `SELECT t.*, u.full_name as cashier_name, o.name as outlet_name, tb.table_number, c.name as customer_name
       FROM POS_Transactions t
       LEFT JOIN POS_Users u ON t.user_id = u.id
       LEFT JOIN POS_Outlets o ON t.outlet_id = o.id
       LEFT JOIN POS_Tables tb ON t.table_id = tb.id
       LEFT JOIN POS_Customers c ON t.customer_id = c.id
       WHERE t.id = ?`, [id]
    );
    if (transactions.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

    const details = await executeQuery(
      `SELECT d.*, p.code as product_code FROM POS_TransactionDetails d LEFT JOIN POS_Products p ON d.product_id = p.id WHERE d.transaction_id = ? ORDER BY d.id`, [id]
    );

    const payments = await executeQuery(
      `SELECT * FROM POS_Payments WHERE transaction_id = ? ORDER BY id`, [id]
    );

    res.json({ success: true, data: { ...transactions[0], details, payments } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get tax & SC config for a transaction type (used by frontend)
router.get('/config/tax-sc', async (req, res) => {
  try {
    const { type } = req.query;
    const txType = type || 'RETAIL';
    const taxes = await getApplicableTaxes(txType);
    const scConfig = await getServiceChargeConfig();
    const scApplies = scAppliesTo(scConfig, txType);

    res.json({
      success: true,
      data: {
        taxes: taxes.map(t => ({ code: t.code, name: t.name, rate: parseFloat(t.rate) })),
        serviceCharge: {
          enabled: scApplies,
          rate: scApplies ? scConfig.rate : 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new transaction
router.post('/', async (req, res) => {
  try {
    const { transaction_type, outlet_id, session_id, customer_id, table_id, items, guest_count, notes } = req.body;
    const txType = transaction_type || 'RETAIL';
    const targetOutletId = parseInt(outlet_id) || 1;
    const transaction_no = await generateTransactionNo(txType);

    // Access check
    if (req.user && req.user.access_level === 'CUSTOM') {
      if (!req.user.outlet_ids || !req.user.outlet_ids.includes(targetOutletId)) {
        return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke Outlet ini' });
      }
    }

    // Calculate subtotal from items
    let subtotal = 0;
    if (items && items.length > 0) {
      items.forEach(item => {
        subtotal += (item.unit_price * item.quantity) - (item.discount_amount || 0);
      });
    }

    // Calculate tax & service charge
    const { totalTax, scAmount, grandTotal } = await calculateTaxAndSC(subtotal, 0, txType);

    // Insert transaction
    await executeQuery(
      `INSERT INTO POS_Transactions (transaction_no, transaction_type, outlet_id, user_id, session_id, customer_id, table_id, subtotal, tax_amount, service_charge, grand_total, status, guest_count, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)`,
      [transaction_no, txType, outlet_id || 1, req.user.id, session_id || null, customer_id || null, table_id || null, subtotal, totalTax, scAmount, grandTotal, guest_count || 1, notes || null]
    );

    // Get created transaction ID
    const created = await executeQuery(`SELECT MAX(id) as id FROM POS_Transactions WHERE transaction_no = ?`, [transaction_no]);
    const transactionId = created[0].id;

    // Insert details
    if (items && items.length > 0) {
      for (const item of items) {
        const itemSubtotal = (item.unit_price * item.quantity) - (item.discount_amount || 0);
        await executeQuery(
          `INSERT INTO POS_TransactionDetails (transaction_id, product_id, product_name, quantity, unit_price, discount_amount, subtotal, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [transactionId, item.product_id, item.product_name, item.quantity, item.unit_price, item.discount_amount || 0, itemSubtotal, item.notes || null]
        );
      }
    }

    // Update table status if restaurant
    if (table_id) {
      await executeQuery(`UPDATE POS_Tables SET status = 'Occupied' WHERE id = ?`, [table_id]);
    }

    res.json({ success: true, message: 'Transaksi berhasil dibuat', data: { id: transactionId, transaction_no } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add items to existing transaction
router.post('/:id/items', async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    const { items } = req.body;

    let addedSubtotal = 0;
    for (const item of items) {
      const itemSubtotal = (item.unit_price * item.quantity) - (item.discount_amount || 0);
      addedSubtotal += itemSubtotal;
      await executeQuery(
        `INSERT INTO POS_TransactionDetails (transaction_id, product_id, product_name, quantity, unit_price, discount_amount, subtotal, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [transactionId, item.product_id, item.product_name, item.quantity, item.unit_price, item.discount_amount || 0, itemSubtotal, item.notes || null]
      );
    }

    // Get transaction to recalculate
    const tx = await executeQuery(`SELECT subtotal, discount_amount, discount_percent, transaction_type FROM POS_Transactions WHERE id = ?`, [transactionId]);
    const newSubtotal = parseFloat(tx[0].subtotal) + addedSubtotal;
    const discPct = parseFloat(tx[0].discount_percent) || 0;
    const discAmount = discPct > 0 ? newSubtotal * (discPct / 100) : parseFloat(tx[0].discount_amount) || 0;

    // Recalculate tax & SC
    const { totalTax, scAmount, grandTotal } = await calculateTaxAndSC(newSubtotal, discAmount, tx[0].transaction_type);

    await executeQuery(
      `UPDATE POS_Transactions SET subtotal = ?, discount_amount = ?, tax_amount = ?, service_charge = ?, grand_total = ? WHERE id = ?`,
      [newSubtotal, discAmount, totalTax, scAmount, grandTotal, transactionId]
    );

    res.json({ success: true, message: 'Item berhasil ditambahkan' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update transaction (discount, tax, service charge)
router.put('/:id', async (req, res) => {
  try {
    const { discount_amount, discount_percent, notes } = req.body;
    const id = parseInt(req.params.id);

    const tx = await executeQuery(`SELECT subtotal, transaction_type FROM POS_Transactions WHERE id = ?`, [id]);
    if (tx.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

    const subtotal = parseFloat(tx[0].subtotal);
    const disc = discount_amount || (subtotal * (discount_percent || 0) / 100);

    // Recalculate tax & SC based on DPP (subtotal - discount)
    const { totalTax, scAmount, grandTotal } = await calculateTaxAndSC(subtotal, disc, tx[0].transaction_type);

    await executeQuery(
      `UPDATE POS_Transactions SET discount_amount=?, discount_percent=?, tax_amount=?, service_charge=?, grand_total=?, notes=? WHERE id=?`,
      [disc, discount_percent || 0, totalTax, scAmount, grandTotal, notes || null, id]
    );

    res.json({ success: true, message: 'Transaksi berhasil diupdate' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Void transaction
router.put('/:id/void', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tx = await executeQuery(`SELECT * FROM POS_Transactions WHERE id = ?`, [id]);
    if (tx.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

    if (tx[0].status === 'Void') return res.status(400).json({ success: false, message: 'Transaksi sudah di-void' });

    // Rollback if transaction was completed
    if (tx[0].status === 'Completed') {
      // 1. Rollback Cash in Drawer
      const payments = await executeQuery(`SELECT * FROM POS_Payments WHERE transaction_id = ?`, [id]);
      if (tx[0].session_id) {
        for (const p of payments) {
          if (p.payment_method === 'Cash') {
            await executeQuery(
              `UPDATE POS_CashSessions SET cash_in_drawer = ISNULL(cash_in_drawer, 0) - ? WHERE id = ?`,
              [tx[0].grand_total, tx[0].session_id]
            );
          }
        }
      }

      // 2. Rollback Stock
      const details = await executeQuery(`SELECT product_id, quantity FROM POS_TransactionDetails WHERE transaction_id = ?`, [id]);
      for (const d of details) {
        await executeQuery(`UPDATE POS_Products SET stock = stock + ? WHERE id = ?`, [d.quantity, d.product_id]);
      }
    }

    // Mark as void
    await executeQuery(`UPDATE POS_Transactions SET status = 'Void' WHERE id = ?`, [id]);

    // Free table
    if (tx[0].table_id) {
      await executeQuery(`UPDATE POS_Tables SET status = 'Available' WHERE id = ?`, [tx[0].table_id]);
    }

    res.json({ success: true, message: 'Transaksi berhasil di-void dan dikembalikan.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tx = await executeQuery(`SELECT * FROM POS_Transactions WHERE id = ?`, [id]);
    if (tx.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

    // Rollback if transaction was completed
    if (tx[0].status === 'Completed') {
      // 1. Rollback Cash in Drawer
      const payments = await executeQuery(`SELECT * FROM POS_Payments WHERE transaction_id = ?`, [id]);
      if (tx[0].session_id) {
        for (const p of payments) {
          if (p.payment_method === 'Cash') {
            await executeQuery(
              `UPDATE POS_CashSessions SET cash_in_drawer = ISNULL(cash_in_drawer, 0) - ? WHERE id = ?`,
              [tx[0].grand_total, tx[0].session_id]
            );
          }
        }
      }

      // 2. Rollback Stock
      const details = await executeQuery(`SELECT product_id, quantity FROM POS_TransactionDetails WHERE transaction_id = ?`, [id]);
      for (const d of details) {
        await executeQuery(`UPDATE POS_Products SET stock = stock + ? WHERE id = ?`, [d.quantity, d.product_id]);
      }
    }

    // Free table
    if (tx[0].table_id) {
      await executeQuery(`UPDATE POS_Tables SET status = 'Available' WHERE id = ?`, [tx[0].table_id]);
    }

    // Delete details & payments first (foreign keys)
    await executeQuery(`DELETE FROM POS_TransactionDetails WHERE transaction_id = ?`, [id]);
    await executeQuery(`DELETE FROM POS_Payments WHERE transaction_id = ?`, [id]);
    
    // Delete the transaction itself
    await executeQuery(`DELETE FROM POS_Transactions WHERE id = ?`, [id]);

    res.json({ success: true, message: 'Transaksi berhasil dihapus secara permanen.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== POSTING TO ERP JOURNAL ====================

// Helper: Get GL Account from ERP GeneralLedgerSettings
async function getGlAccount(key, entityCode = null) {
  let query = 'SELECT account_id FROM GeneralLedgerSettings WHERE setting_key = ? AND entity_code ';
  let params = [key];

  if (entityCode) {
    query += '= ?';
    params.push(entityCode);
  } else {
    query += 'IS NULL';
  }

  let res = await executeQuery(query, params);

  // Fallback to global setting if entity-specific not found
  if (res.length === 0 && entityCode) {
    res = await executeQuery('SELECT account_id FROM GeneralLedgerSettings WHERE setting_key = ? AND entity_code IS NULL', [key]);
  }

  return res.length > 0 ? res[0].account_id : null;
}

// Helper: Get GL Account with account info
async function getGlAccountInfo(key, entityCode = null) {
  let query = `SELECT s.account_id, a.code as account_code, a.name as account_name 
               FROM GeneralLedgerSettings s 
               LEFT JOIN Accounts a ON s.account_id = a.id 
               WHERE s.setting_key = ? AND s.entity_code `;
  let params = [key];

  if (entityCode) {
    query += '= ?';
    params.push(entityCode);
  } else {
    query += 'IS NULL';
  }

  let res = await executeQuery(query, params);

  if (res.length === 0 && entityCode) {
    res = await executeQuery(
      `SELECT s.account_id, a.code as account_code, a.name as account_name 
       FROM GeneralLedgerSettings s 
       LEFT JOIN Accounts a ON s.account_id = a.id 
       WHERE s.setting_key = ? AND s.entity_code IS NULL`, [key]
    );
  }

  return res.length > 0 ? res[0] : null;
}

// Preview journal entries before posting
router.get('/:id/journal-preview', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tx = await executeQuery(
      `SELECT t.*, u.full_name as cashier_name, o.name as outlet_name, o.code as outlet_code, e.code as entity_code
       FROM POS_Transactions t
       LEFT JOIN POS_Users u ON t.user_id = u.id
       LEFT JOIN POS_Outlets o ON t.outlet_id = o.id
       LEFT JOIN POS_Sites s ON o.site_id = s.id
       LEFT JOIN POS_MasterSites ms ON s.master_site_id = ms.id
       LEFT JOIN Sites erp_s ON ms.erp_site_id = erp_s.id
       LEFT JOIN Entities e ON erp_s.entity_id = e.id
       WHERE t.id = ?`, [id]
    );

    if (tx.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    const transaction = tx[0];

    if (transaction.status !== 'Completed') {
      return res.status(400).json({ success: false, message: 'Hanya transaksi Completed yang bisa di-posting' });
    }

    // Get entity code based on POS general settings
    let entityCode = null;
    const posModeStr = await getSetting('DEFAULT_POS_MODE');
    if (posModeStr) {
      const entRes = await executeQuery(
        `SELECT e.code FROM Entities e LEFT JOIN BusinessTypes b ON e.business_type_id = b.id WHERE b.code = ? AND e.active = 'Y'`, 
        [posModeStr]
      );
      if (entRes.length > 0) {
        entityCode = entRes[0].code;
      }
    }

    // Fallback to outlet -> site -> entity mapping if not found
    if (!entityCode) {
      entityCode = transaction.entity_code || null;
    }

    // Get GL accounts
    const arAccount = await getGlAccountInfo('ar_trade_account', entityCode);
    const salesAccount = await getGlAccountInfo('sales_account', entityCode);
    const vatOutAccount = await getGlAccountInfo('vat_out_account', entityCode);
    const pb1Account = await getGlAccountInfo('pb1_account', entityCode);
    const cashAccount = await getGlAccountInfo('cash_account', entityCode);
    const serviceChargeAccount = await getGlAccountInfo('service_charge_account', entityCode);

    if (!salesAccount) {
      return res.status(400).json({ success: false, message: 'GL Settings: Sales Account belum diatur. Silakan atur di JAGATRAYA ERP' });
    }

    const grandTotal = parseFloat(transaction.grand_total) || 0;
    const subtotal = parseFloat(transaction.subtotal) || 0;
    const discountAmount = parseFloat(transaction.discount_amount) || 0;
    const taxAmount = parseFloat(transaction.tax_amount) || 0;
    const serviceCharge = parseFloat(transaction.service_charge) || 0;
    const dpp = subtotal - discountAmount;

    // Fetch payments to resolve Cash vs AR
    const payments = await executeQuery(`SELECT payment_method, amount, change_amount FROM POS_Payments WHERE transaction_id = ?`, [transaction.id]);
    let cashPaid = 0;
    for (const p of payments) {
      if (p.payment_method === 'Cash') {
        cashPaid += parseFloat(p.amount) - (parseFloat(p.change_amount) || 0);
      }
    }
    cashPaid = Math.min(cashPaid, grandTotal);
    const arAmount = grandTotal - cashPaid;

    // Validate specific GL settings based on transaction composition
    if (cashPaid > 0 && !cashAccount) {
      return res.status(400).json({ success: false, message: 'GL Settings: Cash/Bank Account belum diatur untuk pembayaran tunai' });
    }
    if (arAmount > 0 && !arAccount) {
      return res.status(400).json({ success: false, message: 'GL Settings: AR Trade Account belum diatur untuk sisa piutang' });
    }
    if (serviceCharge > 0 && !serviceChargeAccount) {
      return res.status(400).json({ success: false, message: 'GL Settings: Service Charge Account belum diatur' });
    }

    // Build journal preview
    const journalLines = [];

    // Debit: Cash
    if (cashPaid > 0) {
      journalLines.push({
        account_id: cashAccount.account_id,
        account_code: cashAccount.account_code,
        account_name: cashAccount.account_name,
        debit: cashPaid,
        credit: 0,
        description: `Pembayaran Kas POS ${transaction.transaction_no}`
      });
    }

    // Debit: AR
    if (arAmount > 0) {
      journalLines.push({
        account_id: arAccount.account_id,
        account_code: arAccount.account_code,
        account_name: arAccount.account_name,
        debit: arAmount,
        credit: 0,
        description: `Piutang POS ${transaction.transaction_no}`
      });
    }

    // Kredit: Sales (DPP)
    journalLines.push({
      account_id: salesAccount.account_id,
      account_code: salesAccount.account_code,
      account_name: salesAccount.account_name,
      debit: 0,
      credit: dpp,
      description: `Penjualan ${transaction.transaction_no}`
    });

    // Kredit: Service Charge
    if (serviceCharge > 0) {
      journalLines.push({
        account_id: serviceChargeAccount.account_id,
        account_code: serviceChargeAccount.account_code,
        account_name: serviceChargeAccount.account_name,
        debit: 0,
        credit: serviceCharge,
        description: `Service Charge ${transaction.transaction_no}`
      });
    }

    // Kredit: Tax (PPN/PB1) if applicable
    if (taxAmount > 0) {
      // Determine which tax account to use based on transaction type
      let taxAccount = null;
      if (transaction.transaction_type === 'RESTO' && pb1Account) {
        taxAccount = pb1Account;
      } else if (vatOutAccount) {
        taxAccount = vatOutAccount;
      }

      if (taxAccount) {
        journalLines.push({
          account_id: taxAccount.account_id,
          account_code: taxAccount.account_code,
          account_name: taxAccount.account_name,
          debit: 0,
          credit: taxAmount,
          description: `Pajak ${transaction.transaction_no}`
        });
      } else {
        // If no specific tax account, add to sales
        journalLines[1].credit += taxAmount;
      }
    }

    res.json({
      success: true,
      data: {
        transaction: {
          id: transaction.id,
          transaction_no: transaction.transaction_no,
          transaction_date: transaction.transaction_date,
          transaction_type: transaction.transaction_type,
          cashier_name: transaction.cashier_name,
          outlet_name: transaction.outlet_name,
          grand_total: grandTotal,
          subtotal,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          service_charge: serviceCharge,
          is_posted: transaction.is_posted
        },
        journal_lines: journalLines,
        totals: {
          debit: journalLines.reduce((sum, l) => sum + l.debit, 0),
          credit: journalLines.reduce((sum, l) => sum + l.credit, 0)
        }
      }
    });
  } catch (error) {
    console.error('Journal preview error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Post transaction - Create journal entry in ERP
router.put('/:id/post', async (req, res) => {
  let connection;
  try {
    const id = parseInt(req.params.id);

    // Get transaction with outlet info
    const tx = await executeQuery(
      `SELECT t.*, o.code as outlet_code, e.code as entity_code
       FROM POS_Transactions t
       LEFT JOIN POS_Outlets o ON t.outlet_id = o.id
       LEFT JOIN POS_Sites s ON o.site_id = s.id
       LEFT JOIN POS_MasterSites ms ON s.master_site_id = ms.id
       LEFT JOIN Sites erp_s ON ms.erp_site_id = erp_s.id
       LEFT JOIN Entities e ON erp_s.entity_id = e.id
       WHERE t.id = ?`, [id]
    );

    if (tx.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    const transaction = tx[0];

    if (transaction.status !== 'Completed') {
      return res.status(400).json({ success: false, message: 'Hanya transaksi Completed yang bisa di-posting' });
    }

    if (transaction.is_posted === 'Y') {
      return res.status(400).json({ success: false, message: 'Transaksi sudah pernah di-posting' });
    }

    // Get entity code
    let entityCode = null;
    const posModeStr = await getSetting('DEFAULT_POS_MODE');
    if (posModeStr) {
      const entRes = await executeQuery(
        `SELECT e.code FROM Entities e LEFT JOIN BusinessTypes b ON e.business_type_id = b.id WHERE b.code = ? AND e.active = 'Y'`, 
        [posModeStr]
      );
      if (entRes.length > 0) {
        entityCode = entRes[0].code;
      }
    }

    // Fallback mapping
    if (!entityCode) {
      entityCode = transaction.entity_code || null;
    }

    // Get GL accounts
    const arAccountId = await getGlAccount('ar_trade_account', entityCode);
    const salesAccountId = await getGlAccount('sales_account', entityCode);
    const vatOutAccountId = await getGlAccount('vat_out_account', entityCode);
    const pb1AccountId = await getGlAccount('pb1_account', entityCode);
    const cashAccountId = await getGlAccount('cash_account', entityCode);
    const serviceChargeAccountId = await getGlAccount('service_charge_account', entityCode);

    if (!salesAccountId) {
      return res.status(400).json({ success: false, message: 'GL Settings: Sales Account belum diatur. Silakan atur di JAGATRAYA ERP' });
    }

    const grandTotal = parseFloat(transaction.grand_total) || 0;
    const subtotal = parseFloat(transaction.subtotal) || 0;
    const discountAmount = parseFloat(transaction.discount_amount) || 0;
    const taxAmount = parseFloat(transaction.tax_amount) || 0;
    const serviceCharge = parseFloat(transaction.service_charge) || 0;
    const dpp = subtotal - discountAmount;

    // Fetch payments to resolve Cash vs AR
    const payments = await executeQuery(`SELECT payment_method, amount, change_amount FROM POS_Payments WHERE transaction_id = ?`, [transaction.id]);
    let cashPaid = 0;
    for (const p of payments) {
      if (p.payment_method === 'Cash') {
        cashPaid += parseFloat(p.amount) - (parseFloat(p.change_amount) || 0);
      }
    }
    cashPaid = Math.min(cashPaid, grandTotal);
    const arAmount = grandTotal - cashPaid;

    // Validate GL Settings
    if (cashPaid > 0 && !cashAccountId) {
      return res.status(400).json({ success: false, message: 'GL Settings: Cash/Bank Account belum diatur' });
    }
    if (arAmount > 0 && !arAccountId) {
      return res.status(400).json({ success: false, message: 'GL Settings: AR Trade Account belum diatur' });
    }
    if (serviceCharge > 0 && !serviceChargeAccountId) {
      return res.status(400).json({ success: false, message: 'GL Settings: Service Charge Account belum diatur' });
    }

    // Build journal details
    const journalDetails = [];

    // Debit: Cash
    if (cashPaid > 0) {
      journalDetails.push({
        coa_id: cashAccountId,
        debit: cashPaid,
        credit: 0,
        description: `Pembayaran Kas POS ${transaction.transaction_no}`
      });
    }

    // Debit: AR
    if (arAmount > 0) {
      journalDetails.push({
        coa_id: arAccountId,
        debit: arAmount,
        credit: 0,
        description: `Piutang POS ${transaction.transaction_no}`
      });
    }

    // Kredit: Sales (DPP)
    journalDetails.push({
      coa_id: salesAccountId,
      debit: 0,
      credit: dpp,
      description: `Penjualan ${transaction.transaction_no}`
    });

    // Kredit: Service Charge
    if (serviceCharge > 0) {
      journalDetails.push({
        coa_id: serviceChargeAccountId,
        debit: 0,
        credit: serviceCharge,
        description: `Service Charge ${transaction.transaction_no}`
      });
    }

    // Kredit: Tax
    if (taxAmount > 0) {
      let taxAccountId = null;
      if (transaction.transaction_type === 'RESTO' && pb1AccountId) {
        taxAccountId = pb1AccountId;
      } else if (vatOutAccountId) {
        taxAccountId = vatOutAccountId;
      }

      if (taxAccountId) {
        journalDetails.push({
          coa_id: taxAccountId,
          debit: 0,
          credit: taxAmount,
          description: `Pajak ${transaction.transaction_no}`
        });
      } else {
        journalDetails[1].credit += taxAmount;
      }
    }

    // Create journal using raw connection for transaction safety
    const odbc = (await import('odbc')).default;
    const dotenv = (await import('dotenv')).default;
    const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    
    connection = await odbc.connect(connStr);
    await connection.query('BEGIN TRANSACTION');

    const jvNumber = `JV-${transaction.transaction_no}`;
    const txDate = new Date(transaction.transaction_date).toISOString().split('T')[0];

    // Check if journal already exists
    const existing = await connection.query(
      'SELECT id FROM JournalVouchers WHERE source_type = ? AND ref_id = ?',
      ['POS_Sales', id]
    );

    let jvId;

    if (existing.length > 0) {
      jvId = Number(existing[0].id);
      await connection.query('UPDATE JournalVouchers SET doc_number = ?, doc_date = ? WHERE id = ?', [jvNumber, txDate, jvId]);
      await connection.query('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [jvId]);
    } else {
      await connection.query(
        'INSERT INTO JournalVouchers (doc_number, doc_date, description, status, source_type, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
        [jvNumber, txDate, `Auto Journal POS Penjualan ${transaction.transaction_no}`, 'Posted', 'POS_Sales', id]
      );
      const idRes = await connection.query('SELECT @@IDENTITY as id');
      jvId = Number(idRes[0].id);
    }

    // Insert journal details
    for (const det of journalDetails) {
      if (!det.coa_id) continue;
      await connection.query(
        'INSERT INTO JournalVoucherDetails (jv_id, coa_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)',
        [jvId, det.coa_id, det.debit || 0, det.credit || 0, det.description || '']
      );
    }

    // Update POS_Transactions as posted
    await connection.query(
      `UPDATE POS_Transactions SET is_posted = 'Y', posted_at = CURRENT TIMESTAMP, journal_id = ? WHERE id = ?`,
      [jvId, id]
    );

    await connection.query('COMMIT');

    console.log(`✅ POS Transaction ${transaction.transaction_no} posted to Journal #${jvId}`);

    res.json({
      success: true,
      message: `Transaksi ${transaction.transaction_no} berhasil di-posting ke jurnal`,
      data: { journal_id: jvId, journal_number: jvNumber }
    });

  } catch (error) {
    if (connection) {
      try { await connection.query('ROLLBACK'); } catch (e) { }
    }
    console.error('Posting error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

// Unpost transaction - Remove journal entry
router.put('/:id/unpost', async (req, res) => {
  let connection;
  try {
    const id = parseInt(req.params.id);
    const tx = await executeQuery('SELECT * FROM POS_Transactions WHERE id = ?', [id]);

    if (tx.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    if (tx[0].is_posted !== 'Y') {
      return res.status(400).json({ success: false, message: 'Transaksi belum di-posting' });
    }

    const odbc = (await import('odbc')).default;
    const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    
    connection = await odbc.connect(connStr);
    await connection.query('BEGIN TRANSACTION');

    // Delete journal
    if (tx[0].journal_id) {
      await connection.query('DELETE FROM JournalVoucherDetails WHERE jv_id = ?', [tx[0].journal_id]);
      await connection.query('DELETE FROM JournalVouchers WHERE id = ?', [tx[0].journal_id]);
    }

    // Also clean up by source_type just in case
    await connection.query(
      "DELETE FROM JournalVoucherDetails WHERE jv_id IN (SELECT id FROM JournalVouchers WHERE source_type = 'POS_Sales' AND ref_id = ?)",
      [id]
    );
    await connection.query(
      "DELETE FROM JournalVouchers WHERE source_type = 'POS_Sales' AND ref_id = ?",
      [id]
    );

    // Reset posting status
    await connection.query(
      `UPDATE POS_Transactions SET is_posted = 'N', posted_at = NULL, journal_id = NULL WHERE id = ?`,
      [id]
    );

    await connection.query('COMMIT');

    res.json({ success: true, message: 'Posting berhasil dibatalkan (unpost)' });
  } catch (error) {
    if (connection) {
      try { await connection.query('ROLLBACK'); } catch (e) { }
    }
    console.error('Unpost error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

export default router;
