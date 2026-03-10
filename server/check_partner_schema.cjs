const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function check() {
    let connection;
    try {
        connection = await odbc.connect(connectionString);

        let pCols = await connection.query("SELECT column_name FROM SYSCOLUMN WHERE table_id = (SELECT table_id FROM SYSTABLE WHERE table_name = 'Partners')");
        console.log("Partners cols:");
        pCols.forEach(c => console.log(" - " + c.column_name));

        // Also check if there's any AR invoice table (Receivables)
        let arCols = await connection.query("SELECT column_name FROM SYSCOLUMN WHERE table_id = (SELECT table_id FROM SYSTABLE WHERE table_name = 'ARInvoices')");
        console.log("ARInvoices cols:");
        arCols.forEach(c => console.log(" - " + c.column_name));

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        if (connection) await connection.close();
    }
}
check();
