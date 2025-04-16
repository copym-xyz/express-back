const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Sumsub credentials - replace with your actual credentials
const SUMSUB_APP_TOKEN = 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

// Webhook secret key - used for signature verification
const WEBHOOK_SECRET_KEY = 'Kjp1bbs4_rDiyQYl4feXceLqbkn';

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

// Verify webhook signature from Sumsub
function verifyWebhookSignature(payload, signature) {
  if (!signature || !payload) {
    console.error('Missing signature or payload for verification');
    return false;
  }

  // For SHA1 (deprecated but required for backward compatibility)
  const calculatedSignature = crypto
    .createHmac('sha1', WEBHOOK_SECRET_KEY)
    .update(payload)
    .digest('hex');
  
  console.log('Received signature:', signature);
  console.log('Calculated signature:', calculatedSignature);
  
  return calculatedSignature === signature;
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
    
    // User ID must be provided and should be a string
    const userId = (req.body.userId || 'user-' + Date.now()).toString();
    const levelName = req.body.levelName || 'id-and-liveness';
    
    // Find the user in the database if it's a numeric user ID
    // This allows us to associate the Sumsub applicant with a user
    let dbUser = null;
    if (/^\d+$/.test(userId)) {
      // It's a numeric ID, let's find the user
      dbUser = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        include: { issuer: true }
      });
      
      if (!dbUser) {
        console.warn(`User with ID ${userId} not found in database.`);
      } else {
        console.log(`Found user ${dbUser.email} (ID: ${dbUser.id})`);
      }
    }
    
    // Create query string in URL format for the access token request
    const queryParams = `userId=${encodeURIComponent(userId)}&levelName=${encodeURIComponent(levelName)}&ttlInSecs=600`;
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
        
        // Update the issuer with the Sumsub applicantId
        await prisma.issuer.update({
          where: { id: dbUser.issuer.id },
          data: {
            sumsub_applicant_id: tokenData.applicantId,
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
      userId,
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
    console.log('Received webhook from Sumsub:', JSON.stringify(req.body, null, 2));
    
    // Verify the signature if possible
    const signature = req.get('x-payload-digest');
    
    // Get the payload
    const payload = req.body;
    
    if (!payload.applicantId) {
      console.error('No applicant ID in webhook payload');
      return res.status(400).json({ error: 'Missing applicant ID' });
    }
    
    // Cleanup the applicantId to handle both formats
    const cleanApplicantId = payload.applicantId.replace('applicant_', '');
    console.log(`Processing webhook for applicant ID: ${cleanApplicantId}`);
    console.log(`Original applicantId: ${payload.applicantId}, Cleaned applicantId: ${cleanApplicantId}`);
    
    // For testing applicant ID specifically, log the entire payload
    if (knownApplicants.includes(cleanApplicantId)) {
      console.log('TESTING APPLICANT WEBHOOK DATA:', JSON.stringify({
        applicantId: cleanApplicantId,
        externalUserId: payload.externalUserId,
        inspectionId: payload.inspectionId,
        correlationId: payload.correlationId,
        reviewStatus: payload.reviewStatus,
        reviewResult: payload.reviewResult,
        type: payload.type
      }, null, 2));
      
      // Special handling for test applicant ID
      if (cleanApplicantId === '67fbddcc012a2856878eda8e') {
        try {
          // Find an issuer without a Sumsub applicant ID to link
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
              data: { sumsub_applicant_id: cleanApplicantId }
            });
            console.log(`Successfully linked test applicant ID to issuer ${unlinkedIssuer.id}`);
          } else {
            console.log('No eligible issuer found to link test applicant ID');
          }
        } catch (error) {
          console.error('Error linking test applicant ID to issuer:', error);
        }
      }
    }
    
    // Verify the webhook signature
    if (!verifyWebhookSignature(req.rawBody, signature)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }
    
    console.log('Webhook signature verified successfully');
    
    // Verify the webhook is legitimate
    if (!payload) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }
    
    // Find the issuer with this applicant ID
    const issuer = await prisma.issuer.findFirst({
      where: { sumsub_applicant_id: cleanApplicantId },
      include: { user: true }
    });
    
    if (!issuer) {
      console.warn(`No issuer found with applicantId: ${cleanApplicantId}`);
      
      // Store the webhook data anyway for auditing
      try {
        await prisma.kycVerification.create({
          data: {
            applicantId: cleanApplicantId,
            externalUserId: payload.externalUserId || '',
            inspectionId: payload.inspectionId || '',
            correlationId: payload.correlationId || null,
            type: payload.type || 'unknown',
            reviewStatus: payload.reviewStatus || '',
            reviewResult: payload.reviewResult?.reviewAnswer || '',
            rawData: JSON.stringify(payload),
            signatureValid: true
          }
        });
        console.log('Webhook data stored without user association');
      } catch (dbError) {
        console.error('Error storing webhook data:', dbError);
      }
      
      return res.status(200).send('OK'); // Return 200 even if we can't find the user
    }
    
    console.log(`Found issuer: ${issuer.id} for user: ${issuer.user.email}`);
    
    // Handle different webhook events
    if (payload.type === 'applicantReviewed') {
      const reviewResult = payload.reviewResult?.reviewAnswer;
      
      if (reviewResult === 'GREEN') {
        // Applicant was approved
        await prisma.issuer.update({
          where: { id: issuer.id },
          data: {
            verification_status: true,
            verification_date: new Date()
          }
        });
        console.log(`Issuer ${issuer.id} was verified successfully`);
      } else if (reviewResult === 'RED') {
        // Applicant was rejected
        await prisma.issuer.update({
          where: { id: issuer.id },
          data: {
            verification_status: false,
            verification_date: new Date()
          }
        });
        console.log(`Issuer ${issuer.id} verification was rejected`);
      }
      
      // Store the verification event in the database
      try {
        await prisma.kycVerification.create({
          data: {
            applicantId: cleanApplicantId,
            externalUserId: payload.externalUserId || '',
            inspectionId: payload.inspectionId || '',
            correlationId: payload.correlationId || null,
            type: payload.type,
            reviewStatus: payload.reviewStatus || '',
            reviewResult: reviewResult || '',
            rawData: JSON.stringify(payload),
            userId: issuer.user_id,
            signatureValid: true,
            webhookType: payload.type,
            eventTimestamp: new Date(payload.createdAtMs || Date.now())
          }
        });
        console.log('KYC verification event stored in database');
      } catch (dbError) {
        console.error('Error storing KYC verification event:', dbError);
      }
    } else {
      // Handle other webhook types (applicantCreated, applicantPending, etc.)
      try {
        await prisma.kycVerification.create({
          data: {
            applicantId: cleanApplicantId,
            externalUserId: payload.externalUserId || '',
            inspectionId: payload.inspectionId || '',
            correlationId: payload.correlationId || null,
            type: payload.type,
            reviewStatus: payload.reviewStatus || '',
            reviewResult: payload.reviewResult?.reviewAnswer || '',
            rawData: JSON.stringify(payload),
            userId: issuer.user_id,
            signatureValid: true,
            webhookType: payload.type,
            eventTimestamp: new Date(payload.createdAtMs || Date.now())
          }
        });
        console.log(`${payload.type} event stored in database`);
      } catch (dbError) {
        console.error(`Error storing ${payload.type} event:`, dbError);
      }
    }
    
    // Always respond with 200 OK to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing Sumsub webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
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

module.exports = router; 