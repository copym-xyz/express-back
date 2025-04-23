/**
 * Utility functions for Sumsub API integration
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Sumsub credentials - should be loaded from environment variables in production
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com';

// Base directory for storing KYC documents
const KYC_DOCS_BASE_DIR = path.join(__dirname, '../../uploads/kyc');

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
 * Find user by Sumsub identifiers - tries multiple approaches
 */
async function findUserBySumsubIdentifiers(applicantId, externalUserId) {
  console.log(`Looking up user for applicantId=${applicantId}, externalUserId=${externalUserId}`);
  
  // 1. First try: Direct lookup in issuer table by applicantId
  if (applicantId) {
    const issuer = await prisma.issuer.findFirst({
      where: { sumsub_applicant_id: applicantId },
      include: { user: true }
    });
    
    if (issuer?.user) {
      console.log(`User found via Issuer.sumsub_applicant_id: ${issuer.user.id}`);
      return issuer.user;
    }
  }
  
  // 2. Second try: Check if externalUserId is numeric and matches a user id
  if (externalUserId) {
    // Handle 'user-123' format (extract 123)
    const userIdMatch = externalUserId.match(/^user-(\d+)$/);
    if (userIdMatch && userIdMatch[1]) {
      const userId = parseInt(userIdMatch[1]);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      
      if (user) {
        console.log(`User found via externalUserId pattern: ${user.id}`);
        
        // Update the issuer record if it exists
        if (applicantId) {
          const issuer = await prisma.issuer.findFirst({
            where: { user_id: user.id }
          });
          
          if (issuer) {
            await prisma.issuer.update({
              where: { id: issuer.id },
              data: { sumsub_applicant_id: applicantId }
            });
            console.log(`Updated issuer ${issuer.id} with sumsub_applicant_id ${applicantId}`);
          }
        }
        
        return user;
      }
    }
    
    // Handle 'level-xxxx' format - try to find in KYC verifications
    if (externalUserId.startsWith('level-')) {
      const verification = await prisma.kycVerification.findFirst({
        where: { externalUserId },
        include: { user: true }
      });
      
      if (verification?.user) {
        console.log(`User found via existing verification with externalUserId: ${verification.user.id}`);
        return verification.user;
      }
    }
  }
  
  // 3. Third try: Check existing KYC verifications for this applicantId
  if (applicantId) {
    const verification = await prisma.kycVerification.findFirst({
      where: { applicantId },
      include: { user: true }
    });
    
    if (verification?.user) {
      console.log(`User found via existing verification with applicantId: ${verification.user.id}`);
      return verification.user;
    }
  }
  
  console.log(`No user found for applicantId=${applicantId}, externalUserId=${externalUserId}`);
  return null;
}

/**
 * Verify webhook signature from Sumsub
 * 
 * @param {Buffer|string} payload - Raw request body as Buffer or string
 * @param {string} signature - Signature from x-payload-digest header
 * @param {string} secretKey - Sumsub secret key
 * @param {string} digestAlg - Digest algorithm (default: HMAC_SHA256_HEX)
 * @returns {boolean} - Whether signature is valid
 */
