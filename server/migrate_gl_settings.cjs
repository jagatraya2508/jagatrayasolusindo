const odbc = require('odbc');
require('dotenv').config({ path: '../.env' });
async function run() {
    const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    const c = await odbc.connect(connStr);
    try {
        await c.query('ALTER TABLE GeneralLedgerSettings ADD entity_code VARCHAR(50) NULL');
        console.log('Column added');
    } catch(e) {
        console.log('May already exist', e.message);
    }
    await c.close();
}
run();
