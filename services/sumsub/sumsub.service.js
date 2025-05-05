const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const crypto = require('crypto');
const { generateSumsubApiSignature } = require('../../utils/generateSumsubApiSignature');
const FormData = require('form-data');
const fs = require('fs');

const prisma = new PrismaClient();

// Configuration
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

console.log('Sumsub API Configuration:');
console.log(`- Base URL: ${SUMSUB_BASE_URL}`);
console.log(`- App Token: ${SUMSUB_APP_TOKEN.substring(0, 10)}...`);
console.log(`- Secret Key: ${SUMSUB_SECRET_KEY.substring(0, 5)}...`);
console.log('Make sure these match the values in your Sumsub dashboard');

// Function to create a Sumsub signature for API calls
function createSignature(ts, httpMethod, requestUrl, body = '') {
  let dataToSign = ts + httpMethod + requestUrl;
  
  if (body && Object.keys(body).length > 0) {
    dataToSign += JSON.stringify(body);
  }
  
  return crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(dataToSign)
    .digest('hex');
}

// Helper to build request configs with proper headers
function createRequestConfig(method, url, body = null) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = createSignature(ts, method, url, body);
  
  const config = {
    method: method,
    url: SUMSUB_BASE_URL + url,
    headers: {
      'X-App-Token': SUMSUB_APP_TOKEN,
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': ts
    }
  };
  
  if (body) {
    config.headers['Content-Type'] = 'application/json';
    config.data = body;
  }
  
  return config;
}

/**
 * Sumsub Service - Contains business logic for Sumsub-related operations
 */
