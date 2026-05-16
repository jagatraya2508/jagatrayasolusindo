const odbc = require('odbc');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function migrate() {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    console.log('Connected to database');

    // 1. Create ApprovalSettings table
    try {
      await connection.query(`
        CREATE TABLE ApprovalSettings (
          id INTEGER IDENTITY PRIMARY KEY,
          transaction_type VARCHAR(50) NOT NULL UNIQUE,
          description VARCHAR(200) NOT NULL,
          require_approval CHAR(1) DEFAULT 'Y',
          active CHAR(1) DEFAULT 'Y',
          created_at TIMESTAMP DEFAULT CURRENT TIMESTAMP
        )
      `);
      console.log('✅ Table ApprovalSettings created');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('⚠️ Table ApprovalSettings already exists');
      } else {
        console.error('❌ Error creating ApprovalSettings:', e.message);
      }
    }

    // 2. Create ApprovalUsers table (with level and amount range)
    try {
      await connection.query(`
        CREATE TABLE ApprovalUsers (
          id INTEGER IDENTITY PRIMARY KEY,
          approval_setting_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          approval_level INTEGER DEFAULT 1,
          min_amount DECIMAL(18,2) DEFAULT 0,
          max_amount DECIMAL(18,2) DEFAULT 999999999999,
          active CHAR(1) DEFAULT 'Y',
          created_at TIMESTAMP DEFAULT CURRENT TIMESTAMP,
          FOREIGN KEY (approval_setting_id) REFERENCES ApprovalSettings(id),
          FOREIGN KEY (user_id) REFERENCES Users(id)
        )
      `);
      console.log('✅ Table ApprovalUsers created');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('⚠️ Table ApprovalUsers already exists');
      } else {
        console.error('❌ Error creating ApprovalUsers:', e.message);
      }
    }

    // 3. Create ApprovalLogs table
    try {
      await connection.query(`
        CREATE TABLE ApprovalLogs (
          id INTEGER IDENTITY PRIMARY KEY,
          transaction_type VARCHAR(50) NOT NULL,
          transaction_id INTEGER NOT NULL,
          doc_number VARCHAR(100),
          action VARCHAR(20) NOT NULL,
          approval_level INTEGER DEFAULT 1,
          user_id INTEGER NOT NULL,
          user_name VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES Users(id)
        )
      `);
      console.log('✅ Table ApprovalLogs created');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('⚠️ Table ApprovalLogs already exists');
      } else {
        console.error('❌ Error creating ApprovalLogs:', e.message);
      }
    }

    // 4. Add approved_by and approved_at columns to all transaction tables
    const transactionTables = [
      'PurchaseOrders', 'Receivings', 'SalesOrders', 'Shipments',
      'APInvoices', 'ARInvoices', 'InventoryAdjustments',
      'APAdjustments', 'ARAdjustments', 'LocationTransfers',
      'ItemConversions'
    ];

    for (const table of transactionTables) {
      try {
        await connection.query(`ALTER TABLE ${table} ADD approved_by INTEGER NULL`);
        console.log(`✅ Added approved_by to ${table}`);
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('Duplicate')) {
          console.log(`⚠️ approved_by already exists in ${table}`);
        } else {
          console.log(`⚠️ ${table}.approved_by: ${e.message}`);
        }
      }
      try {
        await connection.query(`ALTER TABLE ${table} ADD approved_at TIMESTAMP NULL`);
        console.log(`✅ Added approved_at to ${table}`);
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('Duplicate')) {
          console.log(`⚠️ approved_at already exists in ${table}`);
        } else {
          console.log(`⚠️ ${table}.approved_at: ${e.message}`);
        }
      }
    }

    // Also for finance tables (CashTransactions, BankTransactions, JournalVouchers)
    const financeTables = ['CashTransactions', 'BankTransactions', 'JournalVouchers'];
    for (const table of financeTables) {
      try {
        await connection.query(`ALTER TABLE ${table} ADD approved_by INTEGER NULL`);
        console.log(`✅ Added approved_by to ${table}`);
      } catch (e) {
        console.log(`⚠️ ${table}.approved_by: ${e.message}`);
      }
      try {
        await connection.query(`ALTER TABLE ${table} ADD approved_at TIMESTAMP NULL`);
        console.log(`✅ Added approved_at to ${table}`);
      } catch (e) {
        console.log(`⚠️ ${table}.approved_at: ${e.message}`);
      }
    }

    // 5. Seed default ApprovalSettings for all transaction types
    const transactionTypes = [
      { type: 'purchase-order', desc: 'Purchase Order' },
      { type: 'receiving', desc: 'Receiving' },
      { type: 'sales-order', desc: 'Sales Order' },
      { type: 'shipment', desc: 'Shipment' },
      { type: 'ap-invoice', desc: 'AP Invoice (Pembelian)' },
      { type: 'ar-invoice', desc: 'AR Invoice (Penjualan)' },
      { type: 'cash-in', desc: 'Kas Masuk' },
      { type: 'cash-out', desc: 'Kas Keluar' },
      { type: 'bank-in', desc: 'Bank Masuk' },
      { type: 'bank-out', desc: 'Bank Keluar' },
      { type: 'journal-voucher', desc: 'Jurnal Voucher' },
      { type: 'inventory-adjustment-in', desc: 'Inventory Adjustment In' },
      { type: 'inventory-adjustment-out', desc: 'Inventory Adjustment Out' },
      { type: 'ap-debit-adjustment', desc: 'AP Debit Adjustment' },
      { type: 'ap-credit-adjustment', desc: 'AP Credit Adjustment' },
      { type: 'ar-debit-adjustment', desc: 'AR Debit Adjustment' },
      { type: 'ar-credit-adjustment', desc: 'AR Credit Adjustment' },
      { type: 'location-transfer', desc: 'Pindah Gudang' },
      { type: 'item-conversion', desc: 'Konversi Item' },
    ];

    for (const t of transactionTypes) {
      try {
        const existing = await connection.query(
          "SELECT id FROM ApprovalSettings WHERE transaction_type = ?", [t.type]
        );
        if (existing.length === 0) {
          await connection.query(
            "INSERT INTO ApprovalSettings (transaction_type, description, require_approval, active) VALUES (?, ?, 'Y', 'Y')",
            [t.type, t.desc]
          );
          console.log(`✅ Seeded: ${t.type}`);
        } else {
          console.log(`⚠️ Already seeded: ${t.type}`);
        }
      } catch (e) {
        console.error(`❌ Error seeding ${t.type}:`, e.message);
      }
    }

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (connection) await connection.close();
  }
}

migrate();
