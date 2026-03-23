import odbc from 'odbc';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function test() {
  const connection = await odbc.connect(connectionString);
  const rows = await connection.query('SELECT id, username FROM Users');
  console.log(JSON.stringify(rows.map(r => ({id: r.id, user: r.username})), null, 2));
  await connection.close();
}

test().catch(console.error);
