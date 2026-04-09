import odbc from 'odbc';
import dotenv from 'dotenv';
dotenv.config();

const cs = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

const conn = await odbc.connect(cs);
const r = await conn.query('SELECT id, code, name, parent_id, warehouse_id FROM SubWarehouses ORDER BY id');
console.log(JSON.stringify(r, null, 2));
await conn.close();
