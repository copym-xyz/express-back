const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Configuration from environment variables
const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || "sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P";
const CROSSMINT_BASE_URL = "https://staging.crossmint.com/api";
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

/**
 * Admin Service - Contains business logic for admin-related operations
 */
class AdminService {
  /**
   * Utility function to extract numeric userId from various externalUserId formats
   * Handles formats like userId-123, user-123, issuer-123, level-xxx, 123, temp-timestamp
   * @param {string} externalUserId - The externalUserId from Sumsub
   * @returns {number|null} - The numeric user ID or null if not found
   */
  extractUserId(externalUserId) {
    if (!externalUserId || typeof externalUserId !== 'string') {
      console.log(`Invalid externalUserId: ${externalUserId}`);
      return null;
    }

    console.log(`Extracting userId from: ${externalUserId}`);

    // Check for test or temporary IDs
    if (externalUserId.startsWith('temp-') || externalUserId.startsWith('test-')) {
      console.log('Temporary or test ID detected, skipping extraction');
      return null;
    }

    // Check for level-based IDs (used in SDK)
    if (externalUserId.startsWith('level-')) {
      console.log('Level-based ID detected, not a direct user reference');
      // These are not user IDs, they're generated per verification session
      return null;
    }

    // Check for the standard format "userId-123"
    const standardFormat = externalUserId.match(/^userId[-_](\d+)$/i);
    if (standardFormat && standardFormat[1]) {
      const id = parseInt(standardFormat[1], 10);
      console.log(`Extracted userId ${id} from standard format`);
      return id;
    }

    // Check for the legacy format "user-123"
    const legacyFormat = externalUserId.match(/^user[-_](\d+)$/i);
    if (legacyFormat && legacyFormat[1]) {
      const id = parseInt(legacyFormat[1], 10);
      console.log(`Extracted userId ${id} from legacy format`);
      return id;
    }

    // Check for the issuer format "issuer-123"
    const issuerFormat = externalUserId.match(/^issuer[-_](\d+)$/i);
    if (issuerFormat && issuerFormat[1]) {
      const id = parseInt(issuerFormat[1], 10);
      console.log(`Extracted userId ${id} from issuer format`);
      return id;
    }

    // Check if the entire string is numeric
    if (/^\d+$/.test(externalUserId)) {
      const id = parseInt(externalUserId, 10);
      console.log(`Extracted userId ${id} from numeric format`);
      return id;
    }

    // Check for any numeric part in the string - only as last resort
    const anyNumeric = externalUserId.match(/(\d+)/);
    if (anyNumeric && anyNumeric[1]) {
      // Only use this as a last resort, and only if the number is likely a user ID
      // (e.g., not just a single digit or very large number)
      const potentialId = parseInt(anyNumeric[1], 10);
      if (potentialId > 10 && potentialId < 1000000) {
        console.log(`Extracted userId ${potentialId} from partial match (low confidence)`);
        return potentialId;
      }
    }

    console.log(`No valid userId found in: ${externalUserId}`);
    return null;
  }
  /**
   * Creates a Sumsub API signature
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {string} ts - Timestamp
   * @param {string} payload - Request payload
   * @returns {string} Signature
   */
  createSignature(method, endpoint, ts, payload = '') {
    const data = ts + method.toUpperCase() + endpoint + payload;
    return crypto
      .createHmac('sha256', SUMSUB_SECRET_KEY)
      .update(data)
      .digest('hex');
  }

