const odbc = require('odbc');
require('dotenv').config({ path: '../.env' });

async function findIndex() {
    const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    try {
        const conn = await odbc.connect(connStr);
        // Query to find index names for GeneralLedgerSettings
        const query = `
            SELECT i.index_name, i.\"unique\", i.index_id
            FROM SYSIDX i
            JOIN SYSTAB t ON i.table_id = t.table_id
            WHERE t.table_name = 'GeneralLedgerSettings'
        `;
        const result = await conn.query(query);
        console.log("Indexes for GeneralLedgerSettings:");
        result.forEach(row => {
            console.log(`- ${row.index_name} (Unique: ${row.unique})`);
        });
        await conn.close();
    } catch (e) {
        console.error("Error:", e);
    }
}
findIndex();
