const odbc = require('odbc');
require('dotenv').config({ path: '../.env' });

async function test() {
    const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    try {
        const conn = await odbc.connect(connStr);
        const res = await conn.query("SELECT * FROM GeneralLedgerSettings");
        console.log(res);
        await conn.close();
    } catch (e) {
        console.error(e);
    }
}
test();
