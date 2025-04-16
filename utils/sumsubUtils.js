/**
 * Utility functions for Sumsub API integration
 */
const crypto = require('crypto');

// Sumsub credentials - should be loaded from environment variables in production
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com';

/**
 * Generate Sumsub signature for API requests
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} endpoint - API endpoint path (starting with /)
 * @param {number|string} ts - Unix timestamp in seconds
 * @param {string|Object} payload - Request body (empty string for requests with no body)
 * @returns {string} - Signature for Sumsub API request
 */
function createSignature(method, endpoint, ts, payload = '') {
  // Convert payload to string if it's an object
  const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : payload;
  
  // Format the data string exactly as required by Sumsub
  const data = ts + method.toUpperCase() + endpoint + payloadStr;
  
  // Create HMAC SHA256 signature as required by Sumsub
  return crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(data)
    .digest('hex');
}

/**
 * Verify Sumsub webhook signature
 * @param {string} payload - Raw webhook payload as string
 * @param {string} signature - Signature from request headers
 * @param {string} secretKey - Webhook secret key
 * @param {string} digestAlg - Signature algorithm (default: HMAC_SHA256_HEX)
 * @returns {boolean} - Whether signature is valid
 */
function verifyWebhookSignature(payload, signature, secretKey, digestAlg = 'HMAC_SHA256_HEX') {
  try {
    if (!signature || !secretKey) {
      console.warn('Missing signature or secret key');
      return false;
    }

    // Map Sumsub algorithm names to Node.js crypto algorithm names
    const algoMap = {
      'HMAC_SHA1_HEX': 'sha1',
      'HMAC_SHA256_HEX': 'sha256',
      'HMAC_SHA512_HEX': 'sha512'
    };

    const algo = algoMap[digestAlg] || 'sha256';
    
    // Calculate HMAC digest
    const hmac = crypto.createHmac(algo, secretKey)
      .update(payload)
      .digest('hex');
    
    // Compare signatures using constant-time comparison to prevent timing attacks
    return constantTimeCompare(hmac, signature);
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Constant-time comparison of two strings to prevent timing attacks
 * @param {string} a - First string to compare
 * @param {string} b - Second string to compare
 * @returns {boolean} - Whether strings match
 */
function constantTimeCompare(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate test signature for Postman or other tools
 * @param {Object|string} payload - Webhook payload
 * @param {string} secretKey - Webhook secret key
 * @param {string} digestAlg - Signature algorithm
 * @returns {string} - Generated signature
 */
function generateTestSignature(payload, secretKey, digestAlg = 'HMAC_SHA256_HEX') {
  const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : payload;
  
  // Map Sumsub algorithm names to Node.js crypto algorithm names
  const algoMap = {
    'HMAC_SHA1_HEX': 'sha1',
    'HMAC_SHA256_HEX': 'sha256',
    'HMAC_SHA512_HEX': 'sha512'
  };
  
  const algo = algoMap[digestAlg] || 'sha256';
  
  // Calculate HMAC digest
  return crypto.createHmac(algo, secretKey)
    .update(payloadStr)
    .digest('hex');
}

module.exports = {
  SUMSUB_APP_TOKEN,
  SUMSUB_SECRET_KEY,
  SUMSUB_BASE_URL,
  createSignature,
  verifyWebhookSignature,
  generateTestSignature
};