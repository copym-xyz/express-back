const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Configuration from environment variables
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

/**
 * Issuer Service - Contains business logic for issuer-related operations
 */
class IssuerService {
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
   * Get profile information for the current issuer
   * @param {number} userId - User ID
   * @returns {Promise<object>} Issuer profile data
   */
  async getProfile(userId) {
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            created_at: true,
            is_verified: true,
            wallet: true
          }
        }
      }
    });
    
    if (!issuer) {
      throw new Error('Issuer profile not found');
    }
    
    // Format the issuer profile data
    return {
      id: issuer.id,
      userId: issuer.user_id,
      email: issuer.users.email,
      firstName: issuer.users.first_name,
      lastName: issuer.users.last_name,
      companyName: issuer.company_name,
      website: issuer.website,
      taxId: issuer.tax_id,
      jurisdiction: issuer.jurisdiction,
      did: issuer.did,
      verificationStatus: issuer.verification_status,
      created: issuer.users.created_at,
      wallet: issuer.users.wallet ? {
        id: issuer.users.wallet.id,
        address: issuer.users.wallet.address,
        type: issuer.users.wallet.type,
        chain: issuer.users.wallet.chain,
        isCustodial: issuer.users.wallet.is_custodial
      } : null
    };
  }

  /**
   * Update the issuer's profile
   * @param {number} userId - User ID
   * @param {object} profileData - Updated profile data
   * @returns {Promise<object>} Updated issuer profile
   */
  async updateProfile(userId, profileData) {
    const { firstName, lastName, companyName, website, taxId, jurisdiction, ...otherFields } = profileData;
    
    // Find the issuer
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer) {
      throw new Error('Issuer profile not found');
    }
    
    // Update issuer record
    await prisma.issuer.update({
      where: { id: issuer.id },
      data: {
        company_name: companyName,
        website,
        tax_id: taxId,
        jurisdiction
      }
    });
    
    // Update user record
    await prisma.users.update({
      where: { id: userId },
      data: {
        first_name: firstName,
        last_name: lastName
      }
    });
    
    // Return updated profile
    return this.getProfile(userId);
  }

  /**
   * Get KYC verification status for the issuer
   * @param {number} userId - User ID
   * @returns {Promise<object>} KYC verification status
   */
  async getKycStatus(userId) {
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer) {
      throw new Error('Issuer profile not found');
    }
    
    // Check if the issuer already has a Sumsub applicantId
    if (!issuer.sumsub_applicant_id) {
      return {
        status: 'NOT_STARTED',
        message: 'KYC verification not started yet.'
      };
    }
    
    try {
      // Fetch status from Sumsub
      const endpoint = `/resources/applicants/${issuer.sumsub_applicant_id}`;
      const applicantData = await this.makeSumsubRequest('GET', endpoint);
      
      // Get most recent KYC verification record if any
      const kycVerification = await prisma.kycVerification.findFirst({
        where: { applicantId: issuer.sumsub_applicant_id },
        orderBy: { created_at: 'desc' }
      });
      
      return {
        status: applicantData.status || 'UNKNOWN',
        message: applicantData.status === 'approved' 
          ? 'Your KYC verification was successful.'
          : applicantData.status === 'pending' 
            ? 'Your KYC verification is being processed.'
            : 'KYC verification status unknown.',
        reviewStatus: applicantData.reviewStatus,
        rejectLabels: applicantData.rejectLabels || [],
        rejectDescription: applicantData.rejectDescription,
        applicantId: issuer.sumsub_applicant_id,
        externalUserId: issuer.sumsub_external_id,
        verificationRecord: kycVerification
      };
    } catch (error) {
      console.error('Error fetching KYC status from Sumsub:', error);
      return {
        status: 'ERROR',
        message: 'Error fetching KYC verification status.',
        error: error.message
      };
    }
  }

  /**
   * Generate Sumsub KYC verification URL
   * @param {number} userId - User ID
   * @returns {Promise<object>} Verification URL
   */
  async getKycVerificationUrl(userId) {
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId },
      include: {
        users: true
      }
    });
    
    if (!issuer) {
      throw new Error('Issuer profile not found');
    }
    
    // We need a user email to create an applicant
    if (!issuer.users.email) {
      throw new Error('User email is required for KYC verification');
    }
    
    let applicantId = issuer.sumsub_applicant_id;
    let externalUserId = issuer.sumsub_external_id;
    
    // If the issuer doesn't have a Sumsub applicantId yet, create one
    if (!applicantId) {
      // Create a unique external ID to identify this user
      externalUserId = `copym_issuer_${userId}_${Date.now()}`;
      
      // Create the applicant in Sumsub
      const endpoint = '/resources/applicants';
      const body = {
        externalUserId: externalUserId,
        email: issuer.users.email,
        phone: issuer.phone || '',
        fixedInfo: {
          firstName: issuer.users.first_name,
          lastName: issuer.users.last_name,
          country: issuer.jurisdiction || 'US',
          companyName: issuer.company_name
        },
        requiredIdDocs: {
          docSets: [
            {
              idDocSetType: 'COMPANY',
              types: ['INCORPORATION', 'ARTICLES_OF_ASSOCIATION', 'COMPANY_REGISTRY', 'STATE_REGISTRATION']
            }
          ]
        }
      };
      
      try {
        const response = await this.makeSumsubRequest('POST', endpoint, body);
        applicantId = response.id;
        
        // Update the issuer record with the Sumsub applicantId
        await prisma.issuer.update({
          where: { id: issuer.id },
          data: {
            sumsub_applicant_id: applicantId,
            sumsub_external_id: externalUserId
          }
        });
      } catch (error) {
        console.error('Error creating Sumsub applicant:', error);
        throw new Error('Failed to create Sumsub applicant');
      }
    }
    
    // Generate access token for the applicant
    try {
      const endpoint = `/resources/accessTokens?userId=${applicantId}`;
      const response = await this.makeSumsubRequest('POST', endpoint);
      
      return {
        accessToken: response.token,
        applicantId: applicantId,
        externalUserId: externalUserId
      };
    } catch (error) {
      console.error('Error generating Sumsub access token:', error);
      throw new Error('Failed to generate Sumsub access token');
    }
  }

  /**
   * Get offerings created by the issuer
   * @param {number} userId - User ID
   * @returns {Promise<Array>} List of offerings
   */
  async getOfferings(userId) {
    // Find the issuer
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer) {
      throw new Error('Issuer profile not found');
    }
    
    // Get all offerings by this issuer
    const offerings = await prisma.offering.findMany({
      where: { issuer_id: issuer.id },
      include: {
        asset: true,
        offeringDocument: true
      },
      orderBy: { created_at: 'desc' }
    });
    
    // Format the offerings data
    return offerings.map(offering => ({
      id: offering.id,
      name: offering.name,
      description: offering.description,
      symbol: offering.symbol,
      minimumInvestment: offering.minimum_investment,
      targetRaise: offering.target_raise,
      price: offering.price,
      startDate: offering.start_date,
      endDate: offering.end_date,
      isActive: offering.is_active,
      created: offering.created_at,
      asset: offering.asset ? {
        id: offering.asset.id,
        type: offering.asset.type,
        contractAddress: offering.asset.contract_address,
        tokenId: offering.asset.token_id,
        chain: offering.asset.chain
      } : null,
      documents: offering.offeringDocument ? [
        {
          id: offering.offeringDocument.id,
          name: offering.offeringDocument.name,
          type: offering.offeringDocument.type,
          url: offering.offeringDocument.url
        }
      ] : []
    }));
  }

  /**
   * Create a new offering
   * @param {number} userId - User ID
   * @param {object} offeringData - Offering data
   * @returns {Promise<object>} Created offering
   */
  async createOffering(userId, offeringData) {
    const {
      name,
      description,
      symbol,
      minimumInvestment,
      targetRaise,
      price,
      startDate,
      endDate,
      terms,
      assetType,
      contractAddress,
      tokenId,
      chain
    } = offeringData;
    
    // Find the issuer
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer) {
      throw new Error('Issuer profile not found');
    }
    
    // Make sure issuer is verified
    if (!issuer.verification_status) {
      throw new Error('Issuer must be verified to create offerings');
    }
    
    // Create the offering
    const offering = await prisma.offering.create({
      data: {
        name,
        description,
        symbol,
        minimum_investment: parseFloat(minimumInvestment),
        target_raise: parseFloat(targetRaise),
        price: parseFloat(price),
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        terms,
        is_active: true,
        issuer_id: issuer.id
      }
    });
    
    // Create the asset if data provided
    let asset = null;
    if (assetType) {
      asset = await prisma.asset.create({
        data: {
          type: assetType,
          contract_address: contractAddress,
          token_id: tokenId,
          chain,
          offering_id: offering.id
        }
      });
    }
    
    // Return the created offering
    return {
      id: offering.id,
      name: offering.name,
      description: offering.description,
      symbol: offering.symbol,
      minimumInvestment: offering.minimum_investment,
      targetRaise: offering.target_raise,
      price: offering.price,
      startDate: offering.start_date,
      endDate: offering.end_date,
      isActive: offering.is_active,
      created: offering.created_at,
      asset: asset ? {
        id: asset.id,
        type: asset.type,
        contractAddress: asset.contract_address,
        tokenId: asset.token_id,
        chain: asset.chain
      } : null
    };
  }

  /**
   * Get details for a specific offering
   * @param {number} userId - User ID
   * @param {number} offeringId - Offering ID
   * @returns {Promise<object>} Offering details
   */
  async getOfferingDetails(userId, offeringId) {
    // Find the issuer
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer) {
      throw new Error('Issuer profile not found');
    }
    
    // Get the offering
    const offering = await prisma.offering.findFirst({
      where: {
        id: parseInt(offeringId),
        issuer_id: issuer.id
      },
      include: {
        asset: true,
        offeringDocument: true,
        investment: {
          include: {
            investor: {
              include: {
                users: {
                  select: {
                    email: true,
                    first_name: true,
                    last_name: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (!offering) {
      throw new Error('Offering not found');
    }
    
    // Calculate total investment amount
    const totalInvested = offering.investment.reduce((total, inv) => total + inv.amount, 0);
    
    // Format the offering data
    return {
      id: offering.id,
      name: offering.name,
      description: offering.description,
      symbol: offering.symbol,
      minimumInvestment: offering.minimum_investment,
      targetRaise: offering.target_raise,
      price: offering.price,
      startDate: offering.start_date,
      endDate: offering.end_date,
      isActive: offering.is_active,
      terms: offering.terms,
      created: offering.created_at,
      asset: offering.asset ? {
        id: offering.asset.id,
        type: offering.asset.type,
        contractAddress: offering.asset.contract_address,
        tokenId: offering.asset.token_id,
        chain: offering.asset.chain
      } : null,
      documents: offering.offeringDocument ? [
        {
          id: offering.offeringDocument.id,
          name: offering.offeringDocument.name,
          type: offering.offeringDocument.type,
          url: offering.offeringDocument.url
        }
      ] : [],
      investments: offering.investment.map(inv => ({
        id: inv.id,
        amount: inv.amount,
        status: inv.status,
        createdAt: inv.created_at,
        investor: {
          id: inv.investor.id,
          email: inv.investor.users.email,
          name: `${inv.investor.users.first_name} ${inv.investor.users.last_name}`
        }
      })),
      stats: {
        totalInvested,
        percentRaised: (totalInvested / offering.target_raise) * 100,
        investorCount: offering.investment.length
      }
    };
  }

  /**
   * Update an offering
   * @param {number} userId - User ID
   * @param {number} offeringId - Offering ID
   * @param {object} updateData - Updated offering data
   * @returns {Promise<object>} Updated offering
   */
  async updateOffering(userId, offeringId, updateData) {
    const {
      name,
      description,
      isActive,
      minimumInvestment,
      targetRaise,
      price,
      startDate,
      endDate,
      terms
    } = updateData;
    
    // Find the issuer
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer) {
      throw new Error('Issuer profile not found');
    }
    
    // Check if offering exists and belongs to this issuer
    const offering = await prisma.offering.findFirst({
      where: {
        id: parseInt(offeringId),
        issuer_id: issuer.id
      }
    });
    
    if (!offering) {
      throw new Error('Offering not found');
    }
    
    // Update the offering
    const updatedOffering = await prisma.offering.update({
      where: { id: parseInt(offeringId) },
      data: {
        name,
        description,
        is_active: isActive,
        minimum_investment: minimumInvestment ? parseFloat(minimumInvestment) : undefined,
        target_raise: targetRaise ? parseFloat(targetRaise) : undefined,
        price: price ? parseFloat(price) : undefined,
        start_date: startDate ? new Date(startDate) : undefined,
        end_date: endDate ? new Date(endDate) : undefined,
        terms
      },
      include: {
        asset: true,
        offeringDocument: true
      }
    });
    
    // Format the updated offering data
    return {
      id: updatedOffering.id,
      name: updatedOffering.name,
      description: updatedOffering.description,
      symbol: updatedOffering.symbol,
      minimumInvestment: updatedOffering.minimum_investment,
      targetRaise: updatedOffering.target_raise,
      price: updatedOffering.price,
      startDate: updatedOffering.start_date,
      endDate: updatedOffering.end_date,
      isActive: updatedOffering.is_active,
      terms: updatedOffering.terms,
      created: updatedOffering.created_at,
      asset: updatedOffering.asset ? {
        id: updatedOffering.asset.id,
        type: updatedOffering.asset.type,
        contractAddress: updatedOffering.asset.contract_address,
        tokenId: updatedOffering.asset.token_id,
        chain: updatedOffering.asset.chain
      } : null,
      documents: updatedOffering.offeringDocument ? [
        {
          id: updatedOffering.offeringDocument.id,
          name: updatedOffering.offeringDocument.name,
          type: updatedOffering.offeringDocument.type,
          url: updatedOffering.offeringDocument.url
        }
      ] : []
    };
  }

  /**
   * Upload a document for an offering
   * @param {number} userId - User ID
   * @param {number} offeringId - Offering ID
   * @param {object} documentData - Document data
   * @returns {Promise<object>} Uploaded document
   */
  async uploadDocument(userId, offeringId, documentData) {
    const { name, type, url } = documentData;
    
    // Find the issuer
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer) {
      throw new Error('Issuer profile not found');
    }
    
    // Check if offering exists and belongs to this issuer
    const offering = await prisma.offering.findFirst({
      where: {
        id: parseInt(offeringId),
        issuer_id: issuer.id
      }
    });
    
    if (!offering) {
      throw new Error('Offering not found');
    }
    
    // Check if document already exists
    const existingDocument = await prisma.offeringDocument.findFirst({
      where: { offering_id: parseInt(offeringId) }
    });
    
    let document;
    
    if (existingDocument) {
      // Update existing document
      document = await prisma.offeringDocument.update({
        where: { id: existingDocument.id },
        data: { name, type, url }
      });
    } else {
      // Create new document
      document = await prisma.offeringDocument.create({
        data: {
          name,
          type,
          url,
          offering_id: parseInt(offeringId)
        }
      });
    }
    
    return {
      id: document.id,
      name: document.name,
      type: document.type,
      url: document.url
    };
  }
}

module.exports = new IssuerService(); 