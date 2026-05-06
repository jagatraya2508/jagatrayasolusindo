const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function migrate_db() {
    let connection;
    try {
        connection = await odbc.connect(connectionString);

        const queries = [
            "ALTER TABLE SalesOrders ADD price_list_id INTEGER NULL",
            "ALTER TABLE SalesOrderDetails ADD discount_percent DECIMAL(5,2) DEFAULT 0",
            "ALTER TABLE CrmQuotations ADD price_list_id INTEGER NULL",
            "ALTER TABLE CrmQuotationDetails ADD discount_percent DECIMAL(5,2) DEFAULT 0"
        ];

        for (const query of queries) {
            try {
                await connection.query(query);
                console.log(`Executed: ${query}`);
            } catch (e) {
                console.log(`Error or already exists for: ${query} - ${e.message}`);
            }
        }

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        if (connection) await connection.close();
    }
}

migrate_db();
