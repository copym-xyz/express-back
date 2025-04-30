const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const crypto = require('crypto');
const { isAdmin } = require('../middleware/auth');
const extractUserId = require('../utils/extractUserId');
const { generateDIDForIssuer } = require('../utils/didUtils');

// Crossmint API configuration
const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || "sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P";
const CROSSMINT_BASE_URL = "https://staging.crossmint.com/api";

// Sumsub credentials
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

// Create signature for Sumsub API
function createSignature(method, endpoint, ts, payload = '') {
  const data = ts + method + endpoint + payload;
  return crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(data)
    .digest('hex');
}

// Helper function to make Sumsub API requests
async function makeSumsubRequest(method, endpoint, body = null) {
  const ts = Math.floor(Date.now() / 1000).toString();
  
  let payload = '';
  if (body && Object.keys(body).length > 0) {
    payload = JSON.stringify(body);
  }
  
  const signature = createSignature(method, endpoint, ts, payload);
  
  const headers = {
    'Accept': 'application/json',
    'X-App-Token': SUMSUB_APP_TOKEN,
    'X-App-Access-Sig': signature,
    'X-App-Access-Ts': ts
  };
  
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  
  try {
    const response = await axios({
      method,
      url: `${SUMSUB_BASE_URL}${endpoint}`,
      headers,
      data: body || undefined
    });
    
    return response.data;
  } catch (error) {
    console.error(`Sumsub API error (${method} ${endpoint}):`, error.message);
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
    }
    throw error;
  }
}

// Get all Sumsub applicants for admin dashboard
router.get('/sumsub/applicants', isAdmin, async (req, res) => {
  try {
    console.log('Fetching applicants from Sumsub...');
    
    // Use the Sumsub list applicants endpoint
    const endpoint = '/resources/applicants?limit=50';
    const applicantsData = await makeSumsubRequest('GET', endpoint);
    
    console.log(`Retrieved ${applicantsData.items?.length || 0} applicants from Sumsub`);
    
    // Return the applicants data
    res.json(applicantsData);
  } catch (error) {
    console.error('Error fetching applicants from Sumsub:', error.message);
    res.status(500).json({ message: 'Failed to fetch applicants from Sumsub' });
  }
});

// Get all users for admin dashboard
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      include: {
        userrole: true,
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
      created_at: user.created_at,
      is_active: true,
      roles: user.userrole,
      // Add profile property that the frontend expects
      profile: {
        first_name: user.first_name,
        last_name: user.last_name,
        is_verified: user.is_verified
      },
      // Add verification status based on role
      verification_status: user.userrole.some(role => role.role === 'ISSUER') && user.issuer 
        ? (user.issuer.verification_status ? 'VERIFIED' : 'PENDING')
        : (user.userrole.some(role => role.role === 'INVESTOR') && user.investor 
          ? user.investor.accreditation_status
          : 'NA')
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Get KYC verifications from local database
router.get('/kyc-verifications', isAdmin, async (req, res) => {
  try {
    const { userId } = req.query;
    
    // Build query conditions
    const whereCondition = {};
    
    // If userId is provided, first get the issuer to find applicant ID
    if (userId) {
      console.log(`Searching for verifications for user ID: ${userId}`);
      const issuer = await prisma.issuer.findFirst({
        where: { user_id: parseInt(userId) }
      });
      
      if (issuer && issuer.sumsub_applicant_id) {
        console.log(`Found issuer with applicant ID: ${issuer.sumsub_applicant_id}`);
        whereCondition.applicant_id = issuer.sumsub_applicant_id;
      } else {
        console.log(`No issuer found with applicant ID for user ID: ${userId}`);
        // If no issuer found with this userId, return empty results
        return res.json([]);
      }
    }
    
    // Get KYC verifications
    console.log('Searching for KYC verifications with conditions:', JSON.stringify(whereCondition));
    const verifications = await prisma.kycVerification.findMany({
      where: whereCondition,
      orderBy: {
        created_at: 'desc'
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });
    
    console.log(`Found ${verifications.length} verifications`);
    res.json(verifications);
  } catch (error) {
    console.error('Error fetching KYC verifications:', error);
    res.status(500).json({ 
      message: 'Failed to fetch KYC verifications',
      error: error.message 
    });
  }
});

// Get details for a specific KYC verification
router.get('/kyc-verifications/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get KYC verification details
    const verification = await prisma.kycVerification.findUnique({
      where: { id: parseInt(id) },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        }
      }
    });
    
    if (!verification) {
      return res.status(404).json({ message: 'KYC verification not found' });
    }
    
    // Get personal information if available
    const personalInfo = await prisma.kyc_personal_info.findFirst({
      where: { applicant_id: verification.applicant_id }
    });
    
    // Get document information if available
    const documents = await prisma.KycDocument.findMany({
      where: { applicant_id: verification.applicant_id }
    });
    
    // Also get complete record if available
    const completeRecord = await prisma.kyc_complete_records.findFirst({
      where: { applicant_id: verification.applicant_id }
    });
    
    // Combine all data
    const enrichedResponse = {
      ...verification,
      personalInfo: personalInfo || null,
      documents: documents || [],
      completeRecord: completeRecord || null
    };
    
    res.json(enrichedResponse);
  } catch (error) {
    console.error('Error fetching KYC verification details:', error);
    res.status(500).json({ 
      message: 'Failed to fetch KYC verification details',
      error: error.message 
    });
  }
});

