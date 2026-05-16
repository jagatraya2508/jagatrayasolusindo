require('dotenv').config({path: '../.env'});
const odbc = require('odbc');
async function run() {
  const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
  const conn = await odbc.connect(connStr);
  try {
    const res = await conn.columns(null, null, 'ReceivingDetails', null);
    console.log(res.map(r => ({ col: r.COLUMN_NAME, nullable: r.NULLABLE })));
  } catch (err) {
    console.error('SQL Error:', err);
  } finally {
    await conn.close();
  }
}
run().catch(console.error);
