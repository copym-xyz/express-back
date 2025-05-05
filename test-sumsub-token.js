/**
 * Test script for directly calling the Sumsub API
 * This bypasses our backend to test if the Sumsub API credentials are working correctly
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

// Use environment variables or defaults
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

async function testSumsubDirectApi() {
  try {
    console.log('Testing Sumsub access token API directly...');
    console.log(`Using app token: ${SUMSUB_APP_TOKEN.substring(0, 10)}...`);
    
    // Generate unique test user ID
    const testUserId = `test-user-${Date.now()}`;
    
    // Generate timestamp for signature
    const ts = Math.floor(Date.now() / 1000).toString();
    
    // Prepare request data - Sumsub expects 'userId' not 'externalUserId'
    const endpoint = '/resources/accessTokens';
    const payload = {
      userId: testUserId,
      levelName: 'id-and-liveness',
      ttlInSecs: 600
    };
    
    console.log('Request payload:', payload);
    
    // Create signature
    const payloadStr = JSON.stringify(payload);
    const signatureStr = ts + 'POST' + endpoint + payloadStr;
    const signature = crypto
      .createHmac('sha256', SUMSUB_SECRET_KEY)
      .update(signatureStr)
      .digest('hex');
    
    // Make API request
    console.log(`Sending request to ${SUMSUB_BASE_URL}${endpoint}`);
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
    
    console.log('Response status:', response.status);
    console.log('Response data:', {
      token: response.data.token ? `${response.data.token.substring(0, 10)}...` : null,
      expiresAt: response.data.expiresAt
    });
    
    console.log('✅ Test successful! Sumsub API is responding correctly.');
    return true;
  } catch (error) {
    console.error('❌ Error testing Sumsub API:');
    console.error('Status code:', error.response?.status);
    console.error('Error message:', error.message);
    console.error('Response data:', error.response?.data);
    return false;
  }
}

// Run the test
testSumsubDirectApi(); 