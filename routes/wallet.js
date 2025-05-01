const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { createWallet, getWalletBalance } = require('../utils/crossmintUtils');
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
    
    // Check if userrole exists and is an array
    if (!req.user.userrole || !Array.isArray(req.user.userrole)) {
      console.error('User roles not found or not an array:', req.user);
      return res.status(403).json({ message: 'Forbidden - User roles not properly defined' });
    }
    
    const isIssuerRole = req.user.userrole.some(role => role.role === 'ISSUER');
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
    const userId = req.user.id;
    const role = req.user.role;
    const chain = req.query.chain || 'ethereum-sepolia'; // Allow chain to be specified in query

    // Check if wallet already exists
    let wallet = await prisma.wallet.findFirst({
      where: { user_id: userId }
    });

    if (!wallet) {
      // Create new wallet if none exists
      const isIssuer = role === 'issuer';
      const result = await createWallet(userId, isIssuer, chain);

      if (!result.success) {
        console.error('Failed to create wallet:', result.error);
        return res.status(500).json({ 
          error: 'Failed to create wallet',
          details: process.env.NODE_ENV === 'development' ? result.error : undefined
        });
      }

      wallet = result.data.wallet;
    }

    return res.json(wallet);
  } catch (error) {
    console.error('Error in wallet route:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create wallet for a specific chain
router.post('/create', isIssuer, async (req, res) => {
  try {
    const userId = req.user.id;
    const { chain } = req.body;
    
    if (!chain) {
      return res.status(400).json({
        error: 'Chain parameter is required',
        supportedChains: Object.keys(require('../utils/crossmintUtils').SUPPORTED_CHAINS)
      });
    }
    
    // Create new wallet for the specified chain
    const isIssuer = req.user.userrole.some(role => role.role === 'ISSUER');
    const result = await createWallet(userId, isIssuer, chain);

    if (!result.success) {
      console.error('Failed to create wallet:', result.error);
      return res.status(500).json({ 
        error: 'Failed to create wallet',
        details: process.env.NODE_ENV === 'development' ? result.error : undefined
      });
    }

    return res.json({
      success: true,
      wallet: result.data.wallet,
      chain: result.data.chain,
      did: result.data.did
    });
  } catch (error) {
    console.error('Error creating wallet:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

    // Get balance from Crossmint - removed 'usdt' which is unsupported
    const tokens = ["eth", "usdc"]; // Only using supported tokens
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
    res.status(500).json({ 
      message: 'Failed to fetch wallet balance', 
      error: error.response?.data || error.message 
    });
  }
});

// Get NFTs owned by the wallet
router.get('/nfts', isIssuer, async (req, res) => {
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

    // Get issuer information
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: req.user.id }
    });

    if (!issuer) {
      return res.status(404).json({ message: 'No issuer profile found for this user' });
    }

    let nfts = [];
    try {
      // Get credentials/NFTs associated with this issuer - safely get without relying on token_id
      const credentials = await prisma.issuer_credentials.findMany({
        where: { issuer_id: issuer.id },
        select: {
          id: true,
          credential_id: true,
          credential_type: true,
          status: true,
          issued_date: true,
          expiry_date: true,
          metadata: true
        },
        orderBy: { created_at: 'desc' }
      });

      // Format the response
      nfts = credentials.map(cred => {
        // Parse the metadata if it exists
        let metadata = {};
        try {
          if (cred.metadata) {
            metadata = JSON.parse(cred.metadata);
          }
        } catch (error) {
          console.warn(`Failed to parse metadata for credential ${cred.id}:`, error.message);
        }

        return {
          id: cred.id,
          credentialId: cred.credential_id,
          type: cred.credential_type,
          status: cred.status,
          issuedDate: cred.issued_date,
          expiryDate: cred.expiry_date,
          chain: metadata?.onChain?.chain,
          contractAddress: metadata?.onChain?.contractAddress,
          tokenId: metadata?.onChain?.tokenId,
          transactionHash: metadata?.onChain?.transactionHash,
          metadata: metadata
        };
      });
    } catch (dbError) {
      console.error('Error fetching database NFTs:', dbError);
      // Continue with empty nfts array
    }

    // Also fetch NFTs directly from Crossmint API for this wallet
    let crossmintNfts = [];
    try {
      // Use the collections API endpoint which is more reliable
      const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY;
      const CROSSMINT_BASE_URL = 'https://staging.crossmint.com/api';
      
      // First get the collections for the project
      const collectionsResponse = await axios.get(
        `${CROSSMINT_BASE_URL}/2022-06-09/collections`,
        {
          headers: {
            "X-API-KEY": CROSSMINT_API_KEY,
            "Content-Type": "application/json",
          }
        }
      );
      
      // For each collection, get the NFTs owned by this wallet
      if (collectionsResponse.data && Array.isArray(collectionsResponse.data.collections)) {
        const collections = collectionsResponse.data.collections;
        
        for (const collection of collections) {
          try {
            // Get NFTs for this collection and wallet
            const nftResponse = await axios.get(
              `${CROSSMINT_BASE_URL}/2022-06-09/collections/${collection.id}/nfts?owner=${wallet.address}`,
              {
                headers: {
                  "X-API-KEY": CROSSMINT_API_KEY,
                  "Content-Type": "application/json",
                }
              }
            );
            
            if (nftResponse.data && Array.isArray(nftResponse.data.nfts)) {
              // Add collection info to each NFT
              const collectionNfts = nftResponse.data.nfts.map(nft => ({
                ...nft,
                collectionId: collection.id,
                collectionName: collection.name
              }));
              
              crossmintNfts = [...crossmintNfts, ...collectionNfts];
            }
          } catch (collectionError) {
            console.error(`Error fetching NFTs for collection ${collection.id}:`, collectionError.message);
          }
        }
      }
      
      // Return both sets of NFTs
      res.json({
        dbNfts: nfts,
        crossmintNfts: crossmintNfts,
        total: nfts.length + crossmintNfts.length
      });
    } catch (crossmintError) {
      console.error('Error fetching NFTs from Crossmint:', crossmintError.message);
      // If Crossmint API fails, just return our database records
      res.json({
        dbNfts: nfts,
        crossmintNfts: [],
        total: nfts.length
      });
    }
  } catch (error) {
    console.error('Error fetching wallet NFTs:', error);
    res.status(500).json({ 
      message: 'Failed to fetch wallet NFTs', 
      error: error.message 
    });
  }
});

