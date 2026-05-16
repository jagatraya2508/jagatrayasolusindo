require('dotenv').config({path: '../.env'});
const odbc = require('odbc');
async function run() {
  const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
  const conn = await odbc.connect(connStr);
  try {
    // Intentionally pass wrong parameter type or invalid SQL
    await conn.query('INSERT INTO Receivings (doc_number, po_id) VALUES (?, ?)', ['TEST', 'abc']);
  } catch (err) {
    console.error('Message:', err.message);
    if(err.odbcErrors) console.error('Details:', JSON.stringify(err.odbcErrors));
  } finally {
    await conn.close();
  }
}
run().catch(console.error);
