require('dotenv').config();
const { migrateAllWallets, migrateToMpcWallet } = require('../utils/walletMigration');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const userId = args[1];
const isIssuer = args[2] === 'issuer';

async function main() {
    console.log('Starting wallet migration...');

    try {
        if (command === 'all') {
            // Migrate all wallets
            console.log('Migrating all wallets from evm-smart-wallet to evm-mpc-wallet');
            const result = await migrateAllWallets();
            
            if (result.success) {
                console.log(`Migration completed: ${result.data.success} successful, ${result.data.failed} failed out of ${result.data.total} total wallets`);
                
                if (result.data.failed > 0) {
                    console.log('Failed migrations:');
                    const failed = result.data.migrations.filter(m => !m.success);
                    console.table(failed);
                }
            } else {
                console.error('Migration failed:', result.error);
            }
        } else if (command === 'user' && userId) {
            // Migrate a specific user's wallet
            console.log(`Migrating wallet for user ${userId}${isIssuer ? ' (issuer)' : ''} to evm-mpc-wallet`);
            const result = await migrateToMpcWallet(userId, isIssuer);
            
            if (result.success) {
                console.log('Migration successful:');
                console.log(`New wallet address: ${result.data.new.address}`);
                console.log(`New DID: ${result.data.new.did}`);
                
                if (result.data.old) {
                    console.log(`Old wallet address: ${result.data.old.address}`);
                }
            } else {
                console.error('Migration failed:', result.error);
            }
        } else {
            console.log('Usage:');
            console.log('  node migrateWallets.js all');
            console.log('  node migrateWallets.js user <userId> [issuer]');
        }
    } catch (error) {
        console.error('Error running migration:', error);
    }
    
    process.exit(0);
}

main(); 