const odbc = require('odbc');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function check() {
  try {
    const conn = await odbc.connect(connectionString);
    const result = await conn.query("SELECT table_name FROM SYSTAB WHERE table_name LIKE '%Price%'");
    console.log("Price tables:", result);
    const itemCols = await conn.query("SELECT cname FROM SYSCOLUMNS WHERE tname = 'Items'");
    console.log("Item columns:", itemCols);
    await conn.close();
  } catch (e) {
    console.error(e);
  }
}
check();
