import odbc from 'odbc';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function checkSchema() {
  const connection = await odbc.connect(connectionString);
  try {
      console.log('--- Users ---');
      const users = await connection.query("SELECT TOP 1 * FROM Users");
      console.log(users.length ? Object.keys(users[0]) : 'Empty');

      console.log('--- Roles ---');
      const roles = await connection.query("SELECT TOP 5 * FROM Roles");
      console.log(roles);

      console.log('--- SalesPersons ---');
      const sales = await connection.query("SELECT TOP 1 * FROM SalesPersons");
      console.log(sales.length ? Object.keys(sales[0]) : 'Empty');

  } catch (e) {
      console.error('Error:', e);
  }
  await connection.close();
}

checkSchema().catch(console.error);
