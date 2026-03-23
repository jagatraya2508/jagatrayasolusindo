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
      // 1. Literal UPDATE (no parameters)
      const litSql = "UPDATE Users SET username = 'manager', full_name = 'Manager Literal', phone = '111', role_id = 2, active = 'Y' WHERE id = 2";
      console.log('--- Literal ---');
      await connection.query(litSql);
      console.log('Literal Success!');
      
      // 2. Old parameterized UPDATE
      console.log('--- Old Param ---');
      const oldSql = 'UPDATE Users SET username = ?, full_name = ?, role_id = ?, active = ? WHERE id = ?';
      await connection.query(oldSql, ['manager', 'Manager Param', 2, 'Y', 2]);
      console.log('Old Param Success!');

      // 3. New parameterized UPDATE
      console.log('--- New Param ---');
      const newSql = 'UPDATE Users SET username = ?, full_name = ?, phone = ?, role_id = ?, active = ? WHERE id = ?';
      await connection.query(newSql, ['manager', 'Manager Param Phone', '222', 2, 'Y', 2]);
      console.log('New Param Success!');
      
  } catch (e) {
      console.error('Error:', e);
  }
  await connection.close();
}

test().catch(console.error);
