const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'erp_database.sqlite');
const db = new sqlite3.Database(dbPath);

const executeQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function migrate() {
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
      await executeQuery(`ALTER TABLE CrmActivities ADD ${col.name} ${col.type}`);
      console.log(`Added ${col.name}`);
    } catch (e) {
      console.log(`Skipped ${col.name} (maybe exists)`);
    }
  }
  db.close();
  console.log('Migration done.');
}

migrate();
