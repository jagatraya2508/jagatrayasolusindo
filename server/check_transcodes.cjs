const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function check() {
    const conn = await odbc.connect(connectionString);
    try {
        const res = await conn.query("SELECT * FROM Transcodes");
        console.log("Transcodes:", res);

        // Let's also check column definitions for Transcodes
        const cols = await conn.query("SELECT * FROM SYSCOLUMN WHERE table_id = (SELECT table_id FROM SYSTABLE WHERE table_name = 'Transcodes')");
        console.log("Cols:", cols.map(c => c.column_name));
    } finally {
        await conn.close();
    }
}
check();