// Get all wallets for admin dashboard
router.get('/wallets', isAdmin, async (req, res) => {
  try {
    const wallets = await prisma.wallet.findMany({
      include: {
        users: {
          include: {
            userrole: true
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
        id: wallet.users.id,
        email: wallet.users.email,
        first_name: wallet.users.first_name,
        last_name: wallet.users.last_name,
        roles: wallet.users.userrole.map(role => role.role)
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
      where: { id: walletId },
      include: {
        users: {
          include: {
            userrole: true
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
        id: wallet.users.id,
        email: wallet.users.email,
        first_name: wallet.users.first_name,
        last_name: wallet.users.last_name,
        roles: wallet.users.userrole.map(role => role.role)
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
      where: { id: walletId }
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
      where: { id: walletId }
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
        users: {
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
        applicantUserMap[issuer.sumsub_applicant_id] = issuer.users;
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
        users: {
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
      user: issuer?.users || null
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

// Get personal info for a specific applicant
router.get('/kyc-personal-info/:applicantId', isAdmin, async (req, res) => {
  try {
    const { applicantId } = req.params;
    
    // Get personal information if available
    const personalInfo = await prisma.kyc_personal_info.findFirst({
      where: { applicant_id: applicantId }
    });
    
    if (!personalInfo) {
      return res.status(404).json({ message: 'Personal information not found' });
    }
    
    res.json(personalInfo);
  } catch (error) {
    console.error('Error fetching personal information:', error);
    res.status(500).json({ 
      message: 'Failed to fetch personal information',
      error: error.message 
    });
  }
});

// Fix unassociated KYC verifications
router.post('/fix-kyc-associations', isAdmin, async (req, res) => {
  try {
    console.log('Starting KYC verification association fix');
    
    // Find all KYC verifications without user associations
    const unlinkedVerifications = await prisma.kycVerification.findMany({
      where: {
        userId: null
      }
    });
    
    console.log(`Found ${unlinkedVerifications.length} unlinked KYC verifications`);
    
    let linkedCount = 0;
    let updatedIssuerCount = 0;
    const errors = [];
    
    // Process each unlinked verification
    for (const verification of unlinkedVerifications) {
      try {
        // Try to find a matching issuer by applicantId
        let issuer = await prisma.issuer.findFirst({
          where: { sumsub_applicant_id: verification.applicantId },
          include: { users: true }
        });
        
        // If no issuer found by applicantId, try to extract user ID from externalUserId
        if (!issuer && verification.externalUserId) {
          // Extract userId using our utility function
          const extractedUserId = extractUserId(verification.externalUserId);
          
          if (extractedUserId) {
            // Find user by ID
            const user = await prisma.users.findUnique({
              where: { id: extractedUserId }
            });
            
            if (user) {
              console.log(`Found user ${user.email} (ID: ${user.id}) via externalUserId ${verification.externalUserId}`);
              
              // Find this user's issuer
              const userIssuer = await prisma.issuer.findFirst({
                where: { users_id: user.id }
              });
              
              if (userIssuer) {
                // If the issuer doesn't have an applicantId yet, update it
                if (!userIssuer.sumsub_applicant_id) {
                  await prisma.issuer.update({
                    where: { id: userIssuer.id },
                    data: { 
                      sumsub_applicant_id: verification.applicantId,
                      sumsub_external_id: verification.externalUserId
                    }
                  });
                  updatedIssuerCount++;
                  console.log(`Updated issuer ${userIssuer.id} with applicantId ${verification.applicantId}`);
                }
                
                // Update the verification record with the user ID
                await prisma.kycVerification.update({
                  where: { id: verification.id },
                  data: { userId: user.id }
                });
                
                linkedCount++;
                console.log(`Linked verification ID ${verification.id} to user ID ${user.id}`);
              } else {
                // Even if there is no issuer, we can still link the verification to the user
                await prisma.kycVerification.update({
                  where: { id: verification.id },
                  data: { userId: user.id }
                });
                
                linkedCount++;
                console.log(`Linked verification ID ${verification.id} to user ID ${user.id} (no issuer)`);
              }
            }
          }
        } else if (issuer) {
          // If we found an issuer directly, update the verification with its user ID
          await prisma.kycVerification.update({
            where: { id: verification.id },
            data: { userId: issuer.users_id }
          });
          
          linkedCount++;
          console.log(`Linked verification ID ${verification.id} to user ID ${issuer.users_id} via issuer`);
        }
      } catch (error) {
        console.error(`Error processing verification ${verification.id}:`, error);
        errors.push({ id: verification.id, error: error.message });
      }
    }
    
    res.json({
      success: true,
      total: unlinkedVerifications.length,
      linked: linkedCount,
      issuersUpdated: updatedIssuerCount,
      errors: errors
    });
    
  } catch (error) {
    console.error('Error fixing KYC associations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix KYC associations',
      error: error.message
    });
  }
});

// Generate DID for a verified issuer
router.post('/issuers/:issuerId/generate-did', isAdmin, async (req, res) => {
  try {
    const { issuerId } = req.params;
    
    if (!issuerId || isNaN(parseInt(issuerId))) {
      return res.status(400).json({ success: false, message: 'Valid issuer ID is required' });
    }
    
    const parsedIssuerId = parseInt(issuerId);
    
    // Check if issuer exists and is verified
    const issuer = await prisma.issuer.findUnique({
      where: { id: parsedIssuerId },
      include: {
        users: true
      }
    });
    
    if (!issuer) {
      return res.status(404).json({ success: false, message: 'Issuer not found' });
    }
    
    if (!issuer.verification_status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Issuer is not verified. Only verified issuers can have DIDs generated.'
      });
    }
    
    // Generate DID
    const result = await generateDIDForIssuer(parsedIssuerId);
    
    if (result.success) {
      return res.json({ 
        success: true, 
        message: 'DID generated successfully', 
        did: result.did,
        issuer: {
          id: issuer.id,
          userEmail: issuer.users.email,
          userName: `${issuer.users.first_name} ${issuer.users.last_name}`,
          companyName: issuer.company_name
        }
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to generate DID', 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Error generating DID for issuer:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating DID', 
      error: error.message 
    });
  }
});

// Generate DIDs for all verified issuers without DIDs
router.post('/issuers/generate-all-dids', isAdmin, async (req, res) => {
  try {
    // Find all verified issuers without DIDs
    const verifiedIssuersWithoutDIDs = await prisma.issuer.findMany({
      where: { 
        verification_status: true,
        did: null
      },
      include: {
        users: {
          include: {
            wallet: true
          }
        }
      },
      orderBy: { id: 'asc' }
    });
    
    if (verifiedIssuersWithoutDIDs.length === 0) {
      return res.json({
        success: true, 
        message: 'No verified issuers without DIDs found. All DIDs are up to date.',
        issuersProcessed: 0,
        successful: 0,
        failed: 0,
        results: []
      });
    }
    
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    // Generate DIDs for each issuer sequentially
    for (const issuer of verifiedIssuersWithoutDIDs) {
      // Skip issuers without wallets
      if (!issuer.users?.wallet) {
        results.push({
          id: issuer.id,
          companyName: issuer.company_name,
          success: false,
          message: 'No wallet found for issuer'
        });
        failureCount++;
        continue;
      }
      
      const result = await generateDIDForIssuer(issuer.id);
      
      if (result.success) {
        results.push({
          id: issuer.id,
          companyName: issuer.company_name,
          success: true,
          did: result.did
        });
        successCount++;
      } else {
        results.push({
          id: issuer.id,
          companyName: issuer.company_name,
          success: false,
          message: result.error
        });
        failureCount++;
      }
    }
    
    return res.json({
      success: true,
      message: 'Batch DID generation completed',
      issuersProcessed: verifiedIssuersWithoutDIDs.length,
      successful: successCount,
      failed: failureCount,
      results
    });
    
  } catch (error) {
    console.error('Error in batch DID generation:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error generating DIDs in batch', 
      error: error.message 
    });
  }
});

module.exports = router; 