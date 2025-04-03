const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

// Middleware to check if user is authenticated and is an issuer
const isIssuer = (req, res, next) => {
  try {
    // Check if user exists from JWT middleware
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      console.log('Authentication check failed in isIssuer middleware');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    console.log('isIssuer middleware - User:', req.user);
    
    // Check if roles exist and is an array
    if (!req.user.roles || !Array.isArray(req.user.roles)) {
      console.error('User roles not found or not an array:', req.user);
      return res.status(403).json({ message: 'Forbidden - User roles not properly defined' });
    }
    
    const isIssuerRole = req.user.roles.some(role => role.role === 'ISSUER');
    if (!isIssuerRole) {
      console.log('User does not have ISSUER role:', req.user.email);
      return res.status(403).json({ message: 'Forbidden - Issuer access required' });
    }
    
    next();
  } catch (error) {
    console.error('Error in isIssuer middleware:', error);
    return res.status(500).json({ message: 'Server error in authentication middleware', error: error.message });
  }
};

// Crossmint API configuration
const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || "sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P";
const CROSSMINT_BASE_URL = "https://staging.crossmint.com/api";

// Get wallet
router.get('/', isIssuer, async (req, res) => {
  try {
    console.log('GET /api/wallet - User ID:', req.user.id);
    
    // Get user's wallet
    const wallet = await prisma.wallet.findFirst({
      where: {
        user_id: req.user.id
      }
    });

    console.log('Wallet found:', wallet);

    // If wallet doesn't exist, create one automatically
    if (!wallet) {
      console.log('No wallet found, auto-creating wallet for user:', req.user.id);
      console.log('User email:', req.user.email);
      
      try {
        // Create wallet via Crossmint API
        const response = await axios.post(`${CROSSMINT_BASE_URL}/2022-06-09/wallets`, {
          type: "evm-smart-wallet",
          config: {
            adminSigner: {
              type: "evm-fireblocks-custodial",
            },
          },
          // Link wallet directly to user's email
          linkedUser: `email:${req.user.email}`
        }, {
          headers: {
            "X-API-KEY": CROSSMINT_API_KEY,
            "Content-Type": "application/json",
          }
        });
        
        console.log('Crossmint API response:', response.data);

        // Save wallet details to database
        const newWallet = await prisma.wallet.create({
          data: {
            user_id: req.user.id,
            address: response.data.address,
            type: "evm-smart-wallet",
            chain: "evm",
            is_custodial: true,
            admin_signer: response.data.config.adminSigner?.address || null,
            created_at: new Date()
          }
        });
        
        console.log('Wallet auto-created in database:', newWallet);
        
        return res.json({
          address: newWallet.address,
          type: newWallet.type,
          chain: newWallet.chain,
          is_custodial: newWallet.is_custodial,
          created_at: newWallet.created_at
        });
      } catch (error) {
        console.error('Error auto-creating wallet:', error.message);
        
        if (error.response) {
          console.error('Crossmint API error:', error.response.data);
          return res.status(error.response.status).json({ 
            message: 'Error auto-creating wallet', 
            error: error.response.data 
          });
        }
        
        return res.status(500).json({ 
          message: 'Failed to auto-create wallet', 
          error: error.message 
        });
      }
    }

    // Return existing wallet
    res.json({
      address: wallet.address,
      type: wallet.type,
      chain: wallet.chain,
      is_custodial: wallet.is_custodial,
      created_at: wallet.created_at
    });
  } catch (error) {
    console.error('Error fetching wallet:', error.message);
    if (error.name === 'PrismaClientInitializationError') {
      return res.status(500).json({ message: 'Database connection error', error: error.message });
    }
    if (error.name === 'PrismaClientKnownRequestError') {
      return res.status(500).json({ message: 'Database query error', error: error.message });
    }
    res.status(500).json({ message: 'Failed to fetch wallet', error: error.message });
  }
});

// Get wallet balance
router.get('/balance', isIssuer, async (req, res) => {
  try {
    // Get user's wallet
    const wallet = await prisma.wallet.findFirst({
      where: {
        user_id: req.user.id
      }
    });

    if (!wallet) {
      return res.status(404).json({ message: 'No wallet found for this user' });
    }

    // Get balance from Crossmint
    const tokens = ["eth", "usdc", "usdt"];
    const chains = ["polygon-mumbai", "base-sepolia"]; // Testnets

    const balanceUrl = new URL(`${CROSSMINT_BASE_URL}/v1-alpha2/wallets/${wallet.address}/balances`);
    balanceUrl.search = new URLSearchParams({
      tokens: tokens.join(','),
      chains: chains.join(',')
    }).toString();

    const response = await axios.get(balanceUrl, {
      headers: {
        "X-API-KEY": CROSSMINT_API_KEY,
        "Content-Type": "application/json",
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching wallet balance:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to fetch wallet balance', error: error.message });
  }
});

// Send tokens
router.post('/send', isIssuer, async (req, res) => {
  try {
    const { to, amount, token, chain } = req.body;

    if (!to || !amount || !token || !chain) {
      return res.status(400).json({ message: 'Missing required fields: to, amount, token, chain' });
    }

    // Get user's wallet
    const wallet = await prisma.wallet.findFirst({
      where: {
        user_id: req.user.id
      }
    });

    if (!wallet) {
      return res.status(404).json({ message: 'No wallet found for this user' });
    }

    // Create transaction via Crossmint API
    const response = await axios.post(`${CROSSMINT_BASE_URL}/v1-alpha1/transactions`, {
      from: wallet.address,
      to,
      amount,
      token,
      chain
    }, {
      headers: {
        "X-API-KEY": CROSSMINT_API_KEY,
        "Content-Type": "application/json",
      }
    });

    res.json({
      message: 'Transaction submitted successfully',
      transaction: response.data
    });
  } catch (error) {
    console.error('Error sending tokens:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to send tokens', error: error.message });
  }
});

// Get transaction history
router.get('/transactions', isIssuer, async (req, res) => {
  try {
    // Get user's wallet
    const wallet = await prisma.wallet.findFirst({
      where: {
        user_id: req.user.id
      }
    });

    if (!wallet) {
      return res.status(404).json({ message: 'No wallet found for this user' });
    }

    // Get transactions from Crossmint
    const response = await axios.get(`${CROSSMINT_BASE_URL}/v1-alpha1/wallets/${wallet.address}/transactions`, {
      headers: {
        "X-API-KEY": CROSSMINT_API_KEY,
        "Content-Type": "application/json",
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching transactions:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
});

module.exports = router; 