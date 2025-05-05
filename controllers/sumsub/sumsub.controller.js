const sumsubService = require('../../services/sumsub/sumsub.service');
const crypto = require('crypto');
const axios = require('axios');

/**
 * Sumsub Controller - Handles Sumsub-related HTTP requests
 */
class SumsubController {
  /**
   * Create an applicant in Sumsub for KYC verification
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async createApplicant(req, res) {
    try {
      const { userId, email, firstName, lastName, externalId, level } = req.body;
      
      if (!userId || !email) {
        return res.status(400).json({ message: 'User ID and email are required' });
      }
      
      const result = await sumsubService.createApplicant({
        userId,
        email,
        firstName,
        lastName,
        externalId,
        level
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error creating Sumsub applicant:', error);
      res.status(500).json({ 
        success: false,
        message: error.message || 'Failed to create applicant' 
      });
    }
  }

  /**
   * Generate an access token for Sumsub SDK
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getAccessToken(req, res) {
    try {
      // Get parameters from query string
      let userId = req.query.userId || req.body.userId;
      
      // If user is authenticated, override with authenticated user ID
      if (req.user && req.user.id) {
        userId = req.user.id;
        console.log(`Using authenticated user ID: ${userId}`);
      } else if (!userId) {
        // For testing purposes only, generate random ID if not provided
        userId = 'anonymous-' + Date.now();
        console.log(`No user ID provided, using generated ID: ${userId}`);
      }
      
      const levelName = req.query.levelName || req.body.levelName || 'id-and-liveness';
      const ttlInSecs = req.query.ttlInSecs || req.body.ttlInSecs || 3600;
      
      console.log(`Token requested for user: ${userId}, level: ${levelName}, ttl: ${ttlInSecs}`);
      
      // Generate access token
      const result = await sumsubService.generateAccessToken(userId, levelName, ttlInSecs);
      
      if (!result.success) {
        console.error('Failed to generate token:', result.error);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate Sumsub access token',
          error: result.error
        });
      }
      
      console.log('Successfully generated Sumsub token');
      return res.status(200).json({
        success: true,
        token: result.token,
        expiresAt: result.expiresAt,
        userId: result.userId
      });
    } catch (error) {
      console.error('Error in getAccessToken controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get applicant status from Sumsub
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getApplicantStatus(req, res) {
    try {
      const { applicantId } = req.params;
      
      if (!applicantId) {
        return res.status(400).json({
          success: false,
          message: 'Applicant ID is required'
        });
      }
      
      // Get applicant status
      const result = await sumsubService.getApplicantStatus(applicantId);
      
      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to get applicant status',
          error: result.error
        });
      }
      
      return res.status(200).json({
        success: true,
        status: result.status
      });
    } catch (error) {
      console.error('Error in getApplicantStatus controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get user's verification status
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getUserVerificationStatus(req, res) {
    try {
      const userId = req.user.id;
      
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
      
      const result = await sumsubService.getUserVerificationStatus(userId);
      res.json(result);
    } catch (error) {
      console.error('Error fetching user verification status:', error);
      res.status(500).json({ 
        success: false,
        message: error.message || 'Failed to fetch verification status' 
      });
    }
  }

  /**
   * Generate a real token from Sumsub API
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getTemporaryToken(req, res) {
    try {
      // Get userId from query or body, or generate a unique ID
      const userId = req.query.userId || req.body.userId || `demo-user-${Date.now()}`;
      
      // Default to id-and-liveness, which is a common level in Sumsub
      const levelName = req.query.levelName || req.body.levelName || 'id-and-liveness';
      
      console.log(`Generating Sumsub token for user: ${userId}, level: ${levelName}`);
      
      // Configuration
      const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
      const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
      
      // Determine base URL based on token prefix
      let SUMSUB_BASE_URL = 'https://api.sumsub.com';
      if (SUMSUB_APP_TOKEN.startsWith('test:')) {
        SUMSUB_BASE_URL = 'https://test-api.sumsub.com';
      }
      
      console.log(`Using Sumsub base URL: ${SUMSUB_BASE_URL}`);
      
      // Helper function to create signatures
      const createSignature = (ts, httpMethod, endpoint, body) => {
        let dataToSign = ts + httpMethod + endpoint;
        if (body) {
          dataToSign += JSON.stringify(body);
        }
        
        return crypto
          .createHmac('sha256', SUMSUB_SECRET_KEY)
          .update(dataToSign)
          .digest('hex');
      };
      
      // STEP 1: Create an applicant (if this is a new flow)
      let applicantId;
      
      try {
        // Step 1.1: Check if we need to create an applicant (if userId is not an existing applicant)
        if (!req.query.applicantId && !req.body.applicantId) {
          // Create a new applicant
          const createTs = Math.floor(Date.now() / 1000).toString();
          const createEndpoint = `/resources/applicants?levelName=${levelName}`;
          const createBody = { externalUserId: userId };
          const createSignature = createSignature(createTs, 'POST', createEndpoint, createBody);
          
          console.log(`Creating new applicant for ${userId}...`);
          const createResponse = await axios({
            method: 'POST',
            url: `${SUMSUB_BASE_URL}${createEndpoint}`,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-App-Token': SUMSUB_APP_TOKEN,
              'X-App-Access-Sig': createSignature,
              'X-App-Access-Ts': createTs
            },
            data: createBody
          });
          
          applicantId = createResponse.data.id;
          console.log(`Created new applicant with ID: ${applicantId}`);
        } else {
          applicantId = req.query.applicantId || req.body.applicantId;
          console.log(`Using existing applicant ID: ${applicantId}`);
        }
      } catch (applicantError) {
        console.error('Error creating applicant:', applicantError.message);
        console.error('Details:', applicantError.response?.data);
        // Continue anyway - we'll try to get a token using just the userId
      }
      
      // STEP 2: Get the access token
      // Approach: Use the query parameter method which is more reliable
      const tokenTs = Math.floor(Date.now() / 1000).toString();
      const tokenEndpoint = `/resources/accessTokens?userId=${userId}`;
      const tokenSignature = createSignature(tokenTs, 'POST', tokenEndpoint);
      
      console.log('Requesting access token...');
      const tokenResponse = await axios({
        method: 'POST',
        url: `${SUMSUB_BASE_URL}${tokenEndpoint}`,
        headers: {
          'Accept': 'application/json',
          'X-App-Token': SUMSUB_APP_TOKEN,
          'X-App-Access-Sig': tokenSignature,
          'X-App-Access-Ts': tokenTs
        }
      });
      
      if (!tokenResponse.data || !tokenResponse.data.token) {
        console.error('Invalid response from Sumsub API:', tokenResponse.data);
        throw new Error('Invalid response from Sumsub API: Token not found');
      }
      
      console.log('Successfully generated Sumsub token');
      
      // Return token response
      res.json({
        success: true,
        token: tokenResponse.data.token,
        expiry: tokenResponse.data.expiresAt,
        userId: userId,
        applicantId: applicantId
      });
    } catch (error) {
      console.error('Error generating Sumsub token:', error.message);
      
      // Get detailed error information
      const responseData = error.response?.data;
      const statusCode = error.response?.status;
      
      console.error('Status code:', statusCode);
      console.error('Response data:', responseData);
      
      // Return error response
      res.status(500).json({
        success: false,
        message: 'Failed to generate Sumsub token',
        error: error.message,
        statusCode,
        details: responseData
      });
    }
  }
}

module.exports = new SumsubController(); 