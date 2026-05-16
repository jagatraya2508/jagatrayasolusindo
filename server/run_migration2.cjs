const odbc = require('odbc');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function migrate() {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    console.log('Connected to database');

    const transactionTables = ['CashBankTransactions', 'JournalVouchers'];

    for (const table of transactionTables) {
      try {
        await connection.query(`ALTER TABLE ${table} ADD current_approval_level INTEGER DEFAULT 0`);
        console.log(`✅ Added current_approval_level to ${table}`);
      } catch (e) {
        console.log(`⚠️ ${table}.current_approval_level: ${e.message}`);
      }
    }

    console.log('\n🎉 Multi-level approval migration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (connection) await connection.close();
  }
}

migrate();
