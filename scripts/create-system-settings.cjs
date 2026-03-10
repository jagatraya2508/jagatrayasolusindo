require('dotenv').config();
const odbc = require('odbc');
const path = require('path');

const connectionString = `DRIVER={SQL Anywhere 17};SERVER=${process.env.DB_HOST}:${process.env.DB_PORT};DBN=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function run() {
    let connection;
    try {
        console.log('Connecting to database...');
        // Workaround for process.cwd() issues in script execution
        require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
        const devConnectionString = `DRIVER={SQL Anywhere 17};SERVER=${process.env.DB_HOST}:${process.env.DB_PORT};DBN=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
        
        connection = await odbc.connect(devConnectionString);
        console.log('Connected.');

        console.log('Creating SystemSettings table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS SystemSettings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value VARCHAR(255),
                description VARCHAR(255)
            )
        `);
        console.log('Table created or already exists.');

        console.log('Inserting default values...');
        
        const checkCust = await connection.query(`SELECT count(*) as cnt FROM SystemSettings WHERE setting_key = 'CUSTOMER_ID_MODE'`);
        if (checkCust[0].cnt === 0) {
            await connection.query(`INSERT INTO SystemSettings (setting_key, setting_value, description) VALUES ('CUSTOMER_ID_MODE', 'MANUAL', 'ID Generation Mode for Customer')`);
            console.log('Added CUSTOMER_ID_MODE = MANUAL');
        }

        const checkSupp = await connection.query(`SELECT count(*) as cnt FROM SystemSettings WHERE setting_key = 'SUPPLIER_ID_MODE'`);
        if (checkSupp[0].cnt === 0) {
            await connection.query(`INSERT INTO SystemSettings (setting_key, setting_value, description) VALUES ('SUPPLIER_ID_MODE', 'MANUAL', 'ID Generation Mode for Supplier')`);
             console.log('Added SUPPLIER_ID_MODE = MANUAL');
        }
        
        // Also ensure Transcode exists
        console.log('Checking Transcodes...');
        const tcCust = await connection.query(`SELECT count(*) as cnt FROM Transcodes WHERE code = 'CUSTOMER'`);
        if(tcCust[0].cnt === 0) {
             await connection.query(`INSERT INTO Transcodes (code, name, prefix, format, description, active, last_number) 
             VALUES ('CUSTOMER', 'Customer Code', 'CUST', '{PREFIX}/{MM}{YYYY}/{SEQ}', 'Auto-generated customer code', 'Y', 0)`);
             console.log('Added Transcode for CUSTOMER');
        }
        
        const tcSupp = await connection.query(`SELECT count(*) as cnt FROM Transcodes WHERE code = 'SUPPLIER'`);
        if(tcSupp[0].cnt === 0) {
             await connection.query(`INSERT INTO Transcodes (code, name, prefix, format, description, active, last_number) 
             VALUES ('SUPPLIER', 'Supplier Code', 'SUPP', '{PREFIX}/{MM}{YYYY}/{SEQ}', 'Auto-generated supplier code', 'Y', 0)`);
             console.log('Added Transcode for SUPPLIER');
        }

        console.log('Done.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        if (connection) {
            await connection.close();
            console.log('Disconnected.');
        }
    }
}

run();
