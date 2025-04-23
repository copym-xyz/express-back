/**
 * DID (Decentralized Identifier) Utilities
 * Functions for generating and managing DIDs through Crossmint
 */
require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { createWallet } = require('./crossmintUtils');
const prisma = new PrismaClient();

/**
 * Generate a DID for an issuer
 * @param {number} issuerId - The ID of the issuer
 * @returns {Promise<Object>} - Result of the operation with DID or error
 */
async function generateDIDForIssuer(issuerId) {
  try {
    // Check if issuer exists and is verified
    const issuer = await prisma.issuer.findUnique({
      where: { id: issuerId },
      include: { wallet: true }
    });

    if (!issuer) {
      throw new Error('Issuer not found');
    }

    if (!issuer.is_verified) {
      throw new Error('Issuer must be verified before generating DID');
    }

    // Create wallet if it doesn't exist
    if (!issuer.wallet) {
      const walletResult = await createWallet(issuerId);
      
      if (!walletResult.success) {
        throw new Error(`Failed to create wallet: ${walletResult.error}`);
      }

      // Store wallet information
      await prisma.wallet.create({
        data: {
          address: walletResult.data.address,
          type: walletResult.data.type,
          user_id: issuerId,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      // Refresh issuer data
      issuer.wallet = await prisma.wallet.findFirst({
        where: { user_id: issuerId }
      });
    }

    // Generate DID using wallet address
    const did = `did:ethr:${issuer.wallet.address}`;

    // Update issuer with DID
    await prisma.issuer.update({
      where: { id: issuerId },
      data: { did }
    });

    return {
      success: true,
      did,
      wallet: issuer.wallet
    };
  } catch (error) {
    console.error('Error generating DID:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a wallet for an issuer
 * @param {number} issuerId - The ID of the issuer
 * @param {number} userId - The ID of the user
 * @returns {Promise<Object>} - The created wallet
 */
async function createWalletForIssuer(issuerId, userId) {
  try {
    // Input validation
    if (!issuerId || !userId) {
      throw new Error('Issuer ID and User ID are required');
    }
    
    console.log(`Creating wallet for issuer ${issuerId}, user ${userId}`);
    
    // Check if wallet already exists
    const existingWallet = await prisma.wallet.findFirst({
      where: { issuer_id: issuerId }
    });
    
    if (existingWallet) {
      console.log(`Wallet already exists for issuer ${issuerId}: ${existingWallet.address}`);
      return existingWallet;
    }
    
    // Get Crossmint API key
    const apiKey = process.env.CROSSMINT_API_KEY;
    if (!apiKey) {
      throw new Error('Missing Crossmint API key');
    }
    
    // Create a wallet using Crossmint API
    const response = await axios.post(
      'https://staging.crossmint.com/api/2022-06-09/wallets',
      { 
        type: 'evm-smart-wallet',
        config: {
          adminSigner: {
            type: 'evm-fireblocks-custodial'
          }
        },
        linkedUser: `userId:${userId}`
      },
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data || !response.data.address) {
      console.error('Invalid response from Crossmint API:', response.data);
      throw new Error('Invalid response from Crossmint API');
    }
    
    const walletData = response.data;
    console.log(`Wallet created with address: ${walletData.address}`);
    
    // Store wallet in database
    const wallet = await prisma.wallet.create({
      data: {
        user_id: userId,
        issuer_id: issuerId,
        address: walletData.address,
        chain: 'polygon',
        type: 'evm-smart-wallet',
        provider: 'crossmint',
        external_id: walletData.id || walletData.address,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    console.log(`Stored wallet with ID ${wallet.id} for issuer ${issuerId}`);
    return wallet;
  } catch (error) {
    console.error(`Error creating wallet for issuer ${issuerId}:`, error);
    throw error;
  }
}

module.exports = {
  generateDIDForIssuer,
  createWalletForIssuer
}; 