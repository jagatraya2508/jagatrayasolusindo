const odbc = require('odbc');
require('dotenv').config({ path: '../.env' });
async function migrate() {
    const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    const conn = await odbc.connect(connStr);
    
    try {
        console.log("Creating BusinessTypes table...");
        await conn.query(`
            CREATE TABLE BusinessTypes (
                id INT IDENTITY PRIMARY KEY,
                code VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                description VARCHAR(255),
                active CHAR(1) DEFAULT 'Y' CHECK (active IN ('Y', 'N')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Table created.");
    } catch(e) {
        console.log("BusinessTypes Table might exist:", e.message);
    }
    
    try {
        console.log("Adding business_type_id to Entities...");
        await conn.query(`ALTER TABLE Entities ADD business_type_id INT NULL`);
        console.log("Column added.");
    } catch(e) {
        console.log("Column might exist:", e.message);
    }

    try {
        console.log("Testing Entity select...");
        const res = await conn.query("SELECT TOP 1 * FROM Entities");
        console.log(Object.keys(res[0] || {}));
    } catch(e) {}

    await conn.close();
}
migrate().catch(console.error);
