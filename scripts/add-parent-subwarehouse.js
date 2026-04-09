import odbc from 'odbc';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function migrate() {
  try {
    const pool = await odbc.pool(connectionString);
    const conn = await pool.connect();

    console.log('Adding parent_id column to SubWarehouses...');

    try {
      await conn.query(`ALTER TABLE SubWarehouses ADD parent_id INTEGER NULL`);
      console.log('✅ parent_id column added to SubWarehouses');
    } catch (e) {
      console.log('❌ parent_id error:', e.odbcErrors ? e.odbcErrors[0].message : e.message);
    }

    await conn.close();
    await pool.close();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  }
}

migrate();
