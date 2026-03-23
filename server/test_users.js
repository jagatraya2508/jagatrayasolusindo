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
      // simulate PUT /api/users/2
      const id = '2';
      const username = 'manager';
      const full_name = 'Manager Fullname';
      const phone = '0819999999';
      const role_id = 2;
      const active = 'Y';
      
      const sql = 'UPDATE Users SET username = ?, full_name = ?, phone = ?, role_id = ?, active = ? WHERE id = ?';
      const params = [username, full_name, phone, role_id, active, id];
      console.log('SQL:', sql);
      console.log('Params:', params);
      
      const dbResult = await connection.query(sql, params);
      console.log('Update result:', dbResult);

      const check = await connection.query('SELECT * FROM Users WHERE id = 2');
      console.log('Check DB:', check);
  } catch (e) {
      console.error('Error:', e);
  }
  await connection.close();
}

test().catch(console.error);
