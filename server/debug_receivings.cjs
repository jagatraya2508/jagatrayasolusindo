require('dotenv').config({path: '../.env'});
const odbc = require('odbc');
async function run() {
  const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
  const conn = await odbc.connect(connStr);
  try {
    // 1. Check for duplicate/orphan doc_numbers
    console.log('\n=== Recent Receivings ===');
    const recent = await conn.query("SELECT id, doc_number, status FROM Receivings ORDER BY id DESC");
    recent.slice(0, 10).forEach(r => console.log(`  ID: ${r.id}, Doc: ${r.doc_number}, Status: ${r.status}`));

    // 2. Check if doc_number has unique constraint
    console.log('\n=== Indexes on Receivings ===');
    try {
      const indexes = await conn.query(`
        SELECT idx.index_name, idxc.column_name, idx."unique" as is_unique
        FROM sys.sysidx idx
        JOIN sys.sysidxcol idxc ON idx.table_id = idxc.table_id AND idx.index_id = idxc.index_id
        JOIN sys.syscolumn col ON idxc.table_id = col.table_id AND idxc.column_id = col.column_id
        WHERE idx.table_id = (SELECT table_id FROM sys.systable WHERE table_name = 'Receivings')
      `);
      indexes.forEach(i => console.log(`  ${i.index_name}: ${i.column_name} (unique: ${i.is_unique})`));
    } catch(e) {
      console.log('  Could not fetch indexes:', e.message);
    }

    // 3. Check current transcode state for Receiving
    console.log('\n=== Transcode for Receiving ===');
    const tc = await conn.query("SELECT * FROM Transcodes WHERE nomortranscode = 3 AND active = 'Y'");
    tc.forEach(t => console.log(`  ID: ${t.id}, Code: ${t.code}, Name: ${t.name}, Last#: ${t.last_number}`));

    // 4. Test exact same insert the frontend would do
    console.log('\n=== Testing INSERT ===');
    const docNumber = 'RCV/TEST/DEBUG001';
    try {
      await conn.beginTransaction();
      await conn.query(
        'INSERT INTO Receivings (doc_number, doc_date, po_id, partner_id, location_id, status, transcode_id, remarks, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [docNumber, '2026-05-10', null, null, null, 'Draft', null, '', null]
      );
      console.log('  Header INSERT: OK');
      
      const idRes = await conn.query('SELECT @@IDENTITY as id');
      const recId = Number(idRes[0].id);
      console.log('  New ID:', recId);
      
      await conn.query(
        'INSERT INTO ReceivingDetails (receiving_id, item_id, quantity, unit_price, remarks) VALUES (?, ?, ?, ?, ?)',
        [recId, 2, 1, 3000000, 'test']
      );
      console.log('  Detail INSERT: OK');
      
      await conn.rollback();
      console.log('  Rolled back test data');
    } catch(e) {
      await conn.rollback();
      console.error('  INSERT FAILED:', e.message);
      if(e.odbcErrors) console.error('  ODBC Details:', JSON.stringify(e.odbcErrors));
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await conn.close();
  }
}
run().catch(console.error);
