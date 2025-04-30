const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuration
const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';
const CROSSMINT_BASE_URL = 'https://staging.crossmint.com/api';
const WEBHOOK_URL = 'https://62ad-152-58-201-208.ngrok-free.app/webhooks/crossmint';

/**
 * Creates a new MPC wallet in Crossmint and updates the database record
 * @param {string} userId - The user ID to create the wallet for
 * @param {boolean} isIssuer - Whether this is an issuer wallet
 * @param {string} oldWalletAddress - The address of the old wallet to replace
 * @returns {Promise<Object>} - The result of the wallet migration
 */
async function migrateToMpcWallet(userId, isIssuer = false, oldWalletAddress = null) {
    try {
        // Configuration for the new MPC wallet
        const walletConfig = {
            type: 'evm-mpc-wallet', // New wallet type
            linkedUser: `userId:${userId}`,
            webhookUrl: WEBHOOK_URL,
            metadata: {
                role: isIssuer ? 'issuer' : 'user',
                userId: userId,
                migratedFrom: oldWalletAddress
            }
        };

        console.log(`Creating new evm-mpc-wallet for user ${userId}`);
        
        // Create the new wallet in Crossmint
        const response = await axios.post(
            `${CROSSMINT_BASE_URL}/2022-06-09/wallets`,
            walletConfig,
            {
                headers: {
                    'X-API-KEY': CROSSMINT_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const newWalletAddress = response.data.address;
        
        // Generate DID from wallet address (keep the same format)
        const did = `did:ethr:${newWalletAddress}`;

        console.log(`Successfully created new wallet: ${newWalletAddress}`);
        
        // Update the wallet in the database
        if (oldWalletAddress) {
            // If we have the old wallet address, update that record
            const updatedWallet = await prisma.wallet.update({
                where: { address: oldWalletAddress },
                data: {
                    address: newWalletAddress,
                    type: 'evm-mpc-wallet',
                    did: did,
                    updated_at: new Date()
                }
            });
            
            console.log(`Updated wallet in database with new address: ${newWalletAddress}`);
            
            return {
                success: true,
                data: {
                    old: { address: oldWalletAddress },
                    new: { 
                        address: newWalletAddress,
                        did,
                        wallet: updatedWallet
                    }
                }
            };
        } else {
            // If we don't have an old address, this user might not have a wallet yet
            // Check if the user already has a wallet in the database
            const existingWallet = await prisma.wallet.findFirst({
                where: { user_id: parseInt(userId) }
            });
            
            if (existingWallet) {
                // Update the existing wallet record
                const updatedWallet = await prisma.wallet.update({
                    where: { id: existingWallet.id },
                    data: {
                        address: newWalletAddress,
                        type: 'evm-mpc-wallet',
                        did: did,
                        updated_at: new Date()
                    }
                });
                
                console.log(`Updated existing wallet record for user ${userId}`);
                
                return {
                    success: true,
                    data: {
                        old: { address: existingWallet.address },
                        new: { 
                            address: newWalletAddress,
                            did,
                            wallet: updatedWallet
                        }
                    }
                };
            } else {
                // Create a new wallet record
                const newWallet = await prisma.wallet.create({
                    data: {
                        address: newWalletAddress,
                        type: 'evm-mpc-wallet',
                        chain: 'polygon', // Default chain as per schema
                        provider: 'crossmint',
                        user_id: parseInt(userId),
                        did: did,
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                });
                
                console.log(`Created new wallet record for user ${userId}`);
                
                // If this is an issuer, update their record with the DID
                if (isIssuer) {
                    const issuer = await prisma.issuer.update({
                        where: { user_id: parseInt(userId) },
                        data: {
                            did: did,
                            did_created_at: new Date(),
                            updated_at: new Date()
                        }
                    });

                    // Update wallet with issuer_id
                    await prisma.wallet.update({
                        where: { id: newWallet.id },
                        data: { issuer_id: issuer.id }
                    });
                    
                    console.log(`Updated issuer record with new DID for user ${userId}`);
                }
                
                return {
                    success: true,
                    data: {
                        new: { 
                            address: newWalletAddress,
                            did,
                            wallet: newWallet
                        }
                    }
                };
            }
        }
    } catch (error) {
        console.error('Error migrating to MPC wallet:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
}

/**
 * Migrates all existing wallets in the database from evm-smart-wallet to evm-mpc-wallet
 * @returns {Promise<Object>} - The result of the bulk migration
 */
async function migrateAllWallets() {
    try {
        // Find all evm-smart-wallet wallets in the database
        const smartWallets = await prisma.wallet.findMany({
            where: { type: 'evm-smart-wallet' },
            include: {
                users: true,
                issuer: true
            }
        });
        
        console.log(`Found ${smartWallets.length} evm-smart-wallet wallets to migrate`);
        
        const results = {
            total: smartWallets.length,
            success: 0,
            failed: 0,
            migrations: []
        };
        
        // Process each wallet
        for (const wallet of smartWallets) {
            try {
                const isIssuer = !!wallet.issuer;
                const result = await migrateToMpcWallet(
                    wallet.user_id,
                    isIssuer,
                    wallet.address
                );
                
                if (result.success) {
                    results.success++;
                    results.migrations.push({
                        userId: wallet.user_id,
                        oldAddress: wallet.address,
                        newAddress: result.data.new.address,
                        success: true
                    });
                } else {
                    results.failed++;
                    results.migrations.push({
                        userId: wallet.user_id,
                        oldAddress: wallet.address,
                        success: false,
                        error: result.error
                    });
                }
            } catch (err) {
                results.failed++;
                results.migrations.push({
                    userId: wallet.user_id,
                    oldAddress: wallet.address,
                    success: false,
                    error: err.message
                });
            }
        }
        
        return {
            success: true,
            data: results
        };
    } catch (error) {
        console.error('Error in bulk wallet migration:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    migrateToMpcWallet,
    migrateAllWallets
}; 