  /**
   * Makes a request to the Sumsub API
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} body - Request body
   * @returns {Promise<object>} API response
   */
  async makeSumsubRequest(method, endpoint, body = null) {
    const ts = Math.floor(Date.now() / 1000).toString();
    const payload = body ? JSON.stringify(body) : '';
    const signature = this.createSignature(method, endpoint, ts, payload);
    
    const headers = {
      'Accept': 'application/json',
      'X-App-Token': SUMSUB_APP_TOKEN,
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': ts
    };
    
    if (body) headers['Content-Type'] = 'application/json';
    
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

  /**
   * Get Sumsub applicants with optional filtering
   * @param {object} options - Query options
   * @returns {Promise<object>} Applicants data
   */
  async getSumsubApplicants(options = {}) {
    const { status, offset = 0, limit = 20 } = options;
    
    // Build URL with query parameters
    let endpoint = '/resources/applicants';
    const queryParams = [];
    
    if (status) queryParams.push(`status=${status}`);
    if (limit) queryParams.push(`limit=${limit}`);
    if (offset) queryParams.push(`offset=${offset}`);
    
    if (queryParams.length > 0) {
      endpoint += '?' + queryParams.join('&');
    }
    
    const applicantsData = await this.makeSumsubRequest('GET', endpoint);
    
    // Find user associations for these applicants
    const applicantIds = (applicantsData.items || []).map(item => item.id);
    const userAssociations = await prisma.issuer.findMany({
      where: { sumsub_applicant_id: { in: applicantIds } },
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
    const enrichedItems = (applicantsData.items || []).map(item => ({
      ...item,
      user: applicantUserMap[item.id] || null
    }));
    
    return {
      ...applicantsData,
      items: enrichedItems
    };
  }

  /**
   * Get all users for admin dashboard
   * @returns {Promise<Array>} List of users
   */
  async getAllUsers() {
    const users = await prisma.users.findMany({
      include: {
        userrole: true,
        admin: true,
        issuer: true,
        investor: true
      }
    });
    
    // Format the response data
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      created_at: user.created_at,
      is_active: true,
      roles: user.userrole,
      profile: {
        first_name: user.first_name,
        last_name: user.last_name,
        is_verified: user.is_verified
      },
      verification_status: user.userrole.some(role => role.role === 'ISSUER') && user.issuer 
        ? (user.issuer.verification_status ? 'VERIFIED' : 'PENDING')
        : (user.userrole.some(role => role.role === 'INVESTOR') && user.investor 
          ? user.investor.accreditation_status
          : 'NA')
    }));

    return formattedUsers;
  }

