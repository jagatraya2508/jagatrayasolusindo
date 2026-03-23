import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'jagatraya-super-secret-key-change-this';

async function testHttp() {
  const token = jwt.sign({ id: 1, username: 'admin', role_id: 1 }, JWT_SECRET, { expiresIn: '1h' });
  
  // 1. Get users to check current state
  const res1 = await fetch('http://localhost:3001/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
  const data1 = await res1.json();
  console.log('GET /api/users:', data1);
  
  // 2. PUT update phone for id=1 (admin)
  const reqBody = {
    username: 'admin',
    full_name: 'Super Administrator',
    phone: '08111222333',
    role_id: 1,
    active: 'Y'
  };
  console.log('\nSending PUT /api/users/1 with:', reqBody);
  
  const res2 = await fetch('http://localhost:3001/api/users/1', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody)
  });
  const data2 = await res2.json();
  console.log('PUT response:', data2);
  
  // 3. Get users again
  const res3 = await fetch('http://localhost:3001/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
  const data3 = await res3.json();
  const admin = data3.data.find(u => u.id === 1);
  console.log('\nFinal admin state:', admin);
}

testHttp().catch(console.error);
