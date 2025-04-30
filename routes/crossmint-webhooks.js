const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifySignature } = require('../utils/webhookUtils');

router.post('/', async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        const payload = req.body;

        console.log('Received Crossmint webhook:', {
            type: payload.type,
            data: payload.data,
            signature
        });

        // Store webhook data
        await prisma.webhookData.create({
            data: {
                provider: 'crossmint',
                event_type: payload.type,
                payload: payload,
                signature,
                received_at: new Date()
            }
        });

        // Verify webhook signature
        const isValid = verifySignature(signature, JSON.stringify(payload), process.env.CROSSMINT_WEBHOOK_SECRET);
        if (!isValid) {
            console.warn('Invalid Crossmint webhook signature');
            return res.status(200).json({ success: false, error: 'Invalid signature' });
        }

        // Handle wallet.created event
        if (payload.type === 'wallet.created') {
            const { address, type, config, metadata } = payload.data;
            const userId = metadata?.userId;

            if (!address) {
                console.error('No wallet address in webhook payload');
                return res.status(200).json({ success: false, error: 'No wallet address' });
            }

            // Generate DID from wallet address
            const did = `did:ethr:${address}`;

            // Use a transaction to ensure data consistency
            await prisma.$transaction(async (tx) => {
                // Find existing wallet
                const existingWallet = await tx.wallet.findFirst({
                    where: { 
                        OR: [
                            { address },
                            { user_id: userId }
                        ]
                    }
                });

                if (existingWallet) {
                    // Update existing wallet with DID if not present
                    if (!existingWallet.did) {
                        await tx.wallet.update({
                            where: { id: existingWallet.id },
                            data: {
                                did,
                                updated_at: new Date()
                            }
                        });
                        console.log(`Updated existing wallet ${address} with DID ${did}`);
                    }
                } else if (userId) {
                    // Create new wallet record with DID
                    await tx.wallet.create({
                        data: {
                            address,
                            type: type || 'evm-mpc-wallet',
                            chain: 'evm',
                            is_custodial: true,
                            user_id: userId,
                            did,
                            admin_signer: config?.adminSigner?.address,
                            created_at: new Date(),
                            updated_at: new Date()
                        }
                    });
                    console.log(`Created new wallet record for ${address} with DID ${did}`);

                    // Update issuer DID if applicable
                    if (metadata?.role === 'issuer') {
                        const issuer = await tx.issuer.findUnique({
                            where: { user_id: userId }
                        });

                        if (issuer && !issuer.did) {
                            await tx.issuer.update({
                                where: { user_id: userId },
                                data: {
                                    did,
                                    did_created_at: new Date(),
                                    updated_at: new Date()
                                }
                            });
                            console.log(`Updated issuer ${userId} with DID ${did}`);
                        }
                    }
                }
            });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error processing Crossmint webhook:', error);
        res.status(200).json({ 
            success: false, 
            error: process.env.NODE_ENV === 'production' ? 
                'Internal server error' : error.message 
        });
    }
});

module.exports = router; 