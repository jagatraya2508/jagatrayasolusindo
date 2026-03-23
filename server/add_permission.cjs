const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function run() {
    try {
        const connection = await odbc.connect(connectionString);
        
        // Cek struktur Roles
        const roles = await connection.query('SELECT id, name FROM Roles');
        console.log('Roles:', roles);
        
        // Kita tambahkan permission untuk role Administrator (misal id 1) dan Sales
        for (const role of roles) {
            // Cek apakah sdh ada
            const exist = await connection.query("SELECT * FROM RolePermissions WHERE role_id = ? AND feature_key = 'crm-live-tracking'", [role.id]);
            if (exist.length === 0) {
                const canAccess = (role.name === 'Administrator' || role.name === 'Manager') ? 'Y' : 'N';
                await connection.query(
                    "INSERT INTO RolePermissions (role_id, feature_key, can_view, can_create, can_edit, can_delete, can_print) VALUES (?, 'crm-live-tracking', ?, 'N', 'N', 'N', 'N')",
                    [role.id, canAccess]
                );
                console.log(`Added permission for role ${role.name}`);
            } else {
                console.log(`Permission already exists for role ${role.name}`);
            }
        }
        
        await connection.close();
    } catch (e) {
        console.error(e);
    }
}
run();
