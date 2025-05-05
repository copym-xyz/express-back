const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { SignJWT } = require('jose');
const { generateDIDForIssuer } = require('./didUtils');

const prisma = new PrismaClient();

// API configuration
const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || "sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P";
const CROSSMINT_BASE_URL = "https://staging.crossmint.com/api";
const CROSSMINT_PROJECT_ID = process.env.CROSSMINT_PROJECT_ID || "4ab05c30-bed2-44fd-b8e3-70a68cac2a00";

// Supported chains configuration
const SUPPORTED_CHAINS = {
  'ethereum-sepolia': {
    name: 'Ethereum Sepolia',
    type: 'evm-smart-wallet',
    adminSigner: {
      type: 'evm-keypair'
    }
  },
  'polygon-mumbai': {
    name: 'Polygon Mumbai',
    type: 'solana-smart-wallet',
    adminSigner: {
      type: 'solana-keypair'
    }
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    type: 'evm-smart-wallet',
    adminSigner: {
      type: 'evm-keypair'
    }
  }
};

/**
 * Generate JWT for Crossmint API
 * @param {string} userId - User ID
 * @returns {Promise<string>} JWT token
 */
async function generateCrossmintJWT(userId) {
  try {
    // Private key should be stored securely in env vars
    const privateKeyPEM = process.env.JWT_PRIVATE_KEY || crypto.randomBytes(32).toString('base64');
    
    // Create and sign the JWT
    const jwt = await new SignJWT()
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(CROSSMINT_PROJECT_ID)
      .setSubject(userId.toString())
      .setAudience('crossmint.com')
      .setExpirationTime('10m')
      .sign(Buffer.from(privateKeyPEM));
    
    return jwt;
  } catch (error) {
    console.error('Error generating Crossmint JWT:', error);
    throw error;
  }
}

/**
 * Create a wallet via Crossmint API
 * @param {number} userId - User ID
 * @param {boolean} isIssuer - Whether user is an issuer
 * @param {string} chain - Blockchain chain
 * @returns {Promise<object>} Created wallet data
 */
async function createWallet(userId, isIssuer, chain = 'ethereum-sepolia') {
  try {
    // Verify chain is supported
    if (!SUPPORTED_CHAINS[chain]) {
      return {
        success: false,
        error: `Unsupported chain: ${chain}. Supported chains are: ${Object.keys(SUPPORTED_CHAINS).join(', ')}`
      };
    }
    
    // Get chain configuration
    const chainConfig = SUPPORTED_CHAINS[chain];
    
    // Prepare request body
    const walletData = {
      type: chainConfig.type,
      config: {
        adminSigner: chainConfig.adminSigner
      }
    };
    
    // Link wallet to user
    walletData.linkedUser = `userId:${userId}`;
    
    // Call Crossmint API to create wallet
    const response = await axios.post(`${CROSSMINT_BASE_URL}/2022-06-09/wallets`, walletData, {
      headers: {
        "X-API-KEY": CROSSMINT_API_KEY,
        "Content-Type": "application/json"
      }
    });
    
    console.log(`Created wallet for user ${userId} on chain ${chain}:`, response.data);
    
    // Store wallet in database
    let wallet = await prisma.wallet.findFirst({
      where: { user_id: userId, chain }
    });
    
    // If wallet already exists for this chain, update it
    if (wallet) {
      wallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          address: response.data.address,
          type: chainConfig.type,
          updated_at: new Date()
        }
      });
    } else {
      // Create new wallet record
      wallet = await prisma.wallet.create({
        data: {
          user_id: userId,
          issuer_id: isIssuer ? await getIssuerId(userId) : null,
          address: response.data.address,
          type: chainConfig.type,
          chain,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }
    
    // If this is an issuer, generate a DID
    let did = null;
    if (isIssuer) {
      // Get or create DID
      did = await generateDIDForIssuer(userId);
    }
    
    return {
      success: true,
      data: {
        wallet,
        chain,
        did
      }
    };
  } catch (error) {
    console.error('Error creating Crossmint wallet:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get issuer ID for user
 * @param {number} userId - User ID
 * @returns {Promise<number|null>} Issuer ID or null
 * @private
 */
async function getIssuerId(userId) {
  const issuer = await prisma.issuer.findFirst({
    where: { user_id: userId }
  });
  
  return issuer?.id || null;
}

/**
 * Get wallet balance from Crossmint
 * @param {string} walletAddress - Wallet address
 * @param {string[]} tokens - Tokens to check balance for
 * @param {string[]} chains - Chains to check balance on
 * @returns {Promise<object>} Balance data
 */
async function getWalletBalance(walletAddress, tokens = ["eth", "usdc"], chains = ["ethereum-sepolia", "base-sepolia"]) {
  try {
    const url = new URL(`${CROSSMINT_BASE_URL}/v1-alpha2/wallets/${walletAddress}/balances`);
    url.search = new URLSearchParams({
      tokens: tokens.join(','),
      chains: chains.join(',')
    }).toString();
    
    const response = await axios.get(url.toString(), {
      headers: {
        "X-API-KEY": CROSSMINT_API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    throw error;
  }
}

/**
 * Verify Crossmint webhook signature
 * @param {string} signature - Webhook signature
 * @param {string} rawBody - Raw request body
 * @returns {boolean} Whether signature is valid
 */
function verifyWebhookSignature(signature, rawBody) {
  const webhookSecret = process.env.CROSSMINT_WEBHOOK_SECRET || 'whsec_wnSCMaGf3uCDYpdXciDBZB30IEMCWt8E';
  
  try {
    const hmac = crypto.createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    
    return signature === `sha256=${hmac}`;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

module.exports = {
  SUPPORTED_CHAINS,
  createWallet,
  getWalletBalance,
  generateCrossmintJWT,
  verifyWebhookSignature
}; 