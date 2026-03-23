const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all("PRAGMA table_info('Users')", (err, rows) => {
    console.log('--- Users Table ---');
    console.log(rows);
  });
  
  db.all("PRAGMA table_info('SalesPersons')", (err, rows) => {
    console.log('--- SalesPersons Table ---');
    console.log(rows);
  });
  
  db.all("PRAGMA table_info('Roles')", (err, rows) => {
    console.log('--- Roles Table ---');
    console.log(rows);
  });
});

setTimeout(() => db.close(), 1000);
