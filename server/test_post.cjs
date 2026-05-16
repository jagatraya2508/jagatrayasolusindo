const odbc = require('odbc');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = `Driver={SQL Anywhere 17};Host=${process.env.DB_HOST}:${process.env.DB_PORT};DatabaseName=${process.env.DB_NAME};UID=${process.env.DB_USER};PWD=${process.env.DB_PASSWORD}`;

async function testQuery() {
    try {
        const connection = await odbc.connect(connectionString);
        const reqUserId = 1; // Superadmin
        const docNumber = 'BCAI/012026/0012';

        const jv = await connection.query(`SELECT id FROM JournalVouchers WHERE doc_number = '${docNumber}'`);
        if(jv.length === 0) return console.log('not found');
        const jvId = jv[0].id;

        const txData = await connection.query(`
            SELECT j.doc_number, j.status, j.current_approval_level, t.nomortranscode 
            FROM JournalVouchers j 
            LEFT JOIN Transcodes t ON j.transcode_id = t.id 
            WHERE j.id = ?
        `, [jvId]);
        if (txData.length === 0) throw new Error('Journal not found');
        
        let featureKey = 'journal-voucher';
        if (txData[0].nomortranscode === 10) featureKey = 'cash-in';
        else if (txData[0].nomortranscode === 11) featureKey = 'cash-out';
        else if (txData[0].nomortranscode === 12) featureKey = 'bank-in';
        else if (txData[0].nomortranscode === 13) featureKey = 'bank-out';

        const userRows = await connection.query(`
            SELECT r.name as role_name, rp.can_post
            FROM Users u
            LEFT JOIN Roles r ON u.role_id = r.id
            LEFT JOIN RolePermissions rp ON r.id = rp.role_id AND rp.feature_key = ?
            WHERE u.id = ?
        `, [featureKey, reqUserId]);

        const roleName = userRows.length > 0 && userRows[0].role_name ? userRows[0].role_name.trim() : null;
        const canPostFlag = userRows.length > 0 && userRows[0].can_post === 'Y';

        const canPost = roleName === 'Super Admin' || roleName === 'Manager' || canPostFlag;
        if (!canPost) throw new Error('Unauthorized to post');

        console.log('SUCCESS! canPost is true');
        await connection.close();
    } catch (error) {
        console.error('Error in simulation:', error);
    }
}

testQuery();
