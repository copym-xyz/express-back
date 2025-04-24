const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const extractUserId = require('../utils/extractUserId');
const { findUserBySumsubIdentifiers, verifyWebhookSignature, KYC_DOCS_BASE_DIR, createDateBasedFolderStructure, fetchApplicantData, extractPersonalInfo } = require('../utils/sumsubUtils');
const { storeApplicantDocuments } = require('../services/sumsubService');

// Import authentication middleware or create a fallback
let isAuthenticated;
try {
  const authMiddleware = require('../middleware/auth');
  isAuthenticated = authMiddleware.isAuthenticated;
} catch (error) {
  console.warn('Authentication middleware not available, using fallback middleware');
  // Fallback middleware that just passes through
  isAuthenticated = (req, res, next) => next();
}

// Sumsub credentials - replace with your actual credentials
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com';

// Webhook secret key - used for signature verification
const WEBHOOK_SECRET_KEY = process.env.SUMSUB_WEBHOOK_SECRET || 'Kjp1bbs4_rDiyQYl4feXceLqbkn';

// Define an array of known testing applicant IDs
const knownApplicants = [
  '67fbddcc012a2856878eda8e', // For testing purposes
];

// Generate Sumsub signature
function createSignature(method, endpoint, ts, payload = '') {
  const data = ts + method + endpoint + payload;
  console.log('Data for signature:', data);
  return crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(data)
    .digest('hex');
}

// Utility function to make authenticated Sumsub API requests with fresh timestamp
async function makeSumsubRequest(method, endpoint, body = null) {
  // Generate fresh timestamp for the request
  const ts = Math.floor(Date.now() / 1000).toString();
  
  // Prepare request payload for signature if needed
  let payload = '';
  if (body && Object.keys(body).length > 0) {
    payload = JSON.stringify(body);
  }
  
  // Calculate signature with the fresh timestamp
  const signature = createSignature(method, endpoint, ts, payload);
  
  // Set up request headers
  const headers = {
    'Accept': 'application/json',
    'X-App-Token': SUMSUB_APP_TOKEN,
    'X-App-Access-Sig': signature,
    'X-App-Access-Ts': ts
  };
  
  // Add Content-Type header for requests with body
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Make the API request
  console.log(`Making Sumsub API request: ${method} ${SUMSUB_BASE_URL}${endpoint}`);
  
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

// Token endpoint
router.post('/token', async (req, res) => {
  try {
    console.log('Token request received:', req.body);
    
    // Get numeric userId and convert to string if present, or generate a fallback
    let userId = req.body.userId;
    let numericUserId = null;
    
    if (userId) {
      // Extract just the numeric part if userId contains non-numeric characters
      const numericMatch = String(userId).match(/(\d+)/);
      numericUserId = numericMatch ? numericMatch[1] : null;
    }
    
    // Form a consistent externalUserId format
    const externalUserId = numericUserId ? `user-${numericUserId}` : `temp-${Date.now()}`;
    
    const levelName = req.body.levelName || 'id-and-liveness';
    
    // Find the user in the database if we have a numeric ID
    let dbUser = null;
    if (numericUserId) {
      // It's a numeric ID, let's find the user
      dbUser = await prisma.users.findUnique({
        where: { id: parseInt(numericUserId, 10) },
        include: { issuer: true }
      });
      
      if (!dbUser) {
        console.warn(`User with ID ${numericUserId} not found in database.`);
      } else {
        console.log(`Found user ${dbUser.email} (ID: ${dbUser.id}) for Sumsub verification`);
      }
    }
    
    // Create query string in URL format for the access token request
    const queryParams = `userId=${encodeURIComponent(externalUserId)}&levelName=${encodeURIComponent(levelName)}&ttlInSecs=600`;
    const endpoint = `/resources/accessTokens?${queryParams}`;
    
    // Make Sumsub API request with fresh timestamp and signature
    const tokenData = await makeSumsubRequest('POST', endpoint);
    
    console.log('Generated token successfully:', tokenData);
    
    // If we have a valid applicantId in the response and a user in the database,
    // update the user's Sumsub applicantId
    if (tokenData.applicantId && dbUser && dbUser.issuer) {
      try {
        // Get the applicant details from Sumsub to verify identity
        const applicantEndpoint = `/resources/applicants/${tokenData.applicantId}`;
        const applicantData = await makeSumsubRequest('GET', applicantEndpoint);
        
        console.log('Applicant details fetched successfully');
        
        // Update the issuer with the Sumsub applicantId and externalUserId
        await prisma.issuer.update({
          where: { id: dbUser.issuer.id },
          data: {
            sumsub_applicant_id: tokenData.applicantId,
            sumsub_external_id: externalUserId,
            sumsub_correlation_id: applicantData.correlation || null,
            sumsub_inspection_id: applicantData.inspectionId || null
          }
        });
        
        console.log(`Updated issuer ${dbUser.issuer.id} with Sumsub applicant ID: ${tokenData.applicantId}`);
      } catch (error) {
        console.error('Error updating issuer with Sumsub applicantId:', error.message);
        // Continue processing - we don't want to fail the token generation just because we couldn't update the user
      }
    }
    
    res.json({ 
      token: tokenData.token,
      externalUserId,
      levelName,
      expiresAt: Date.now() + (600 * 1000) // 10 minutes in milliseconds
    });
  } catch (error) {
    console.error('Error generating token:', error.message);
    
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
    }
    
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error.response?.data || error.message 
    });
  }
});