function verifyWebhookSignature(payload, signature, secretKey, digestAlg = 'HMAC_SHA256_HEX') {
  try {
    if (!signature || !secretKey) {
      console.warn('Missing signature or secret key for webhook verification');
      return false;
    }

    if (!payload) {
      console.warn('Missing payload for webhook verification');
      return false;
    }

    // Ensure payload is a Buffer
    let payloadBuffer;
    if (Buffer.isBuffer(payload)) {
      payloadBuffer = payload;
    } else if (typeof payload === 'string') {
      payloadBuffer = Buffer.from(payload, 'utf8');
    } else {
      console.warn('Invalid payload type for webhook verification:', typeof payload);
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
      .update(payloadBuffer)
      .digest('hex');
    
    console.log(`Calculated HMAC: ${hmac.substring(0, 16)}... (${hmac.length} chars)`);
    console.log(`Received signature: ${signature.substring(0, 16)}... (${signature.length} chars)`);
    
    // Use constant-time comparison when available
    if (hmac.length === signature.length) {
      try {
        return crypto.timingSafeEqual(
          Buffer.from(hmac.toLowerCase(), 'utf8'),
          Buffer.from(signature.toLowerCase(), 'utf8')
        );
      } catch (compareError) {
        console.warn('Constant-time comparison failed, falling back to string comparison:', compareError.message);
        // Fall back to regular comparison if timing-safe fails
        return hmac.toLowerCase() === signature.toLowerCase();
      }
    } else {
      console.warn(`Signature length mismatch: expected ${hmac.length}, got ${signature.length}`);
    }
    
    // If lengths don't match, they can't be equal
    return false;
  } catch (error) {
    console.error('Error verifying webhook signature:', {
      error: error.message,
      errorStack: error.stack,
      digestAlg,
      signatureLength: signature ? signature.length : 0,
      payloadType: typeof payload,
      payloadIsBuffer: Buffer.isBuffer(payload),
      payloadLength: payload ? (Buffer.isBuffer(payload) ? payload.length : payload.length) : 0
    });
    return false;
  }
}

/**
 * Creates folder structure for document storage
 */
async function createDateBasedFolderStructure(applicantId) {
  try {
    // Validate inputs
    if (!applicantId) {
      throw new Error('ApplicantId is required for folder structure creation');
    }

    // Create date-based folders
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    
    // Check if base directory exists and create if needed
    try {
      await fs.access(KYC_DOCS_BASE_DIR);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`Creating base KYC documents directory: ${KYC_DOCS_BASE_DIR}`);
        await fs.mkdir(KYC_DOCS_BASE_DIR, { recursive: true });
      } else {
        throw err;
      }
    }
    
    // Create the directory structure
    const yearDir = path.join(KYC_DOCS_BASE_DIR, year);
    const monthDir = path.join(yearDir, month);
    const dayDir = path.join(monthDir, day);
    const applicantDir = path.join(dayDir, applicantId);
    
    // Ensure directories exist
    await fs.mkdir(yearDir, { recursive: true });
    await fs.mkdir(monthDir, { recursive: true });
    await fs.mkdir(dayDir, { recursive: true });
    await fs.mkdir(applicantDir, { recursive: true });
    
    return {
      baseDir: KYC_DOCS_BASE_DIR,
      yearDir, 
      monthDir,
      dayDir,
      applicantDir,
      year,
      month,
      day,
      datePath: path.join(year, month, day, applicantId)
    };
  } catch (error) {
    console.error(`Error creating folder structure: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch applicant data from Sumsub API
 * @param {string} applicantId - The Sumsub applicant ID
 * @returns {Promise<Object|null>} - The applicant data or null if error
 */
const fetchApplicantData = async (applicantId) => {
  try {
    if (!applicantId) {
      console.error('No applicant ID provided to fetch applicant data');
      return null;
    }

    console.log(`Fetching applicant data for ID: ${applicantId}`);
    const endpoint = `/resources/applicants/${applicantId}`;
    const response = await makeSumsubRequest('GET', endpoint);
    
    if (!response) {
      console.error(`Failed to fetch applicant data for ID: ${applicantId}`);
      return null;
    }
    
    return response;
  } catch (error) {
    console.error(`Error fetching applicant data from Sumsub API: ${error.message}`);
    return null;
  }
};

/**
 * Extract personal information from Sumsub applicant data
 * @param {Object} applicantData - The applicant data from Sumsub
 * @returns {Object|null} - Extracted personal information or null if missing
 */
const extractPersonalInfo = (applicantData) => {
  try {
    if (!applicantData || !applicantData.info) {
      console.error('Missing or invalid applicant data for extracting personal info');
      return null;
    }

    const { info } = applicantData;
    
    // Extract basic personal information
    const personalInfo = {
      firstName: info.firstName || '',
      middleName: info.middleName || '',
      lastName: info.lastName || '',
      gender: info.gender || '',
      dateOfBirth: info.dob || '',
      placeOfBirth: info.placeOfBirth || '',
      countryOfBirth: info.country || '',
      nationality: info.nationality || '',
      phone: info.phone || '',
      email: info.email || '',
      country: info.country || '',
      taxResidence: info.idDocs?.find(doc => doc.country)?.country || '',
      taxIdentificationNumber: info.idNumber || ''
    };

    // Extract address information if available
    if (info.addresses && info.addresses.length > 0) {
      const primaryAddress = info.addresses[0];
      personalInfo.address = {
        street: primaryAddress.street || '',
        streetLine2: primaryAddress.subStreet || '',
        city: primaryAddress.city || '',
        state: primaryAddress.state || '',
        postCode: primaryAddress.postCode || '',
        country: primaryAddress.country || ''
      };
    }

    return personalInfo;
  } catch (error) {
    console.error(`Error extracting personal info: ${error.message}`);
    return null;
  }
};

module.exports = {
  SUMSUB_APP_TOKEN,
  SUMSUB_SECRET_KEY,
  SUMSUB_BASE_URL,
  createSignature,
  findUserBySumsubIdentifiers,
  verifyWebhookSignature,
  createDateBasedFolderStructure,
  KYC_DOCS_BASE_DIR,
  fetchApplicantData,
  extractPersonalInfo
};