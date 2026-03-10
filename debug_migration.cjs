const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function debug() {
    let connection;
    try {
        console.log('Connecting with:', connectionString);
        connection = await odbc.connect(connectionString);
        console.log('Connected to DB');

        console.log('Attempting to create SalesAreas table...');
        try {
            await connection.query(`
                CREATE TABLE SalesAreas (
                    id INTEGER IDENTITY PRIMARY KEY,
                    code VARCHAR(50) NOT NULL UNIQUE,
                    name VARCHAR(100) NOT NULL,
                    level VARCHAR(20) NOT NULL,
                    parent_id INTEGER NULL,
                    active CHAR(1) DEFAULT 'Y',
                    FOREIGN KEY (parent_id) REFERENCES SalesAreas(id)
                )
            `);
            console.log('SalesAreas table created successfully');
        } catch (e) {
            console.log('Error creating SalesAreas table:', e.message);
        }

        console.log('Attempting to add sales_area_id to SalesPersons...');
        try {
            await connection.query(`ALTER TABLE SalesPersons ADD sales_area_id INTEGER NULL`);
            console.log('sales_area_id added to SalesPersons');
        } catch (e) {
            console.log('Error adding sales_area_id to SalesPersons:', e.message);
        }

    } catch (err) {
        console.error('Connection error:', err);
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

debug();

