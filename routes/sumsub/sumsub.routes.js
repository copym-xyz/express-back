const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../../middleware/auth');
const sumsubController = require('../../controllers/sumsub/sumsub.controller');

// Create an applicant in Sumsub
router.post('/applicants', authenticateJWT, sumsubController.createApplicant);

// Generate an access token for Sumsub SDK
router.post('/access-token', authenticateJWT, sumsubController.getAccessToken);

// Simple token endpoint that matches the frontend URL pattern
// Allow access without JWT authentication as it's used during initial KYC setup
router.post('/token', sumsubController.getTemporaryToken);
router.get('/token', sumsubController.getTemporaryToken);

// Get applicant status from Sumsub
router.get('/applicants/:applicantId/status', authenticateJWT, sumsubController.getApplicantStatus);

// Get user verification status
router.get('/verification-status', authenticateJWT, sumsubController.getUserVerificationStatus);

// Add a health check endpoint for Sumsub API connectivity
router.get('/health-check', (req, res) => {
  const axios = require('axios');
  const crypto = require('crypto');
  
  // Configuration
  const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
  const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
  
  // Try multiple base URLs in case the endpoint has changed
  const baseUrls = [
    'https://api.sumsub.com',
    'https://test-api.sumsub.com',
    'https://api.inlaksumsub.com'
  ];
  
  // Generate current timestamp
  const ts = Math.floor(Date.now() / 1000).toString();
  
  // Prepare endpoint - try a different endpoint
  const endpoint = '/resources/applicants/levelNames';
  
  // Create signature string (ts + method + endpoint + body)
  const signatureStr = ts + 'GET' + endpoint;
  
  // Generate signature
  const signature = crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(signatureStr)
    .digest('hex');
  
  // Try all base URLs
  Promise.all(baseUrls.map(baseUrl => {
    return axios({
      method: 'GET',
      url: `${baseUrl}${endpoint}`,
      headers: {
        'Accept': 'application/json',
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': ts
      }
    })
    .then(response => ({
      baseUrl,
      success: true,
      data: response.data
    }))
    .catch(error => ({
      baseUrl,
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    }));
  }))
  .then(results => {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length > 0) {
      res.json({
        success: true,
        status: 'Sumsub API is accessible',
        workingBaseUrl: successfulResults[0].baseUrl,
        apiResponse: successfulResults[0].data,
        allResults: results
      });
    } else {
      res.status(500).json({
        success: false,
        status: 'All Sumsub API connections failed',
        allResults: results
      });
    }
  })
  .catch(error => {
    res.status(500).json({
      success: false,
      status: 'Error testing Sumsub API connections',
      error: error.message
    });
  });
});

module.exports = router; 