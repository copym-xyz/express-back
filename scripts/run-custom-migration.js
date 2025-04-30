const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'migrations', 'add_credentials_to_wallet.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing SQL migration:', sql);
    
    // Execute the SQL directly
    const result = await prisma.$executeRawUnsafe(sql);
    
    console.log('Migration completed successfully!');
    console.log('Result:', result);
  } catch (error) {
    console.error('Error executing migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 