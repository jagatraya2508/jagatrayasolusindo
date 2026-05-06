const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function migrate_pricelists() {
    let connection;
    try {
        connection = await odbc.connect(connectionString);

        // Create PriceLists table
        try {
            await connection.query(`
                CREATE TABLE PriceLists (
                    id INTEGER IDENTITY PRIMARY KEY,
                    code VARCHAR(50) NOT NULL UNIQUE,
                    name VARCHAR(100) NOT NULL,
                    currency_code VARCHAR(10) NULL,
                    payment_term_id INTEGER NULL,
                    valid_from DATE NULL,
                    valid_to DATE NULL,
                    active CHAR(1) DEFAULT 'Y',
                    remarks VARCHAR(200) NULL
                )
            `);
            console.log("Created table PriceLists");
        } catch (e) {
            console.log("PriceLists table already exists or error", e.message);
        }

        // Create PriceListDetails table
        try {
            await connection.query(`
                CREATE TABLE PriceListDetails (
                    id INTEGER IDENTITY PRIMARY KEY,
                    price_list_id INTEGER NOT NULL,
                    item_id INTEGER NOT NULL,
                    unit_id INTEGER NULL,
                    price DECIMAL(18,6) DEFAULT 0,
                    discount_percent DECIMAL(5,2) DEFAULT 0,
                    min_qty DECIMAL(18,6) DEFAULT 0,
                    FOREIGN KEY (price_list_id) REFERENCES PriceLists(id) ON DELETE CASCADE
                )
            `);
            console.log("Created table PriceListDetails");
        } catch (e) {
            console.log("PriceListDetails table already exists or error", e.message);
        }

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        if (connection) await connection.close();
    }
}

migrate_pricelists();
