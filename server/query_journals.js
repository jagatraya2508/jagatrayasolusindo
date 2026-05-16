import odbc from 'odbc';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function run() {
    try {
        console.log("Connecting...");
        const connection = await odbc.connect(connectionString);
        console.log("Querying...");
        const res = await connection.query(`SELECT (SELECT SUM(d.debit) FROM JournalVoucherDetails d WHERE d.jv_id = JournalVouchers.id) as total_amount, * FROM JournalVouchers WHERE source_type IS NOT NULL`);
        console.log("Result length:", res.length);
        await connection.close();
    } catch (e) {
        console.error(e);
    }
}
run();
