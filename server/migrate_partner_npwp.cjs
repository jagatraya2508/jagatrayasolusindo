const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function migrate_db() {
    let connection;
    try {
        connection = await odbc.connect(connectionString);

        // Add npwp_number to Partners
        try {
            await connection.query("ALTER TABLE Partners ADD npwp_number VARCHAR(50) NULL");
            console.log("Added npwp_number to Partners");
        } catch (e) {
            console.log("npwp_number already exists or error", e.message);
        }

        // Add npwp_address to Partners
        try {
            await connection.query("ALTER TABLE Partners ADD npwp_address VARCHAR(500) NULL");
            console.log("Added npwp_address to Partners");
        } catch (e) {
            console.log("npwp_address already exists or error", e.message);
        }

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        if (connection) await connection.close();
    }
}

migrate_db();
