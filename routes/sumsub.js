const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// Sumsub credentials - replace with your actual credentials
const SUMSUB_APP_TOKEN = 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

// Generate Sumsub signature
function createSignature(method, endpoint, ts, payload = '') {
  const data = ts + method + endpoint + payload;
  console.log('Data for signature:', data);
  return crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(data)
    .digest('hex');
}

// Token endpoint
router.post('/token', async (req, res) => {
  try {
    console.log('Token request received:', req.body);
    
    // User ID must be provided and should be a string
    const userId = (req.body.userId || 'user-' + Date.now()).toString();
    const levelName = req.body.levelName || 'id-and-liveness';
    
    const ts = Math.floor(Date.now() / 1000).toString();
    const endpoint = '/resources/accessTokens';
    const method = 'POST';
    
    // Create query string in URL format
    const queryParams = `userId=${encodeURIComponent(userId)}&levelName=${encodeURIComponent(levelName)}&ttlInSecs=600`;
    const fullEndpoint = `${endpoint}?${queryParams}`;
    
    console.log('Making Sumsub API request to:', `${SUMSUB_BASE_URL}${fullEndpoint}`);
    
    // Signature is based on the full endpoint including query params
    const signature = createSignature(method, fullEndpoint, ts);
    console.log('Generated signature:', signature);
    
    const response = await axios({
      method,
      url: `${SUMSUB_BASE_URL}${fullEndpoint}`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': ts
      }
    });
    
    console.log('Generated token successfully:', response.data);
    
    res.json({ 
      token: response.data.token,
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

module.exports = router; 