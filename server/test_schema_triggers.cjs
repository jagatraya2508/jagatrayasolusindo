require('dotenv').config({path: '../.env'});
const odbc = require('odbc');
async function run() {
  const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
  const conn = await odbc.connect(connStr);
  try {
    const res = await conn.query("SELECT trigname, event FROM systrigger WHERE table_id = (SELECT table_id FROM systable WHERE table_name = 'Receivings' OR table_name = 'ReceivingDetails')");
    console.log('Triggers:', res);
  } catch (err) {
    console.error('SQL Error:', err);
  } finally {
    await conn.close();
  }
}
run().catch(console.error);
