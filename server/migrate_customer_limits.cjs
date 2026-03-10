const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function migrate_db() {
    let connection;
    try {
        connection = await odbc.connect(connectionString);

        // Add credit_limit and check_overdue to Partners if not exist
        try {
            await connection.query("ALTER TABLE Partners ADD credit_limit DECIMAL(18,2) DEFAULT 0");
            console.log("Added credit_limit to Partners");
        } catch (e) { console.log("credit_limit already exists or error", e.message); }

        try {
            await connection.query("ALTER TABLE Partners ADD check_overdue VARCHAR(1) DEFAULT 'N'");
            console.log("Added check_overdue to Partners");
        } catch (e) { console.log("check_overdue already exists or error", e.message); }

        // Create PartnerPaymentTerms table
        try {
            await connection.query(`
                CREATE TABLE PartnerPaymentTerms (
                    id INT PRIMARY KEY IDENTITY,
                    partner_id INT NOT NULL,
                    payment_term_id INT NOT NULL,
                    CONSTRAINT FK_PPT_Partner FOREIGN KEY (partner_id) REFERENCES Partners(id),
                    CONSTRAINT FK_PPT_PaymentTerm FOREIGN KEY (payment_term_id) REFERENCES PaymentTerms(id)
                )
            `);
            console.log("Created PartnerPaymentTerms table");
        } catch (e) { console.log("PartnerPaymentTerms already exists or error", e.message); }

    } catch (err) {
        console.error("ERROR:", err);
    } finally {
        if (connection) await connection.close();
    }
}
migrate_db();
