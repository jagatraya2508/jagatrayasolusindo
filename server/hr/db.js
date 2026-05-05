import odbc from 'odbc';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env from ERP root (../../.env from server/hr/)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

export async function executeQuery(query, params = []) {
  let connection;
  try {
    connection = await odbc.connect(connectionString);
    const result = await connection.query(query, params);
    return result;
  } catch (error) {
    throw error;
  } finally {
    if (connection) await connection.close();
  }
}

export async function connectDatabase() {
  try {
    console.log('🔄 [HR] Mencoba koneksi ke database...');
    const conn = await odbc.connect(connectionString);
    await conn.close();
    console.log('✅ [HR] Koneksi ke database Sybase berhasil!');
    return true;
  } catch (error) {
    console.error('❌ [HR] Gagal koneksi ke database:', error.message);
    return false;
  }
}

export async function getSetting(key) {
  const result = await executeQuery('SELECT setting_value FROM HR_Settings WHERE setting_key = ?', [key]);
  return result.length > 0 ? result[0].setting_value : null;
}

export async function getSettings(prefix) {
  const result = await executeQuery("SELECT setting_key, setting_value FROM HR_Settings WHERE setting_key LIKE ?", [prefix + '%']);
  const settings = {};
  result.forEach(r => { settings[r.setting_key] = r.setting_value; });
  return settings;
}