// Add webhook endpoint for Sumsub
router.post('/webhook', express.json({ verify: (req, res, buf) => {
  // Store the raw body buffer for signature verification
  req.rawBody = buf.toString();
}}), async (req, res) => {
  try {
    // Log the webhook payload
    console.log('Received Sumsub webhook:', JSON.stringify(req.body, null, 2));
    
    // Extract key information
    const { 
      applicantId, 
      externalUserId, 
      inspectionId, 
      correlationId,
      type, 
      reviewStatus, 
      reviewResult 
    } = req.body;
    
    if (!applicantId || !type) {
      console.warn('Missing required fields in webhook');
      return res.status(200).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }
    
    // Clean the applicantId (remove "applicant_" prefix if present)
    const cleanApplicantId = applicantId.replace('applicant_', '');
    console.log(`Processing webhook for applicant ID: ${cleanApplicantId}`);
    
    // Verify signature
    const signature = req.headers['x-payload-digest'] || req.headers['x-signature'];
    const digestAlg = req.headers['x-payload-digest-alg'] || 'HMAC_SHA256_HEX';
    
    const isValid = verifyWebhookSignature(
      req.rawBody,
      signature,
      WEBHOOK_SECRET_KEY,
      digestAlg
    );
    
    // Log signature verification result
    console.log(`Webhook signature verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);
    
    // Reject invalid signatures (except for test applicants)
    if (!isValid && !knownApplicants.includes(cleanApplicantId)) {
      console.warn('Invalid webhook signature received');
      
      // Store the invalid webhook for audit purposes
      try {
        await prisma.kycVerification.create({
          data: {
            applicantId: cleanApplicantId,
            externalUserId: externalUserId || '',
            type,
            reviewStatus: reviewStatus || 'unknown',
            rawData: JSON.stringify(req.body),
            signatureValid: false,
            webhookType: type,
            eventTimestamp: new Date(),
            processingStatus: 'rejected',
            errorMessage: 'Invalid signature'
          }
        });
      } catch (storeError) {
        console.error('Error storing invalid webhook:', storeError.message);
      }
      
      return res.status(403).json({
        success: false,
        message: 'Invalid signature'
      });
    }
    
    // Special handling for known test applicants
    if (knownApplicants.includes(cleanApplicantId)) {
      console.log('TESTING APPLICANT WEBHOOK DATA:', JSON.stringify({
        applicantId: cleanApplicantId,
        externalUserId,
        type,
        reviewStatus
      }, null, 2));
      
      // Link test applicant to an unlinked issuer
      if (cleanApplicantId === '67fbddcc012a2856878eda8e') {
        try {
          const unlinkedIssuer = await prisma.issuer.findFirst({
            where: { 
              sumsub_applicant_id: null,
              is_active: true
            },
          });
          
          if (unlinkedIssuer) {
            console.log(`Linking test applicant ID to issuer ${unlinkedIssuer.id}`);
            await prisma.issuer.update({
              where: { id: unlinkedIssuer.id },
              data: { 
                sumsub_applicant_id: cleanApplicantId,
                sumsub_external_id: externalUserId || null
              }
            });
            console.log(`Successfully linked test applicant ID to issuer ${unlinkedIssuer.id}`);
          }
        } catch (error) {
          console.error('Error linking test applicant ID to issuer:', error);
        }
      }
    }
    
    // Find the associated user
    let user = null;
    try {
      user = await findUserBySumsubIdentifiers(cleanApplicantId, externalUserId);
    } catch (userLookupError) {
      console.error('Error looking up user:', userLookupError.message);
      // Continue processing without user association
    }
    
    // Store webhook data
    let verification = null;
    try {
      const webhookData = {
        applicantId: cleanApplicantId,
        externalUserId: externalUserId || '',
        inspectionId: inspectionId || '',
        correlationId: correlationId || '',
        type,
        reviewStatus: reviewStatus || 'unknown',
        reviewResult: reviewResult?.reviewAnswer || null,
        rawData: JSON.stringify(req.body),
        userId: user?.id || null,
        signatureValid: isValid,
        webhookType: type,
        eventTimestamp: new Date(),
        processingStatus: 'received'
      };
      
      verification = await prisma.kycVerification.create({
        data: webhookData
      });
      
      console.log(`Stored verification event ${verification.id} for applicant ${cleanApplicantId}`);
    } catch (dbError) {
      console.error('Error storing webhook data:', dbError.message);
      return res.status(200).json({
        success: false,
        message: 'Error storing webhook data',
        error: dbError.message
      });
    }
    
    // For certain event types, store documents automatically but don't block response
    if (['applicantReviewed', 'idDocStatusChanged', 'applicantCreated'].includes(type)) {
      // Use Promise to handle document storage in the background
      const documentPromise = storeApplicantDocuments(cleanApplicantId, user?.id)
        .then(result => {
          console.log(`Stored ${result.count} documents for applicant ${cleanApplicantId}`);
          
          // Update verification record
          return prisma.kycVerification.update({
            where: { id: verification.id },
            data: { 
              processingStatus: 'processed'
            }
          });
        })
        .catch(err => {
          console.error(`Error storing documents: ${err.message}`);
          
          // Update verification with error
          return prisma.kycVerification.update({
            where: { id: verification.id },
            data: { 
              processingStatus: 'error',
              errorMessage: err.message
            }
          });
        });
        
      // Don't await this promise - let it run in the background
    } else if (type === 'applicantPersonalInfoChanged') {
      // Handle personal info changes
      if (user) {
        // Use Promise to handle personal info storage in the background
        const infoPromise = storeApplicantInfo(cleanApplicantId)
          .then(result => {
            if (result.success) {
              console.log(`Personal information updated for user ${user.id} from applicantPersonalInfoChanged webhook`);
              
              // Update verification record
              return prisma.kycVerification.update({
                where: { id: verification.id },
                data: { 
                  processingStatus: 'processed'
                }
              });
            } else {
              throw new Error(result.error || 'Unknown error storing personal information');
            }
          })
          .catch(err => {
            console.error(`Error storing personal information: ${err.message}`);
            
            // Update verification with error
            return prisma.kycVerification.update({
              where: { id: verification.id },
              data: { 
                processingStatus: 'error',
                errorMessage: err.message
              }
            });
          });
          
        // Don't await this promise - let it run in the background
      } else {
        console.warn(`No user found for applicant ${cleanApplicantId} - cannot update personal information`);
        
        // Mark as processed with a warning
        try {
          await prisma.kycVerification.update({
            where: { id: verification.id },
            data: { 
              processingStatus: 'processed',
              errorMessage: 'No user found to update personal information'
            }
          });
        } catch (updateError) {
          console.error(`Error updating verification status: ${updateError.message}`);
        }
      }
    } else {
      // Mark as processed for non-document events
      try {
        await prisma.kycVerification.update({
          where: { id: verification.id },
          data: { processingStatus: 'processed' }
        });
      } catch (updateError) {
        console.error(`Error updating verification status: ${updateError.message}`);
      }
    }
    
    // If we found a user, update verification status
    if (user && type === 'applicantReviewed') {
      try {
        if (reviewResult?.reviewAnswer === 'GREEN') {
          // Update user and issuer records
          await prisma.user.update({
            where: { id: user.id },
            data: { email_verified: true }
          });
          
          // Try to update issuer if exists
          const issuer = await prisma.issuer.findFirst({
            where: { user_id: user.id }
          });
          
          if (issuer) {
            await prisma.issuer.update({
              where: { id: issuer.id },
              data: {
                verification_status: true,
                verification_date: new Date(),
                sumsub_applicant_id: cleanApplicantId
              }
            });
          }
          
          console.log(`User ${user.id} verified successfully`);
          
          // Extract and store personal information for verified users
          const infoResult = await storeApplicantInfo(cleanApplicantId);
          if (infoResult.success) {
            console.log(`Personal information stored for user ${user.id}`);
          } else {
            console.error(`Failed to store personal information: ${infoResult.error}`);
          }
        } else if (reviewResult?.reviewAnswer === 'RED') {
          // Handle rejection if needed
          const issuer = await prisma.issuer.findFirst({
            where: { user_id: user.id }
          });
          
          if (issuer) {
            await prisma.issuer.update({
              where: { id: issuer.id },
              data: {
                verification_status: false,
                verification_date: new Date(),
                sumsub_applicant_id: cleanApplicantId
              }
            });
          }
          
          console.log(`User ${user.id} verification rejected`);
        }
      } catch (updateError) {
        console.error(`Error updating user verification: ${updateError.message}`);
      }
    }
    
    // Always respond with 200 status code
    return res.status(200).json({
      success: true,
      message: user ? 'Webhook processed successfully' : 'Webhook received but no matching user found',
      webhookId: verification?.id
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Always return 200 for webhooks
    return res.status(200).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message
    });
  }
});

// Get applicant verification status
router.get('/verification-status/:applicantId', async (req, res) => {
  try {
    const { applicantId } = req.params;
    if (!applicantId) {
      return res.status(400).json({ success: false, message: 'Applicant ID is required' });
    }

    console.log(`Fetching verification status for applicant: ${applicantId}`);
    
    // Create endpoint for status request
    const statusEndpoint = `/resources/applicants/${applicantId}/status`;
    
    // Make Sumsub API request with fresh timestamp and signature
    const statusData = await makeSumsubRequest('GET', statusEndpoint);
    console.log('Applicant status retrieved');
    
    // Get applicant information as well for more details
    const applicantEndpoint = `/resources/applicants/${applicantId}`;
    const applicantData = await makeSumsubRequest('GET', applicantEndpoint);
    
    // Find the issuer record for this applicantId
    const issuer = await prisma.issuer.findFirst({
      where: { sumsub_applicant_id: applicantId },
      include: { user: true }
    });
    
    // Return combined data about the verification status
    res.json({
      success: true,
      status: statusData,
      applicantInfo: applicantData,
      issuer: issuer ? {
        id: issuer.id,
        userId: issuer.user_id,
        email: issuer.user?.email,
        verification_status: issuer.verification_status,
        verification_date: issuer.verification_date
      } : null
    });
  } catch (error) {
    console.error('Error fetching applicant status:', error.message);
    
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch applicant status',
      details: error.response?.data || error.message 
    });
  }
});

// Get all inspections/verifications for an applicant
router.get('/inspections/:applicantId', async (req, res) => {
  try {
    const { applicantId } = req.params;
    if (!applicantId) {
      return res.status(400).json({ success: false, message: 'Applicant ID is required' });
    }

    console.log(`Fetching inspections for applicant: ${applicantId}`);
    
    // Create endpoint for inspections request
    const endpoint = `/resources/inspections?applicantId=${encodeURIComponent(applicantId)}`;
    
    // Make Sumsub API request with fresh timestamp and signature
    const inspectionsData = await makeSumsubRequest('GET', endpoint);
    
    console.log(`Retrieved ${inspectionsData.items?.length || 0} inspections for applicant ${applicantId}`);
    
    res.json({
      success: true,
      inspections: inspectionsData.items || []
    });
  } catch (error) {
    console.error('Error fetching applicant inspections:', error.message);
    
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch applicant inspections',
      details: error.response?.data || error.message 
    });
  }
});

/**
 * API endpoint to get all documents for an applicant
 */
router.get('/applicant/:applicantId/documents', async (req, res) => {
  try {
    const { applicantId } = req.params;
    
    // Get documents from database
    const documents = await prisma.kycDocument.findMany({
      where: { applicantId }
    });
    
    // Add URLs
    const documentsWithUrls = documents.map(doc => ({
      ...doc,
      url: `/api/sumsub/documents/${doc.yearFolder}/${doc.monthFolder}/${doc.dayFolder}/${applicantId}/${doc.documentType}/${doc.fileName}`
    }));
    
    res.json({
      success: true,
      count: documents.length,
      documents: documentsWithUrls
    });
  } catch (error) {
    console.error('Error retrieving documents:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error retrieving documents',
      error: error.message
    });
  }
});

/**
 * Serve a document file
 */
router.get('/documents/:year/:month/:day/:applicantId/:documentType/:fileName', async (req, res) => {
  try {
    const { year, month, day, applicantId, documentType, fileName } = req.params;
    
    // Build file path with proper path joining for cross-platform compatibility
    const filePath = path.join(
      KYC_DOCS_BASE_DIR,
      year, month, day,
      applicantId,
      documentType,
      fileName
    );
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      console.error(`Document not found at path: ${filePath}`, err);
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    // Get document info
    const document = await prisma.kycDocument.findFirst({
      where: {
        applicantId,
        fileName,
        yearFolder: year,
        monthFolder: month,
        dayFolder: day
      }
    });
    
    // Set content type
    if (document?.mimeType) {
      res.setHeader('Content-Type', document.mimeType);
    } else {
      // Default based on extension
      const ext = path.extname(fileName).toLowerCase();
      if (ext === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
      } else if (ext === '.png') {
        res.setHeader('Content-Type', 'image/png');
      } else {
        res.setHeader('Content-Type', 'image/jpeg');
      }
    }
    
    // Send the file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving document:', error);
    res.status(500).json({
      success: false,
      message: 'Error serving document',
      error: error.message
    });
  }
});

/**
 * Manually trigger document storage for an applicant
 */
router.post('/applicant/:applicantId/store-documents', async (req, res) => {
  try {
    const { applicantId } = req.params;
    
    // Find user if possible
    let userId = null;
    const user = await findUserBySumsubIdentifiers(applicantId, null);
    if (user) {
      userId = user.id;
    }
    
    // Store documents
    const result = await storeApplicantDocuments(applicantId, userId);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Successfully stored ${result.count} documents`,
        applicantId,
        documents: result.documents.map(doc => ({
          id: doc.id,
          documentType: doc.documentType,
          documentSide: doc.documentSide,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          url: `/api/sumsub/documents/${doc.yearFolder}/${doc.monthFolder}/${doc.dayFolder}/${applicantId}/${doc.documentType}/${doc.fileName}`
        }))
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to store documents: ${result.error}`,
        applicantId
      });
    }
  } catch (error) {
    console.error('Error triggering document storage:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering document storage',
      error: error.message
    });
  }
});

/**
 * Store applicant information from Sumsub
 * @param {string} applicantId - The Sumsub applicant ID
 * @returns {Promise<Object>} - Result of the operation
 */
const storeApplicantInfo = async (applicantId) => {
  try {
    // Validate input
    if (!applicantId) {
      console.error('Missing applicantId in storeApplicantInfo');
      return { success: false, error: 'Missing applicant ID' };
    }

    console.log(`Processing applicant info for ID: ${applicantId}`);
    
    // Fetch applicant data from Sumsub
    const applicantData = await fetchApplicantData(applicantId);
    if (!applicantData) {
      return { success: false, error: 'Failed to fetch applicant data from Sumsub' };
    }
    
    // Find user associated with this applicant ID
    const user = await prisma.user.findFirst({
      where: { sumsub_applicant_id: applicantId },
      include: { issuer: true, wallet: true }
    });
    
    if (!user) {
      console.error(`No user found with applicant ID: ${applicantId}`);
      return { success: false, error: 'User not found' };
    }
    
    console.log(`Found user: ${user.id} for applicant ID: ${applicantId}`);
    
    // Extract personal information from applicant data
    const personalInfo = extractPersonalInfo(applicantData);
    if (!personalInfo) {
      return { success: false, error: 'Failed to extract personal information' };
    }
    
    // Store the personal information
    const existingPersonalInfo = await prisma.personalInfo.findFirst({
      where: { user_id: user.id }
    });
    
    if (existingPersonalInfo) {
      // Update existing record
      await prisma.personalInfo.update({
        where: { id: existingPersonalInfo.id },
        data: personalInfo
      });
      console.log(`Updated personal info for user: ${user.id}`);
    } else {
      // Create new record
      await prisma.personalInfo.create({
        data: {
          ...personalInfo,
          user: { connect: { id: user.id } }
        }
      });
      console.log(`Created personal info for user: ${user.id}`);
    }
    
    // If the user is an issuer, update the verification status
    if (user.issuer) {
      await prisma.issuer.update({
        where: { id: user.issuer.id },
        data: { verified: true }
      });
      console.log(`Updated issuer ${user.issuer.id} verification status to TRUE`);
      
      // Create a wallet for the issuer if needed
      if (!user.wallet) {
        await createWalletIfNeeded(user.id);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error in storeApplicantInfo: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Create a wallet for the user if they don't already have one
 * @param {number} userId - The user ID
 * @returns {Promise<Object>} - The created wallet or null
 */
const createWalletIfNeeded = async (userId) => {
  try {
    // Check if user already has a wallet
    const existingWallet = await prisma.wallet.findFirst({
      where: { user_id: userId }
    });
    
    if (existingWallet) {
      console.log(`User ${userId} already has a wallet: ${existingWallet.address}`);
      return existingWallet;
    }
    
    console.log(`Creating custodial wallet for user: ${userId}`);
    
    // Get Crossmint API key from config
    const apiKey = process.env.CROSSMINT_API_KEY;
    if (!apiKey) {
      throw new Error('Missing Crossmint API key');
    }
    
    // Create a wallet using Crossmint API
    const crossmintUrl = 'https://api.crossmint.com/api/v1/wallets';
    const response = await axios.post(
      crossmintUrl,
      { chain: 'polygon' },
      { headers: { 'x-api-key': apiKey } }
    );
    
    if (!response.data || !response.data.id || !response.data.address) {
      throw new Error('Invalid response from Crossmint API');
    }
    
    // Store wallet in database
    const wallet = await prisma.wallet.create({
      data: {
        user_id: userId,
        address: response.data.address,
        chain: 'polygon',
        provider: 'crossmint',
        external_id: response.data.id
      }
    });
    
    console.log(`Created wallet for user ${userId}: ${wallet.address}`);
    return wallet;
  } catch (error) {
    console.error(`Error creating wallet: ${error.message}`);
    return null;
  }
};

/**
 * @route GET /api/sumsub/applicant/:applicantId/details
 * @desc Get personal details for a specific applicant
 * @access Private
 */
router.get('/applicant/:applicantId/details', isAuthenticated, async (req, res) => {
  try {
    const { applicantId } = req.params;
    
    if (!applicantId) {
      return res.status(400).json({
        success: false,
        message: 'Applicant ID is required'
      });
    }
    
    const { fetchApplicantData, extractPersonalInfo } = require('../utils/sumsubUtils');
    
    // Fetch applicant data from Sumsub
    console.log(`Fetching data for applicant: ${applicantId}`);
    const applicantData = await fetchApplicantData(applicantId);
    
    if (!applicantData) {
      return res.status(404).json({
        success: false,
        message: 'Failed to fetch applicant data from Sumsub'
      });
    }
    
    // Extract personal details
    const personalInfo = extractPersonalInfo(applicantData);
    
    // Check if we have personal details in database
    const existingInfo = await prisma.kyc_personal_info.findFirst({
      where: { applicant_id: applicantId }
    });
    
    // Return the data
    return res.json({
      success: true,
      applicantId,
      extractedInfo: personalInfo,
      existingInfo: existingInfo,
      rawData: applicantData
    });
  } catch (error) {
    console.error('Error getting applicant details:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching applicant details',
      error: error.message
    });
  }
});

/**
 * @route POST /api/sumsub/process/:applicantId
 * @desc Manually process applicant data (similar to a webhook)
 * @access Private
 */
router.post('/process/:applicantId', isAuthenticated, async (req, res) => {
  try {
    const { applicantId } = req.params;
    const { eventType = 'applicantReviewed' } = req.body;
    
    if (!applicantId) {
      return res.status(400).json({
        success: false,
        message: 'Applicant ID is required'
      });
    }
    
    // Validate event type
    const validEventTypes = ['applicantCreated', 'applicantReviewed', 'applicantPending'];
    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}`
      });
    }
    
    const { fetchApplicantData, extractPersonalInfo } = require('../utils/sumsubUtils');
    const { handleApplicantCreated, handleApplicantReviewed } = require('../routes/sumsub-webhooks');
    
    // Fetch applicant data from Sumsub
    console.log(`Manually processing ${eventType} for applicant: ${applicantId}`);
    const applicantData = await fetchApplicantData(applicantId);
    
    if (!applicantData) {
      return res.status(404).json({
        success: false,
        message: 'Failed to fetch applicant data from Sumsub'
      });
    }
    
    // Create a mock webhook payload
    const mockPayload = {
      type: eventType,
      applicantId: applicantId,
      inspectionId: applicantData.inspectionId || applicantId,
      correlationId: crypto.randomUUID(),
      externalUserId: applicantData.externalUserId || null,
      reviewStatus: eventType === 'applicantReviewed' ? 'completed' : 'pending',
      createdAtMs: new Date().toISOString(),
      reviewResult: eventType === 'applicantReviewed' ? { 
        reviewAnswer: 'GREEN',
        rejectType: null,
        rejectLabels: []
      } : null
    };
    
    let result;
    
    // Process the event based on type
    switch (eventType) {
      case 'applicantCreated':
        await handleApplicantCreated(mockPayload);
        result = 'Applicant creation processed';
        break;
        
      case 'applicantReviewed':
        await handleApplicantReviewed(mockPayload);
        result = 'Applicant review processed';
        break;
        
      case 'applicantPending':
        result = 'Applicant pending status recorded';
        break;
    }
    
    return res.json({
      success: true,
      message: result,
      applicantId: applicantId,
      eventType: eventType
    });
  } catch (error) {
    console.error('Error processing applicant:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing applicant',
      error: error.message
    });
  }
});

module.exports = router; 