class SumsubService {
  /**
   * Make a request to the Sumsub API
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} body - Request body
   * @returns {Promise<object>} API response
   * @private
   */
  async _makeApiRequest(method, endpoint, body = null) {
    try {
      const ts = Math.floor(Date.now() / 1000).toString();
      const payload = body ? JSON.stringify(body) : '';
      const signature = generateSumsubApiSignature(method, endpoint, ts, payload, SUMSUB_SECRET_KEY);
      
      const headers = {
        'Accept': 'application/json',
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': ts
      };
      
      if (body) headers['Content-Type'] = 'application/json';
      
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
   * Create an applicant in Sumsub for KYC verification
   * @param {object} options - Options
   * @param {number} options.userId - User ID
   * @param {string} options.email - User email
   * @param {string} options.firstName - User first name
   * @param {string} options.lastName - User last name
   * @param {string} options.externalId - External ID
   * @param {string} options.level - Verification level
   * @returns {Promise<object>} Created applicant data
   */
  async createApplicant(options) {
    const { userId, email, firstName, lastName, externalId = null, level = 'basic-kyc-level' } = options;
    
    // Generate external user ID if not provided
    const extUserId = externalId || `userId-${userId}`;
    
    // Create applicant in Sumsub
    const applicantData = {
      externalUserId: extUserId,
      email,
      info: {
        firstName,
        lastName
      },
      fixedInfo: {
        email
      },
      requiredIdDocs: {
        docSets: [
          {
            idDocSetType: 'IDENTITY',
            types: ['PASSPORT', 'ID_CARD', 'DRIVERS']
          },
          {
            idDocSetType: 'SELFIE',
            types: ['SELFIE']
          }
        ]
      }
    };
    
    try {
      const createdApplicant = await this._makeApiRequest('POST', '/resources/applicants', applicantData);
      
      // Update user record with applicant ID
      const issuer = await prisma.issuer.findFirst({
        where: { user_id: userId }
      });
      
      if (issuer) {
        await prisma.issuer.update({
          where: { id: issuer.id },
          data: { sumsub_applicant_id: createdApplicant.id }
        });
      } else {
        console.warn(`No issuer found for user ${userId}`);
      }
      
      return {
        success: true,
        applicant: createdApplicant
      };
    } catch (error) {
      throw new Error(`Failed to create applicant: ${error.message}`);
    }
  }

  /**
   * Generate an access token for Sumsub SDK
   * @param {object} options - Options
   * @param {number} options.userId - User ID
   * @param {string} options.externalUserId - External user ID
   * @param {string} options.level - Verification level
   * @returns {Promise<object>} Access token data
   */
  async getAccessToken(options) {
    const { userId, externalUserId, level = 'id-and-liveness' } = options;
    
    try {
      let extUserId = externalUserId;
      
      // If userId is provided but not externalUserId, try to get the applicant ID
      if (userId && !externalUserId) {
        const parsedUserId = parseInt(userId, 10);
        
        if (isNaN(parsedUserId)) {
          console.warn(`Invalid userId format: ${userId}, using as external ID`);
          extUserId = `userId-${userId}`;
        } else {
          const issuer = await prisma.issuer.findFirst({
            where: { user_id: parsedUserId },
            select: { sumsub_applicant_id: true }
          });
          
          if (issuer?.sumsub_applicant_id) {
            extUserId = issuer.sumsub_applicant_id;
          } else {
            extUserId = `userId-${parsedUserId}`;
          }
        }
      }
      
      console.log(`Generating Sumsub token for ${extUserId} with level ${level}`);
      
      // Generate token
      const tokenData = await this._makeApiRequest(
        'POST',
        '/resources/accessTokens',
        {
          externalUserId: extUserId,
          levelName: level
        }
      );
      
      return {
        success: true,
        token: tokenData.token,
        expiry: tokenData.expiresAt
      };
    } catch (error) {
      console.error(`Failed to generate access token: ${error.message}`);
      throw new Error(`Failed to generate access token: ${error.message}`);
    }
  }

  /**
   * Get applicant status from Sumsub
   * @param {string} applicantId - Applicant ID
   * @returns {Promise<object>} Applicant status data
   */
  async getApplicantStatus(applicantId) {
    try {
      const statusData = await this._makeApiRequest('GET', `/resources/applicants/${applicantId}/status`);
      
      return {
        success: true,
        status: statusData
      };
    } catch (error) {
      throw new Error(`Failed to get applicant status: ${error.message}`);
    }
  }

  /**
   * Get user's verification status
   * @param {number} userId - User ID
   * @returns {Promise<object>} User verification status
   */
  async getUserVerificationStatus(userId) {
    try {
      // Get the issuer and applicant ID
      const issuer = await prisma.issuer.findFirst({
        where: { user_id: userId }
      });
      
      if (!issuer || !issuer.sumsub_applicant_id) {
        return {
          success: false,
          message: 'No verification profile found for this user'
        };
      }
      
      // Get the applicant status
      const statusData = await this.getApplicantStatus(issuer.sumsub_applicant_id);
      
      // Get KYC verification records
      const verifications = await prisma.kycVerification.findMany({
        where: { applicant_id: issuer.sumsub_applicant_id },
        orderBy: { created_at: 'desc' }
      });
      
      return {
        success: true,
        applicantId: issuer.sumsub_applicant_id,
        status: statusData.status,
        verifications: verifications || []
      };
    } catch (error) {
      throw new Error(`Failed to get user verification status: ${error.message}`);
    }
  }

  // Generate an access token for Sumsub SDK
  async generateAccessToken(userId, levelName = 'id-and-liveness', ttlInSecs = 600) {
    try {
      // Create an applicant first if needed
      let externalUserId = `user-${userId}`;
      try {
        // Check if this is a new user or if we need to create a new applicant
        console.log(`Checking for existing applicant for user: ${externalUserId}`);
        
        // First attempt to create an applicant to ensure one exists
        const createEndpoint = '/resources/applicants?levelName=' + encodeURIComponent(levelName);
        const createBody = { externalUserId };
        const createConfig = createRequestConfig('POST', createEndpoint, createBody);
        
        try {
          const createResponse = await axios(createConfig);
          console.log(`Created new applicant with ID: ${createResponse.data.id}`);
        } catch (err) {
          console.log('Applicant may already exist:', err.message);
        }
      } catch (applicantError) {
        console.log('Error in applicant creation step:', applicantError.message);
      }
      
      // Now generate the token with externalUserId in URL params
      const tokenUrl = `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}&levelName=${encodeURIComponent(levelName)}&ttlInSecs=${ttlInSecs}`;
      
      console.log(`Generating access token with URL: ${tokenUrl}`);
      const config = createRequestConfig('POST', tokenUrl);
      
      const response = await axios(config);
      
      if (!response.data || !response.data.token) {
        throw new Error('Invalid response from Sumsub API');
      }
      
      console.log('Token generated successfully:', { 
        token: response.data.token.substring(0, 10) + '...',
        expiresAt: response.data.expiresAt 
      });
      
      return {
        success: true,
        token: response.data.token,
        expiresAt: response.data.expiresAt,
        userId: externalUserId
      };
    } catch (error) {
      console.error('Error generating access token:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }
}

module.exports = new SumsubService(); 