const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');

// Configuration
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

// Create a local version of the signature generator
function generateSumsubApiSignature(method, url, ts, body, secretKey) {
  // Type conversion
  method = (method || '').toUpperCase();
  
  // Convert body to string if it's an object
  const bodyStr = typeof body === 'object' ? JSON.stringify(body) : (body || '');
  
  // Create the string to sign: timestamp + HTTP method + relative URL + body
  const signingStr = ts + method + url + bodyStr;
  
  // Create HMAC SHA256 hash using the secret key
  const signature = crypto.createHmac('sha256', secretKey)
    .update(signingStr)
    .digest('hex');
  
  return signature;
}

// Test endpoint
router.get('/sumsub-config', async (req, res) => {
  try {
    // Create a test request to Sumsub
    const method = 'GET';
    const endpoint = '/resources/status';
    const ts = Math.floor(Date.now() / 1000).toString();
    
    // Generate signature
    const signature = generateSumsubApiSignature(method, endpoint, ts, '', SUMSUB_SECRET_KEY);
    
    // Make the request
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
    
    // Return success response
    res.json({
      success: true,
      message: 'Sumsub API configuration test successful',
      apiStatus: response.data,
      config: {
        appToken: `${SUMSUB_APP_TOKEN.substring(0, 10)}...`,
        secretKey: `${SUMSUB_SECRET_KEY.substring(0, 5)}...`,
        baseUrl: SUMSUB_BASE_URL
      }
    });
  } catch (error) {
    // Return error response
    res.status(500).json({
      success: false,
      message: 'Sumsub API configuration test failed',
      error: error.message,
      statusCode: error.response?.status,
      errorData: error.response?.data
    });
  }
});

// Add test endpoint to generate a Sumsub access token
router.get('/sumsub-token', async (req, res) => {
  try {
    const ts = Math.floor(Date.now() / 1000).toString();
    const tempUserId = 'temp-' + Date.now();
    const endpoint = '/resources/accessTokens';
    const payload = {
      userId: tempUserId,
      levelName: 'id-and-liveness',
      ttlInSecs: 1200
    };
    
    // Convert payload to string
    const payloadStr = JSON.stringify(payload);
    
    // Generate signature
    const signature = generateSumsubApiSignature('POST', endpoint, ts, payloadStr, SUMSUB_SECRET_KEY);
    
    // Make the request
    const response = await axios({
      method: 'POST',
      url: `${SUMSUB_BASE_URL}${endpoint}`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': ts
      },
      data: payload
    });
    
    // Return success response
    res.json({
      success: true,
      message: 'Sumsub token generated successfully',
      token: response.data.token,
      userId: tempUserId,
      expiresAt: response.data.expiresAt
    });
  } catch (error) {
    // Return error response
    res.status(500).json({
      success: false,
      message: 'Sumsub token generation failed',
      error: error.message,
      statusCode: error.response?.status,
      errorData: error.response?.data
    });
  }
});

module.exports = router; 