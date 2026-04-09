const odbc = require('odbc');
require('dotenv').config({ path: '../.env' });

async function test() {
    const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    try {
        const conn = await odbc.connect(connStr);
        await conn.query("INSERT INTO GeneralLedgerSettings (setting_key, account_id, entity_code) VALUES ('pb1_account', 1, '02')");
        console.log('Success');
        await conn.close();
    } catch (e) {
        console.error(e);
    }
}
test();
