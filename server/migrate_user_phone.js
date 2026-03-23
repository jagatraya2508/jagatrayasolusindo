import odbc from 'odbc';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function migrate() {
  console.log('Connecting to database...');
  try {
    const connection = await odbc.connect(connectionString);
    try {
      await connection.query('ALTER TABLE Users ADD phone VARCHAR(50) NULL');
      console.log('Successfully added phone column to Users table.');
    } catch (e) {
      console.log(`Skipped adding phone column (maybe exists): ${e.message}`);
    }
    await connection.close();
    console.log('Migration done.');
  } catch (err) {
    console.error('Connection error:', err);
  }
}

migrate();
