const odbc = require('odbc');
require('dotenv').config({ path: '../.env' });

async function check() {
    const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    const conn = await odbc.connect(connectionString);
    
    console.log("--- GeneralLedgerSettings Schema ---");
    let res = await conn.query("SELECT * FROM SYSTABCOL WHERE table_id = (SELECT table_id FROM SYSTAB WHERE table_name = 'GeneralLedgerSettings')");
    console.log(res.map(r => r.column_name));

    console.log("--- ARInvoices Schema ---");
    let res2 = await conn.query("SELECT * FROM SYSTABCOL WHERE table_id = (SELECT table_id FROM SYSTAB WHERE table_name = 'ARInvoices')");
    console.log(res2.map(r => r.column_name));

    await conn.close();
}
check().catch(console.error);
