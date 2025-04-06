const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

// Crossmint API configuration
const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || "sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P";
const CROSSMINT_BASE_URL = "https://staging.crossmint.com/api";

// Middleware to check if user is authenticated and is an admin
const isAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const isAdminRole = req.user.roles.some(role => role.role === 'ADMIN');
  if (!isAdminRole) {
    return res.status(403).json({ message: 'Forbidden - Admin access required' });
  }
  
  next();
};

// Get all users for admin dashboard
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        roles: true,
        admin: true,
        issuer: true,
        investor: true
      }
    });
    
    // Format the response data to include necessary information
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      email_verified: user.email_verified,
      created_at: user.created_at,
      roles: user.roles,
      // Add verification status based on role
      verification_status: user.roles.some(role => role.role === 'ISSUER') && user.issuer 
        ? (user.issuer.verification_status ? 'VERIFIED' : 'PENDING')
        : (user.roles.some(role => role.role === 'INVESTOR') && user.investor 
          ? user.investor.accreditation_status
          : 'NA')
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Get all wallets for admin dashboard
router.get('/wallets', isAdmin, async (req, res) => {
  try {
    const wallets = await prisma.wallet.findMany({
      include: {
        user: {
          include: {
            roles: true
          }
        }
      }
    });
    
    // Format the response to include user information
    const formattedWallets = wallets.map(wallet => ({
      id: wallet.id,
      address: wallet.address,
      type: wallet.type,
      chain: wallet.chain,
      is_custodial: wallet.is_custodial,
      created_at: wallet.created_at,
      user: {
        id: wallet.user.id,
        email: wallet.user.email,
        first_name: wallet.user.first_name,
        last_name: wallet.user.last_name,
        roles: wallet.user.roles.map(role => role.role)
      }
    }));

    res.json(formattedWallets);
  } catch (error) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({ message: 'Failed to fetch wallets' });
  }
});

// Get specific wallet details by ID
router.get('/wallets/:walletId', isAdmin, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    const wallet = await prisma.wallet.findUnique({
      where: { id: parseInt(walletId) },
      include: {
        user: {
          include: {
            roles: true
          }
        }
      }
    });
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    
    // Return wallet details
    const walletDetails = {
      id: wallet.id,
      address: wallet.address,
      type: wallet.type,
      chain: wallet.chain,
      is_custodial: wallet.is_custodial,
      created_at: wallet.created_at,
      user: {
        id: wallet.user.id,
        email: wallet.user.email,
        first_name: wallet.user.first_name,
        last_name: wallet.user.last_name,
        roles: wallet.user.roles.map(role => role.role)
      }
    };
    
    res.json(walletDetails);
  } catch (error) {
    console.error('Error fetching wallet details:', error);
    res.status(500).json({ message: 'Failed to fetch wallet details' });
  }
});

// Get wallet balance by ID
router.get('/wallets/:walletId/balance', isAdmin, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    const wallet = await prisma.wallet.findUnique({
      where: { id: parseInt(walletId) }
    });
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
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

// Get wallet transactions by ID
router.get('/wallets/:walletId/transactions', isAdmin, async (req, res) => {
  try {
    const { walletId } = req.params;
    
    const wallet = await prisma.wallet.findUnique({
      where: { id: parseInt(walletId) }
    });
    
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
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