  /**
   * Get KYC verifications with optional filtering by user ID
   * @param {object} options - Query options
   * @returns {Promise<Array>} KYC verification records
   */
  async getKycVerifications(options = {}) {
    const { userId } = options;
    const whereCondition = {};
    
    if (userId) {
      const issuer = await prisma.issuer.findFirst({
        where: { user_id: parseInt(userId) }
      });
      
      if (issuer && issuer.sumsub_applicant_id) {
        whereCondition.applicant_id = issuer.sumsub_applicant_id;
      } else {
        return [];
      }
    }
    
    const verifications = await prisma.kycVerification.findMany({
      where: whereCondition,
      orderBy: { created_at: 'desc' },
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
    
    return verifications;
  }

  /**
   * Get details for a specific KYC verification
   * @param {number} id - Verification ID
   * @returns {Promise<object>} Verification details
   */
  async getKycVerificationDetails(id) {
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
      throw new Error('KYC verification not found');
    }
    
    // Get related data
    const [personalInfo, documents, completeRecord] = await Promise.all([
      prisma.kyc_personal_info.findFirst({
        where: { applicant_id: verification.applicant_id }
      }),
      prisma.KycDocument.findMany({
        where: { applicant_id: verification.applicant_id }
      }),
      prisma.kyc_complete_records.findFirst({
        where: { applicant_id: verification.applicant_id }
      })
    ]);
    
    return {
      ...verification,
      personalInfo: personalInfo || null,
      documents: documents || [],
      completeRecord: completeRecord || null
    };
  }

  /**
   * Get all wallets
   * @returns {Promise<Array>} Formatted wallet records
   */
  async getAllWallets() {
    const wallets = await prisma.wallet.findMany({
      include: {
        users: {
          include: {
            userrole: true
          }
        }
      }
    });
    
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

    return formattedWallets;
  }

  /**
   * Get wallet details by ID
   * @param {string} walletId - Wallet ID
   * @returns {Promise<object>} Wallet details
   */
  async getWalletDetails(walletId) {
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
      throw new Error('Wallet not found');
    }
    
    return {
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
  }

  /**
   * Get wallet balance from Crossmint
   * @param {string} walletId - Wallet ID
   * @returns {Promise<object>} Wallet balance
   */
  async getWalletBalance(walletId) {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId }
    });
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    // Get balance from Crossmint
    const tokens = ["eth", "usdc", "usdt"];
    const chains = ["polygon-mumbai", "base-sepolia"];

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

    return response.data;
  }

  /**
   * Get wallet transactions from Crossmint
   * @param {string} walletId - Wallet ID
   * @returns {Promise<object>} Wallet transactions
   */
  async getWalletTransactions(walletId) {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId }
    });
    
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    const response = await axios.get(`${CROSSMINT_BASE_URL}/v1-alpha2/wallets/${wallet.address}/transactions`, {
      headers: {
        "X-API-KEY": CROSSMINT_API_KEY,
        "Content-Type": "application/json",
      }
    });

    return response.data;
  }

  /**
   * Get applicant data from Sumsub
   * @param {string} applicantId - Sumsub applicant ID
   * @returns {Promise<object>} Applicant data
   */
  async getSumsubApplicant(applicantId) {
    const endpoint = `/resources/applicants/${applicantId}`;
    
    const response = await this.makeSumsubRequest('GET', endpoint);
    
    // Find user association
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
    
    return {
      ...response,
      user: issuer?.users || null
    };
  }

  /**
   * Get applicant document images from Sumsub
   * @param {string} applicantId - Sumsub applicant ID
   * @returns {Promise<object>} Applicant documents
   */
  async getSumsubApplicantDocuments(applicantId) {
    const endpoint = `/resources/applicants/${applicantId}/info/idDocs`;
    
    return await this.makeSumsubRequest('GET', endpoint);
  }

  /**
   * Get personal info for an applicant
   * @param {string} applicantId - Sumsub applicant ID
   * @returns {Promise<object>} Personal information
   */
  async getKycPersonalInfo(applicantId) {
    const personalInfo = await prisma.kyc_personal_info.findFirst({
      where: { applicant_id: applicantId }
    });
    
    if (!personalInfo) {
      throw new Error('Personal information not found');
    }
    
    return personalInfo;
  }

  /**
   * Fix unassociated KYC verifications
   * @returns {Promise<object>} Result of the operation
   */
  async fixKycAssociations() {
    // Find all KYC verifications without user associations
    const unlinkedVerifications = await prisma.kycVerification.findMany({
      where: { userId: null }
    });
    
    let linkedCount = 0;
    let updatedIssuerCount = 0;
    const errors = [];
    
    // Process each unlinked verification
    for (const verification of unlinkedVerifications) {
      try {
        // Find issuer by applicantId
        let issuer = await prisma.issuer.findFirst({
          where: { sumsub_applicant_id: verification.applicantId },
          include: { users: true }
        });
        
        // If no issuer found, try to extract user ID from externalUserId
        if (!issuer && verification.externalUserId) {
          const extractedUserId = this.extractUserId(verification.externalUserId);
          
          if (extractedUserId) {
            const user = await prisma.users.findUnique({
              where: { id: extractedUserId }
            });
            
            if (user) {
              // Find/update user's issuer
              const userIssuer = await prisma.issuer.findFirst({
                where: { users_id: user.id }
              });
              
              if (userIssuer && !userIssuer.sumsub_applicant_id) {
                await prisma.issuer.update({
                  where: { id: userIssuer.id },
                  data: { 
                    sumsub_applicant_id: verification.applicantId,
                    sumsub_external_id: verification.externalUserId
                  }
                });
                updatedIssuerCount++;
              }
              
              // Update the verification with the user ID
              await prisma.kycVerification.update({
                where: { id: verification.id },
                data: { userId: user.id }
              });
              
              linkedCount++;
            }
          }
        } else if (issuer) {
          // If issuer found directly, update the verification
          await prisma.kycVerification.update({
            where: { id: verification.id },
            data: { userId: issuer.users_id }
          });
          
          linkedCount++;
        }
      } catch (error) {
        errors.push({ id: verification.id, error: error.message });
      }
    }
    
    return {
      success: true,
      total: unlinkedVerifications.length,
      linked: linkedCount,
      issuersUpdated: updatedIssuerCount,
      errors: errors
    };
  }

  /**
   * Generate DID for a verified issuer
   * @param {number} issuerId - Issuer ID
   * @returns {Promise<object>} Result of the operation
   */
  /**
   * Generate a DID for an issuer
   * @param {number} issuerId - The ID of the issuer
   * @returns {Promise<Object>} - Result of the operation with DID or error
   */
  async generateDIDForIssuer(issuerId) {
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
        const walletResult = await this.createWalletForIssuer(issuerId, issuer.user_id);
        
        if (!walletResult) {
          throw new Error('Failed to create wallet');
        }

        // Refresh issuer data
        issuer.wallet = await prisma.wallet.findFirst({
          where: { user_id: issuer.user_id }
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
  async createWalletForIssuer(issuerId, userId) {
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
      const apiKey = CROSSMINT_API_KEY;
      if (!apiKey) {
        throw new Error('Missing Crossmint API key');
      }
      
      // Get user email from database
      const user = await prisma.users.findUnique({
        where: { id: parseInt(userId) }
      });

      if (!user || !user.email) {
        throw new Error(`User ${userId} not found or has no email`);
      }
      
      // Create a wallet using Crossmint API
      const response = await axios.post(
        'https://staging.crossmint.com/api/2022-06-09/wallets',
        { 
          type: 'evm-mpc-wallet',
          linkedUser: `email:${user.email}`
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
          type: 'evm-mpc-wallet',
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

  async originalGenerateDIDForIssuer(issuerId) {
    if (!issuerId || isNaN(parseInt(issuerId))) {
      throw new Error('Valid issuer ID is required');
    }
    
    const parsedIssuerId = parseInt(issuerId);
    
    // Check if issuer exists and is verified
    const issuer = await prisma.issuer.findUnique({
      where: { id: parsedIssuerId },
      include: { users: true }
    });
    
    if (!issuer) {
      throw new Error('Issuer not found');
    }
    
    if (!issuer.verification_status) {
      throw new Error('Issuer is not verified. Only verified issuers can have DIDs generated.');
    }
    
    const result = await this.generateDIDForIssuer(parsedIssuerId);
    
    if (result.success) {
      return { 
        success: true, 
        message: 'DID generated successfully', 
        did: result.did,
        issuer: {
          id: issuer.id,
          userEmail: issuer.users.email,
          userName: `${issuer.users.first_name} ${issuer.users.last_name}`,
          companyName: issuer.company_name
        }
      };
    } else {
      throw new Error(result.error || 'Failed to generate DID');
    }
  }

  /**
   * Generate DIDs for all verified issuers without DIDs
   * @returns {Promise<object>} Result of the operation
   */
  async generateAllDIDs() {
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
      return {
        success: true, 
        message: 'No verified issuers without DIDs found. All DIDs are up to date.',
        issuersProcessed: 0,
        successful: 0,
        failed: 0,
        results: []
      };
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
      
      const result = await this.generateDIDForIssuer(issuer.id);
      
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
    
    return {
      success: true,
      message: 'Batch DID generation completed',
      issuersProcessed: verifiedIssuersWithoutDIDs.length,
      successful: successCount,
      failed: failureCount,
      results
    };
  }
}

module.exports = new AdminService(); 