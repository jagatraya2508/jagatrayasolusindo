import odbc from 'odbc';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function run() {
    try {
        const connection = await odbc.connect(connectionString);
        let q = "SELECT account_id FROM GeneralLedgerSettings WHERE setting_key = ? AND (entity_code IS NULL OR entity_code = '01')";
        const res = await connection.query(q, ['inventory_account']);
        console.log("Result:\n", JSON.stringify(res, null, 2));
        await connection.close();
    } catch (e) {
        console.error(e);
    }
}
run();
