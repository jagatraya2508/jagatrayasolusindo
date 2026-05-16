const jwt = require('jsonwebtoken');
const http = require('http');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const token = jwt.sign(
  { id: 1, username: 'admin', role_id: 1 },
  process.env.JWT_SECRET || 'jagatraya-unified-secret-key-change-this',
  { expiresIn: '24h' }
);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/journals/117/post',
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => { body += d; });
  res.on('end', () => {
    console.log('Response:', res.statusCode, body);
  });
});

req.end();
