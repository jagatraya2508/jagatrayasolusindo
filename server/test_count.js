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
  try {
      const result = await connection.query("SELECT * FROM Settings WHERE setting_key IN ('uninvoice_shipment_account', 'sales_temp_account')");
      console.log('Settings:', result);
  } catch (e) {
      console.error('Error:', e);
  }
  await connection.close();
}

test().catch(console.error);
