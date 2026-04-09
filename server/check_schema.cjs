const odbc = require('odbc');
require('dotenv').config({ path: '../.env' });

async function checkSchema() {
    const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    try {
        const conn = await odbc.connect(connStr);
        const cols = await conn.query("SELECT * FROM SYSTABCOL c JOIN SYSTAB t ON c.table_id = t.table_id WHERE t.table_name = 'GeneralLedgerSettings'");
        console.log("Columns for GeneralLedgerSettings:");
        cols.forEach(c => {
            console.log(`- ${c.column_name}: Type ID ${c.domain_id}, Nullable ${c.nulls}`);
        });
        
        const idx = await conn.query("SELECT * FROM SYSIDX x JOIN SYSTAB t ON x.table_id = t.table_id WHERE t.table_name = 'GeneralLedgerSettings'");
        console.log("\nIndexes for GeneralLedgerSettings:");
        idx.forEach(i => {
            console.log(`- Index ${i.index_name}: Unique ${i['unique']}`);
        });

        await conn.close();
    } catch (e) {
        console.error("Error:", e);
    }
}
checkSchema();
