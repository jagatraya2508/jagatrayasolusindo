const odbc = require('odbc');
require('dotenv').config({ path: '../.env' });

async function testCurrentTimestamp() {
    const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    try {
        const conn = await odbc.connect(connStr);
        console.log("Testing UPDATE with CURRENT_TIMESTAMP...");
        try {
            await conn.query("UPDATE GeneralLedgerSettings SET updated_at = CURRENT_TIMESTAMP WHERE id = 1");
            console.log("SUCCESS: CURRENT_TIMESTAMP worked.");
        } catch (e) {
            console.error("FAILED: CURRENT_TIMESTAMP failed.", e.message);
        }
        
        console.log("Testing UPDATE with getdate()...");
        try {
            await conn.query("UPDATE GeneralLedgerSettings SET updated_at = getdate() WHERE id = 1");
            console.log("SUCCESS: getdate() worked.");
        } catch (e) {
            console.error("FAILED: getdate() failed.", e.message);
        }

        console.log("Testing UPDATE with NOW()...");
        try {
            await conn.query("UPDATE GeneralLedgerSettings SET updated_at = NOW() WHERE id = 1");
            console.log("SUCCESS: NOW() worked.");
        } catch (e) {
            console.error("FAILED: NOW() failed.", e.message);
        }

        await conn.close();
    } catch (e) {
        console.error("Connection error:", e);
    }
}
testCurrentTimestamp();
