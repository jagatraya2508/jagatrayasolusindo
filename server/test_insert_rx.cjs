require('dotenv').config({path: '../.env'});
const odbc = require('odbc');
async function run() {
  const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
  const conn = await odbc.connect(connStr);
  try {
    await conn.query(
      'INSERT INTO Receivings (doc_number, doc_date, po_id, partner_id, location_id, status, transcode_id, remarks, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['RCV/TEST/001', '2026-05-10', '15', '1', '1', 'Draft', '3', '', null]
    );
    console.log('Insert Header Success');
    const res = await conn.query("SELECT * FROM Receivings WHERE doc_number = 'RCV/TEST/001'");
    const recId = res[0].id;
    
    await conn.query(
      'INSERT INTO ReceivingDetails (receiving_id, item_id, quantity, unit_price, remarks) VALUES (?, ?, ?, ?, ?)',
      [recId, '1', '1', '3000000', 'Catatan...']
    );
    console.log('Insert Details Success');

    // Cleanup
    await conn.query('DELETE FROM ReceivingDetails WHERE receiving_id = ?', [recId]);
    await conn.query('DELETE FROM Receivings WHERE id = ?', [recId]);

  } catch (err) {
    console.error('SQL Error:', err);
  } finally {
    await conn.close();
  }
}
run().catch(console.error);
