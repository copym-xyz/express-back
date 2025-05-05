/**
 * Direct test for Sumsub API using simple fetch approach
 * Based on Sumsub documentation
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

// Sumsub API configuration
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

// Create signature for Sumsub API
function createSignature(ts, httpMethod, url, body) {
  let dataToSign = ts + httpMethod + url;
  if (body) {
    dataToSign += JSON.stringify(body);
  }
  
  console.log('Data to sign:', dataToSign);
  
  return crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(dataToSign)
    .digest('hex');
}

// Main test function
async function testSumsubAPI() {
  try {
    console.log('Testing Sumsub API directly...');
    console.log(`Using token: ${SUMSUB_APP_TOKEN}`);
    
    // 1. Create applicant first
    const externalUserId = `test-user-${Date.now()}`;
    const applicantEndpoint = '/resources/applicants?levelName=id-and-liveness';
    const applicantBody = {
      externalUserId: externalUserId
    };
    
    const applicantTS = Math.floor(Date.now() / 1000).toString();
    const applicantSignature = createSignature(applicantTS, 'POST', applicantEndpoint, applicantBody);
    
    console.log('Creating applicant with external ID:', externalUserId);
    const applicantResponse = await axios({
      method: 'POST',
      url: SUMSUB_BASE_URL + applicantEndpoint,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Sig': applicantSignature,
        'X-App-Access-Ts': applicantTS
      },
      data: applicantBody
    });
    
    const applicantId = applicantResponse.data.id;
    console.log('Created applicant successfully with ID:', applicantId);
    
    // 2. Now generate access token for this applicant
    const tokenEndpoint = '/resources/accessTokens';
    const tokenBody = {
      applicantId: applicantId,
      levelName: 'id-and-liveness',
      ttlInSecs: 600
    };
    
    const tokenTS = Math.floor(Date.now() / 1000).toString();
    const tokenSignature = createSignature(tokenTS, 'POST', tokenEndpoint, tokenBody);
    
    console.log('Requesting access token for user:', externalUserId);
    const tokenResponse = await axios({
      method: 'POST',
      url: SUMSUB_BASE_URL + tokenEndpoint,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Sig': tokenSignature,
        'X-App-Access-Ts': tokenTS
      },
      data: tokenBody
    });
    
    console.log('Token response:', {
      token: tokenResponse.data.token ? tokenResponse.data.token.substring(0, 10) + '...' : null,
      expiresAt: tokenResponse.data.expiresAt
    });
    
    console.log('✅ Test successful!');
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
testSumsubAPI(); 