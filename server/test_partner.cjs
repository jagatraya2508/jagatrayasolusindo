const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function test() {
    let connection;
    try {
        connection = await odbc.connect(connectionString);
        let code = '';
        let type = 'Customer';
        let name = 'Test';

        const modeKey = 'CUSTOMER_ID_MODE';
        const formatKey = 'CUSTOMER_ID_FORMAT';
        const seqKey = 'CUSTOMER_ID_SEQ';

        const settingsRows = await connection.query(`SELECT setting_key, setting_value FROM SystemSettings WHERE setting_key IN ('${modeKey}', '${formatKey}', '${seqKey}')`);
        console.log("Settings rows:", settingsRows);

        const settingsMap = {};
        settingsRows.forEach(row => {
            settingsMap[row.setting_key] = row.setting_value;
        });

        console.log("Settings map:", settingsMap);

        if (settingsMap[modeKey] === 'AUTO') {
            const defaultFormat = type === 'Customer' ? 'CUS-{YY}{MM}-{SEQ}' : 'SUP-{YY}{MM}-{SEQ}';
            const format = settingsMap[formatKey] || defaultFormat;

            const currentSeq = parseInt(settingsMap[seqKey] || '0', 10);
            const nextSeq = currentSeq + 1;

            const now = new Date();
            const year = now.getFullYear().toString();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const seqStr = String(nextSeq).padStart(4, '0');

            code = format
                .replace('{YYYY}', year)
                .replace('{YY}', year.slice(-2))
                .replace('{MM}', month)
                .replace('{DD}', day)
                .replace('{SEQ}', seqStr);
            console.log("Generated code:", code);

            if (settingsMap[seqKey] !== undefined) {
                console.log("Running UPDATE seq");
                await connection.query('UPDATE SystemSettings SET setting_value = ? WHERE setting_key = ?', [nextSeq.toString(), seqKey]);
            } else {
                console.log("Running INSERT seq");
                await connection.query('INSERT INTO SystemSettings (setting_key, setting_value) VALUES (?, ?)', [seqKey, nextSeq.toString()]);
            }
        }

        console.log("Running INSERT Partner");
        await connection.query(
            'INSERT INTO Partners (code, name, type, address, phone) VALUES (?, ?, ?, ?, ?)',
            [code, name, type, '', '']
        );
        console.log("SUCCESS!");

    } catch (err) {
        console.error("SQL ERROR:", err);
    } finally {
        if (connection) await connection.close();
    }
}
test();
