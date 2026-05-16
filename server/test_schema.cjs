require('dotenv').config({path: '../.env'});
const odbc = require('odbc');
async function run() {
  const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
  const conn = await odbc.connect(connStr);
  const res = await conn.columns(null, null, 'Receivings', null);
  console.log('Receivings columns:', res.map(r => r.COLUMN_NAME));
  const res2 = await conn.columns(null, null, 'ReceivingDetails', null);
  console.log('ReceivingDetails columns:', res2.map(r => r.COLUMN_NAME));
  await conn.close();
}
run().catch(console.error);
