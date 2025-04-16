const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const crypto = require('crypto');

// Crossmint API configuration
const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || "sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P";
const CROSSMINT_BASE_URL = "https://staging.crossmint.com/api";

// Sumsub credentials
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

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

// Create signature for Sumsub API
function createSignature(method, endpoint, ts, payload = '') {
  const data = ts + method + endpoint + payload;
  return crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(data)
    .digest('hex');
}

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

// Get KYC verifications for admin dashboard
router.get('/kyc-verifications', isAdmin, async (req, res) => {
  try {
    const { userId } = req.query;
    let where = {};
    
    // If userId is provided, filter by that user
    if (userId) {
      where.userId = parseInt(userId);
    }
    
    // Get the verification records
    const verifications = await prisma.kycVerification.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            issuer: true
          }
        }
      }
    });
    
    // Format the response
    const formattedVerifications = verifications.map(verification => {
      // Parse the raw JSON data
      let rawData = {};
      try {
        rawData = JSON.parse(verification.rawData);
      } catch (e) {
        console.error('Error parsing verification raw data:', e);
      }
      
      return {
        id: verification.id,
        applicantId: verification.applicantId,
        externalUserId: verification.externalUserId,
        inspectionId: verification.inspectionId,
        correlationId: verification.correlationId,
        type: verification.type,
        reviewStatus: verification.reviewStatus,
        reviewResult: verification.reviewResult,
        createdAt: verification.createdAt,
        user: verification.user,
        // Include selected fields from raw data that admins might need
        rawData: {
          type: rawData.type,
          reviewStatus: rawData.reviewStatus,
          levelName: rawData.levelName,
          clientId: rawData.clientId,
          sandboxMode: rawData.sandboxMode,
          reviewResult: rawData.reviewResult,
          rejectLabels: rawData.rejectLabels || []
        }
      };
    });
    
    res.json(formattedVerifications);
  } catch (error) {
    console.error('Error fetching KYC verifications:', error);
    res.status(500).json({ message: 'Failed to fetch KYC verifications' });
  }
});

// Get detailed KYC verification by ID
router.get('/kyc-verifications/:id', isAdmin, async (req, res) => {
  try {
    const verification = await prisma.kycVerification.findUnique({
      where: {
        id: parseInt(req.params.id)
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            issuer: true
          }
        }
      }
    });
    
    if (!verification) {
      return res.status(404).json({ message: 'Verification not found' });
    }
    
    // Parse the raw JSON data to provide all details
    let rawData = {};
    try {
      rawData = JSON.parse(verification.rawData);
    } catch (e) {
      console.error('Error parsing verification raw data:', e);
    }
    
    // Combine the verification record with the parsed raw data
    const detailedVerification = {
      ...verification,
      parsedRawData: rawData
    };
    
    res.json(detailedVerification);
  } catch (error) {
    console.error('Error fetching KYC verification details:', error);
    res.status(500).json({ message: 'Failed to fetch KYC verification details' });
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

// Get all applicants from Sumsub
router.get('/sumsub/applicants', isAdmin, async (req, res) => {
  try {
    // Get parameters from query string
    const { status, offset = 0, limit = 20 } = req.query;
    
    // Build URL with query parameters
    let endpoint = '/resources/applicants';
    let queryParams = [];
    
    if (status) queryParams.push(`status=${status}`);
    if (limit) queryParams.push(`limit=${limit}`);
    if (offset) queryParams.push(`offset=${offset}`);
    
    if (queryParams.length > 0) {
      endpoint += '?' + queryParams.join('&');
    }
    
    const method = 'GET';
    const ts = Math.floor(Date.now() / 1000).toString();
    const signature = createSignature(method, endpoint, ts);
    
    const response = await axios({
      method,
      url: `${SUMSUB_BASE_URL}${endpoint}`,
      headers: {
        'Accept': 'application/json',
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': ts
      }
    });
    
    // Find user associations for these applicants
    const applicantIds = (response.data.items || []).map(item => item.id);
    const userAssociations = await prisma.issuer.findMany({
      where: {
        sumsub_applicant_id: { in: applicantIds }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });
    
    // Create a map of applicantId to user
    const applicantUserMap = {};
    userAssociations.forEach(issuer => {
      if (issuer.sumsub_applicant_id) {
        applicantUserMap[issuer.sumsub_applicant_id] = issuer.user;
      }
    });
    
    // Enrich the response with user data
    const enrichedItems = (response.data.items || []).map(item => ({
      ...item,
      user: applicantUserMap[item.id] || null
    }));
    
    res.json({
      ...response.data,
      items: enrichedItems
    });
  } catch (error) {
    console.error('Error fetching applicants from Sumsub:', error.message);
    res.status(500).json({ 
      message: 'Failed to fetch applicants from Sumsub',
      error: error.message
    });
  }
});

// Get applicant data from Sumsub API
router.get('/sumsub/applicant/:applicantId', isAdmin, async (req, res) => {
  try {
    const { applicantId } = req.params;
    const endpoint = `/resources/applicants/${applicantId}`;
    const method = 'GET';
    const ts = Math.floor(Date.now() / 1000).toString();
    const signature = createSignature(method, endpoint, ts);
    
    const response = await axios({
      method,
      url: `${SUMSUB_BASE_URL}${endpoint}`,
      headers: {
        'Accept': 'application/json',
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': ts
      }
    });
    
    // Find user association for this applicant
    const issuer = await prisma.issuer.findFirst({
      where: { sumsub_applicant_id: applicantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });
    
    // Enrich response with user data if found
    const enrichedResponse = {
      ...response.data,
      user: issuer?.user || null
    };
    
    res.json(enrichedResponse);
  } catch (error) {
    console.error('Error fetching applicant from Sumsub:', error.message);
    res.status(500).json({ 
      message: 'Failed to fetch applicant data from Sumsub',
      error: error.message
    });
  }
});

// Get applicant document images
router.get('/sumsub/applicant/:applicantId/documents', isAdmin, async (req, res) => {
  try {
    const { applicantId } = req.params;
    const endpoint = `/resources/applicants/${applicantId}/info/idDocs`;
    const method = 'GET';
    const ts = Math.floor(Date.now() / 1000).toString();
    const signature = createSignature(method, endpoint, ts);
    
    const response = await axios({
      method,
      url: `${SUMSUB_BASE_URL}${endpoint}`,
      headers: {
        'Accept': 'application/json',
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': ts
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching applicant documents from Sumsub:', error.message);
    res.status(500).json({ 
      message: 'Failed to fetch applicant documents from Sumsub',
      error: error.message
    });
  }
});

module.exports = router; 