const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function runMigration() {
    try {
        const connection = await odbc.connect(connectionString);
        console.log('Connected to database.');

        const colsToAdd = [
            { name: 'can_post', type: 'CHAR(1) DEFAULT \'N\'' },
            { name: 'can_approve', type: 'CHAR(1) DEFAULT \'N\'' }
        ];

        for (const col of colsToAdd) {
            try {
                await connection.query(`ALTER TABLE RolePermissions ADD ${col.name} ${col.type}`);
                console.log(`Successfully added ${col.name} to RolePermissions table`);
            } catch (err) {
                if (err.message.includes('already exists') || err.message.includes('IX000') || err.message.includes('already')) {
                    console.log(`Column ${col.name} already exists or error ignored: ${err.message}`);
                } else {
                    console.error(`Error adding ${col.name}: ${err.message}`);
                }
            }
        }
        
        await connection.close();
        console.log('Migration completed.');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

runMigration();
