const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function checkUser() {
    try {
        const connection = await odbc.connect(connectionString);
        
        const userRows = await connection.query(`
            SELECT u.id, u.username, r.name as role_name, rp.feature_key, rp.can_post 
            FROM Users u 
            LEFT JOIN Roles r ON u.role_id = r.id
            LEFT JOIN RolePermissions rp ON r.id = rp.role_id 
        `);
        console.log("All user roles and permissions:");
        console.table(userRows);

        await connection.close();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkUser();
