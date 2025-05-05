/**
 * Simplified test for Sumsub API
 * Based directly on Sumsub documentation
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

// Configuration
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

// Create a signature for the request
const createSignature = (ts, method, url, body = '') => {
  const signingString = ts + method + url + (body ? JSON.stringify(body) : '');
  console.log('String to sign:', signingString);
  return crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(signingString)
    .digest('hex');
};

// Get headers for Sumsub API request
const getHeaders = (method, url, body = null) => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = createSignature(ts, method, url, body);
  
  const headers = {
    'Accept': 'application/json',
    'X-App-Token': SUMSUB_APP_TOKEN,
    'X-App-Access-Sig': signature,
    'X-App-Access-Ts': ts
  };
  
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  
  return headers;
};

async function testAccessToken() {
  try {
    console.log('Testing Sumsub access token using simplified approach...');
    
    // Generate a unique user ID for this test
    const externalUserId = `test-user-${Date.now()}`;
    console.log(`External User ID: ${externalUserId}`);
    
    // Step 1: Create an applicant
    const createUrl = '/resources/applicants?levelName=id-and-liveness';
    const createBody = { externalUserId };
    
    console.log('1. Creating applicant...');
    const createResponse = await axios({
      method: 'POST',
      url: SUMSUB_BASE_URL + createUrl,
      headers: getHeaders('POST', createUrl, createBody),
      data: createBody
    });
    
    const applicantId = createResponse.data.id;
    console.log(`Applicant created with ID: ${applicantId}`);
    
    // Step 2: Get access token
    const tokenUrl = '/resources/accessTokens?userId=' + externalUserId;
    
    console.log('2. Getting access token...');
    const tokenResponse = await axios({
      method: 'POST',
      url: SUMSUB_BASE_URL + tokenUrl,
      headers: getHeaders('POST', tokenUrl)
    });
    
    console.log('Success! Received token response:');
    console.log(`- Token: ${tokenResponse.data.token.substring(0, 10)}...`);
    console.log(`- Expires at: ${new Date(tokenResponse.data.expiresAt).toLocaleString()}`);
    
    return {
      success: true,
      token: tokenResponse.data.token,
      expiresAt: tokenResponse.data.expiresAt
    };
  } catch (error) {
    console.error('Error testing Sumsub API:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Response data:', error.response?.data);
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// Run the test
testAccessToken(); 