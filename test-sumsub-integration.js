/**
 * Test script to verify Sumsub integration is working correctly
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

// Sumsub API configuration
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

// Helper functions
function createSignature(ts, method, endpoint, body = null) {
  let dataToSign = ts + method + endpoint;
  if (body) {
    dataToSign += JSON.stringify(body);
  }
  
  return crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(dataToSign)
    .digest('hex');
}

async function makeRequest(method, endpoint, body = null) {
  try {
    const ts = Math.floor(Date.now() / 1000).toString();
    const signature = createSignature(ts, method, endpoint, body);
    
    const headers = {
      'X-App-Token': SUMSUB_APP_TOKEN,
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': ts,
      'Accept': 'application/json'
    };
    
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    
    const url = SUMSUB_BASE_URL + endpoint;
    console.log(`Making ${method} request to ${url}`);
    
    const response = await axios({
      method,
      url,
      headers,
      data: body
    });
    
    return {
      success: true,
      data: response.data,
      status: response.status
    };
    
  } catch (error) {
    console.error(`Error making ${method} request to ${endpoint}:`, error.message);
    
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    };
  }
}

// Main test function
async function testSumsubIntegration() {
  console.log('Starting Sumsub integration test');
  console.log(`Using App Token: ${SUMSUB_APP_TOKEN.substring(0, 10)}...`);
  console.log(`Using Secret Key: ${SUMSUB_SECRET_KEY.substring(0, 5)}...`);
  
  try {
    // Step 1: Create an applicant
    const externalUserId = `test-user-${Date.now()}`;
    console.log(`Step 1: Creating applicant with externalUserId: ${externalUserId}`);
    
    const createResult = await makeRequest(
      'POST',
      '/resources/applicants?levelName=id-and-liveness',
      { externalUserId }
    );
    
    if (!createResult.success) {
      console.error('❌ Failed to create applicant:', createResult.data);
      return false;
    }
    
    const applicantId = createResult.data.id;
    console.log(`✅ Successfully created applicant with ID: ${applicantId}`);
    
    // Step 2: Generate an access token
    console.log(`Step 2: Generating access token for user: ${externalUserId}`);
    
    const tokenResult = await makeRequest(
      'POST',
      `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}`
    );
    
    if (!tokenResult.success) {
      console.error('❌ Failed to generate access token:', tokenResult.data);
      return false;
    }
    
    console.log(`✅ Successfully generated access token: ${tokenResult.data.token.substring(0, 10)}...`);
    console.log(`   Token expires at: ${new Date(tokenResult.data.expiresAt).toLocaleString()}`);
    
    // Step 3: Verify we can get applicant status
    console.log(`Step 3: Getting status for applicant: ${applicantId}`);
    
    const statusResult = await makeRequest(
      'GET',
      `/resources/applicants/${applicantId}/status`
    );
    
    if (!statusResult.success) {
      console.error('❌ Failed to get applicant status:', statusResult.data);
      return false;
    }
    
    console.log('✅ Successfully retrieved applicant status:', statusResult.data);
    
    console.log('\n🎉 All tests passed! Sumsub integration is working correctly.');
    console.log('\nNext steps:');
    console.log('1. Make sure the Sumsub domain is properly configured in the dashboard');
    console.log('2. Check CORS settings to allow your frontend domain');
    console.log('3. Ensure your backend API endpoints are properly configured');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed with unexpected error:', error.message);
    return false;
  }
}

// Run the test
testSumsubIntegration(); 