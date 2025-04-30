const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CROSSMINT_API_KEY = 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';
const CROSSMINT_PROJECT_ID = '883f05c8-c651-417e-bdc2-6cd3a7ffe8dd';
const CROSSMINT_BASE_URL = 'https://staging.crossmint.com/api';
const WEBHOOK_URL = 'https://62ad-152-58-201-208.ngrok-free.app/webhooks/crossmint';

async function createWallet(userId, isIssuer = false) {
    try {
        // Get user email from database
        const user = await prisma.users.findUnique({
            where: { id: parseInt(userId) }
        });

        if (!user || !user.email) {
            throw new Error(`User ${userId} not found or has no email`);
        }

        const walletConfig = {
            type: 'evm-mpc-wallet',
            linkedUser: `email:${user.email}`,
            webhookUrl: WEBHOOK_URL,
            metadata: {
                role: isIssuer ? 'issuer' : 'user',
                projectId: CROSSMINT_PROJECT_ID,
                userId: userId
            }
        };

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

        // Generate DID from wallet address
        const did = `did:ethr:${response.data.address}`;

        // Store wallet and DID in database
        const wallet = await prisma.wallet.create({
            data: {
                address: response.data.address,
                type: response.data.type || 'evm-mpc-wallet',
                chain: 'polygon', // Default chain as per schema
                provider: 'crossmint',
                user_id: userId,
                did: did,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        // If this is an issuer, update their record with the DID
        if (isIssuer) {
            const issuer = await prisma.issuer.update({
                where: { user_id: userId },
                data: {
                    did: did,
                    did_created_at: new Date(),
                    updated_at: new Date()
                }
            });

            // Update wallet with issuer_id
            await prisma.wallet.update({
                where: { id: wallet.id },
                data: { issuer_id: issuer.id }
            });
        }

        return {
            success: true,
            data: {
                ...response.data,
                did,
                wallet
            }
        };
    } catch (error) {
        console.error('Error creating Crossmint wallet:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
}

async function getWalletBalance(walletAddress) {
    try {
        const url = new URL(`${CROSSMINT_BASE_URL}/v1-alpha2/wallets/${walletAddress}/balances`);
        url.search = new URLSearchParams({
            tokens: 'eth,usdc,usdxm',
            chains: 'base-sepolia,polygon-amoy'
        }).toString();

        const response = await axios.get(url.toString(), {
            headers: {
                'X-API-KEY': CROSSMINT_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        // Get wallet with DID from database
        const wallet = await prisma.wallet.findFirst({
            where: { address: walletAddress }
        });

        return {
            success: true,
            data: {
                ...response.data,
                did: wallet?.did
            }
        };
    } catch (error) {
        console.error('Error fetching wallet balance:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
}

module.exports = {
    createWallet,
    getWalletBalance,
    CROSSMINT_PROJECT_ID,
    WEBHOOK_URL
}; 