// Load environment variables
require('dotenv').config();

// Create a MySQL connection
const mysql = require('mysql2/promise');

async function main() {
  // Create a connection using the DATABASE_URL from .env
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  // Extract database connection details from URL
  // Format: mysql://USER:PASSWORD@HOST:PORT/DATABASE
  const dbUrlObj = new URL(dbUrl);
  const connectionConfig = {
    host: dbUrlObj.hostname,
    port: dbUrlObj.port || 3306,
    user: dbUrlObj.username,
    password: dbUrlObj.password,
    database: dbUrlObj.pathname.substring(1) // Remove leading slash
  };

  console.log(`Connecting to database ${connectionConfig.database} at ${connectionConfig.host}`);

  try {
    // Create connection
    const connection = await mysql.createConnection(connectionConfig);
    
    // Get existing foreign key constraint
    console.log('Checking for existing foreign key constraints...');
    const [constraints] = await connection.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
      WHERE TABLE_NAME = 'kyc_verifications' 
      AND CONSTRAINT_TYPE = 'FOREIGN KEY' 
      AND CONSTRAINT_SCHEMA = ?
    `, [connectionConfig.database]);
    
    console.log('Found constraints:', constraints);
    
    // Drop existing foreign key constraints
    for (const constraint of constraints) {
      console.log(`Dropping constraint ${constraint.CONSTRAINT_NAME}...`);
      await connection.query(`ALTER TABLE kyc_verifications DROP FOREIGN KEY \`${constraint.CONSTRAINT_NAME}\``);
    }
    
    // Add new constraint with ON DELETE SET NULL
    console.log('Adding new foreign key constraint...');
    await connection.query(`
      ALTER TABLE kyc_verifications 
      ADD CONSTRAINT kyc_verifications_user_id_fkey 
      FOREIGN KEY (user_id) 
      REFERENCES users(id) 
      ON DELETE SET NULL 
      ON UPDATE CASCADE
    `);
    
    console.log('Foreign key constraint updated successfully!');
    
    // Close connection
    await connection.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 