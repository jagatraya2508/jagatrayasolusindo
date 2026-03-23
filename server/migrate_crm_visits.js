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
  const connection = await odbc.connect(connectionString);
  const colsToAdd = [
    { name: 'check_in_time', type: 'DATETIME NULL' },
    { name: 'check_out_time', type: 'DATETIME NULL' },
    { name: 'check_in_lat', type: 'VARCHAR(50) NULL' },
    { name: 'check_in_lng', type: 'VARCHAR(50) NULL' },
    { name: 'check_out_lat', type: 'VARCHAR(50) NULL' },
    { name: 'check_out_lng', type: 'VARCHAR(50) NULL' },
    { name: 'selfie_in', type: 'VARCHAR(255) NULL' },
    { name: 'selfie_out', type: 'VARCHAR(255) NULL' }
  ];
  
  for (const col of colsToAdd) {
    try {
      await connection.query(`ALTER TABLE CrmActivities ADD ${col.name} ${col.type}`);
      console.log(`Added ${col.name}`);
    } catch (e) {
      console.log(`Skipped ${col.name} (maybe exists): ${e.message}`);
    }
  }
  await connection.close();
  console.log('Migration done.');
}

migrate().catch(console.error);
