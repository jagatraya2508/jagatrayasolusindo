const odbc = require('odbc');
require('dotenv').config({ path: '../.env' });

async function fixIndex() {
    const connStr = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;
    try {
        const conn = await odbc.connect(connStr);
        console.log("Mulai memperbaiki index...");

        // 1. Drop the problematic index
        // The name found was "GeneralLedgerSettings UNIQUE (setting_key)"
        try {
            console.log("Mencoba menghapus index lama...");
            await conn.query(`DROP INDEX GeneralLedgerSettings."GeneralLedgerSettings UNIQUE (setting_key)"`);
            console.log("Index lama berhasil dihapus.");
        } catch (e) {
            console.log("Gagal menghapus index dengan nama lengkap, mencoba nama alternatif...");
            try {
                // Try dropping by the possible constraint name
                await conn.query(`ALTER TABLE GeneralLedgerSettings DROP CONSTRAINT "GeneralLedgerSettings UNIQUE (setting_key)"`);
                console.log("Constraint berhasil dihapus.");
            } catch (e2) {
                console.error("Gagal total menghapus index/constraint:", e2.message);
            }
        }

        // 2. Create the new composite unique index
        try {
            console.log("Membuat index unik baru (setting_key, entity_code)...");
            await conn.query(`CREATE UNIQUE INDEX UX_GLSettings_Key_Entity ON GeneralLedgerSettings (setting_key, entity_code)`);
            console.log("Index unik baru berhasil dibuat.");
        } catch (e) {
            console.error("Gagal membuat index baru:", e.message);
        }

        await conn.close();
        console.log("Proses selesai.");
    } catch (e) {
        console.error("Gagal koneksi:", e);
    }
}
fixIndex();
