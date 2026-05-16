import odbc from 'odbc';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function run() {
    try {
        const connection = await odbc.connect(connectionString);
        const res = await connection.query('SELECT top 10 * FROM JournalVouchers ORDER BY id DESC');
        console.log("Latest journals:", res);
        
        // Let's also check if any Shipments or Receivings were created today
        const shp = await connection.query("SELECT top 5 * FROM Shipments ORDER BY id DESC");
        console.log("Latest shipments:", shp);
        
        const rcv = await connection.query("SELECT top 5 * FROM Receivings ORDER BY id DESC");
        console.log("Latest receivings:", rcv);

        await connection.close();
    } catch (e) {
        console.error(e);
    }
}
run();
