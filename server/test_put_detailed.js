const odbc = require('odbc');
require('dotenv').config({ path: '../.env' });

async function testUpdate() {
    const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    try {
        const conn = await odbc.connect(connStr);
        
        const settings = {
            "inventory_account": "1",
            "ap_temp_account": "2",
            "pb1_account": "3"
        };
        const entity_code = "02";
        
        for (const [key, account_id] of Object.entries(settings)) {
            const exists = await conn.query('SELECT count(*) as count FROM GeneralLedgerSettings WHERE setting_key = ? AND entity_code = ?', [key, entity_code]);
            
            try {
                if (exists[0].count > 0) {
                    await conn.query('UPDATE GeneralLedgerSettings SET account_id = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ? AND entity_code = ?', [account_id, key, entity_code]);
                } else {
                    await conn.query('INSERT INTO GeneralLedgerSettings (setting_key, account_id, entity_code) VALUES (?, ?, ?)', [key, account_id, entity_code]);
                }
            } catch (inner) {
                console.error('Failed on key', key);
                console.error(inner);
            }
        }
        await conn.close();
    } catch (e) {
        console.error("Connection error:", e);
    }
}
testUpdate();