// Send tokens via wallet
router.post('/send', isIssuer, async (req, res) => {
  try {
    const { to, amount, token = 'MATIC', chain = 'POLYGON' } = req.body;

    // Validate required fields
    if (!to || !amount) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          to: !to ? 'Recipient address is required' : null,
          amount: !amount ? 'Amount is required' : null
        }
      });
    }

    // Validate amount format
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ 
        message: 'Invalid amount',
        details: 'Amount must be a positive number'
      });
    }

    const wallet = await prisma.wallet.findFirst({
      where: { user_id: req.user.id },
      select: { address: true }
    });

    if (!wallet) {
      return res.status(404).json({ message: 'No wallet found for this user' });
    }

    // Create transaction via Crossmint API - updated to v1-alpha2
    try {
      const response = await axios.post(`${CROSSMINT_BASE_URL}/v1-alpha2/transactions`, {
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
        transaction: {
          id: response.data.id,
          status: response.data.status,
          from: response.data.from,
          to: response.data.to,
          amount: response.data.amount,
          token: response.data.token,
          chain: response.data.chain,
          timestamp: response.data.timestamp
        }
      });
    } catch (crossmintError) {
      console.error('Crossmint API error:', crossmintError.response?.data);
      return res.status(crossmintError.response?.status || 500).json({
        message: 'Failed to send tokens via Crossmint',
        error: crossmintError.response?.data?.message || crossmintError.message,
        details: crossmintError.response?.data?.details || {}
      });
    }
  } catch (error) {
    console.error('Error in send tokens route:', error);
    res.status(500).json({ 
      message: 'Internal server error while processing token send request',
      error: error.message 
    });
  }
});

// Get transaction history with pagination and filtering
router.get('/transactions', isIssuer, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate, 
      type 
    } = req.query;

    const wallet = await prisma.wallet.findFirst({
      where: { user_id: req.user.id },
      select: { address: true }
    });

    if (!wallet) {
      return res.status(404).json({ message: 'No wallet found for this user' });
    }

    // Build query parameters for Crossmint API
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);
    if (type) queryParams.append('type', type);
    queryParams.append('page', page);
    queryParams.append('limit', limit);

    try {
      const response = await axios.get(
        `${CROSSMINT_BASE_URL}/v1-alpha2/wallets/${wallet.address}/transactions?${queryParams}`,
        {
          headers: {
            "X-API-KEY": CROSSMINT_API_KEY,
            "Content-Type": "application/json",
          }
        }
      );

      // Transform and structure the response data
      const transactions = response.data.transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        status: tx.status,
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        token: tx.token,
        chain: tx.chain,
        timestamp: tx.timestamp,
        hash: tx.hash
      }));

      res.json({
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(response.data.total / limit),
          totalItems: response.data.total,
          itemsPerPage: parseInt(limit)
        }
      });
    } catch (crossmintError) {
      console.error('Crossmint API error:', crossmintError.response?.data);
      return res.status(crossmintError.response?.status || 500).json({
        message: 'Failed to fetch transactions from Crossmint',
        error: crossmintError.response?.data?.message || crossmintError.message,
        details: crossmintError.response?.data?.details || {}
      });
    }
  } catch (error) {
    console.error('Error in transaction history route:', error);
    res.status(500).json({ 
      message: 'Internal server error while fetching transactions',
      error: error.message 
    });
  }
});

router.get('/:walletId', async (req, res) => {
  try {
    const { walletId } = req.params;
    
    if (!walletId || typeof walletId !== 'string') {
      return res.status(400).json({ error: 'Invalid wallet ID format' });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json(wallet);
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({ 
      error: 'Failed to fetch wallet details',
      message: error.message 
    });
  }
});

module.exports = router; 