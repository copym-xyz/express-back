const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Getting information about foreign keys...');
    const constraintInfo = await prisma.$queryRaw`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE TABLE_NAME = 'kyc_verifications' 
      AND CONSTRAINT_TYPE = 'FOREIGN KEY' 
      AND CONSTRAINT_SCHEMA = DATABASE()`;
    
    console.log('Constraint info:', constraintInfo);
    
    if (constraintInfo.length > 0) {
      // Drop existing constraints
      for (const constraint of constraintInfo) {
        console.log(`Dropping constraint: ${constraint.CONSTRAINT_NAME}`);
        await prisma.$executeRaw`ALTER TABLE kyc_verifications DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}`;
      }
    }
    
    console.log('Adding new foreign key constraint with ON DELETE SET NULL...');
    await prisma.$executeRaw`ALTER TABLE kyc_verifications ADD CONSTRAINT kyc_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE`;
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error executing migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 