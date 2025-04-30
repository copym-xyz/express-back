/**
 * Utility functions for Sumsub API integration
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// Sumsub credentials - should be loaded from environment variables in production
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com';

// Log API configuration
console.log('Sumsub API Configuration:');
console.log(`- Base URL: ${SUMSUB_BASE_URL}`);
console.log(`- App Token: ${SUMSUB_APP_TOKEN.substring(0, 10)}...`);
console.log(`- Secret Key: ${SUMSUB_SECRET_KEY.substring(0, 5)}...`);
console.log('Make sure these match the values in your Sumsub dashboard');

// Base directory for storing KYC documents
const KYC_DOCS_BASE_DIR = path.join(__dirname, '../../uploads/kyc');

/**
 * Create signature for Sumsub API request
 * 
 * @param {string} method - HTTP method (GET, POST, etc)
 * @param {string} endpoint - API endpoint path
 * @param {number} ts - Unix timestamp
 * @param {object|string} payload - Request payload (if applicable)
 * @returns {string} - HMAC signature
 */
function createSignature(method, endpoint, ts, payload = '') {
  // Convert payload to string if it's an object
  const payloadStr = typeof payload === 'object' && payload !== null ? JSON.stringify(payload) : (payload || '');
  
  // Format the data string exactly as required by Sumsub
  // The format must be: ts + method.toUpperCase() + endpoint + payloadStr
  const data = ts + method.toUpperCase() + endpoint + payloadStr;
  
  console.log(`Creating signature with data: "${data}"`);
  
  // Create HMAC SHA256 signature as required by Sumsub
  const signature = crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(data)
    .digest('hex');
    
  console.log(`Generated signature: ${signature.substring(0, 16)}...`);
  
  return signature;
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
 * @param {string} applicantId - Sumsub applicant ID
 * @returns {Promise<Object>} - Applicant data
 */
async function fetchApplicantData(applicantId) {
  try {
    if (!applicantId) {
      console.error('Missing applicantId for fetchApplicantData');
      return null;
    }

    console.log(`Fetching data for applicant ID: ${applicantId}`);

    // Build Sumsub API request
    const timestamp = Math.floor(Date.now() / 1000);
    const apiUrl = `/resources/applicants/${applicantId}/one`;
    
    console.log(`Timestamp: ${timestamp}, API URL: ${apiUrl}`);
    console.log(`App Token: ${SUMSUB_APP_TOKEN.substring(0, 8)}...`);
    
    // Generate signature for Sumsub API request
    const signature = createSignature('GET', apiUrl, timestamp, null);
    
    // Configure request options
    const url = `${SUMSUB_BASE_URL}${apiUrl}`;
    console.log(`Making API request to: ${url}`);
    
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Token': SUMSUB_APP_TOKEN,
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': timestamp
    };
    
    console.log('Request headers:', JSON.stringify({
      'X-App-Token': `${SUMSUB_APP_TOKEN.substring(0, 8)}...`,
      'X-App-Access-Sig': `${signature.substring(0, 16)}...`,
      'X-App-Access-Ts': timestamp
    }));
    
    const response = await axios({
      method: 'GET',
      url,
      headers
    });
    
    if (!response.data) {
      console.error(`No data returned for applicant ${applicantId}`);
      return null;
    }
    
    console.log(`Successfully fetched data for applicant ${applicantId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching applicant data: ${error.message}`);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', JSON.stringify(error.response.headers));
      console.error('Response data:', JSON.stringify(error.response.data));
    }
    return null;
  }
}

/**
 * Extract personal information from Sumsub applicant data
 * @param {Object} applicantData - The applicant data from Sumsub
 * @returns {Object|null} - Structured personal information or null if no useful data found
 */
function extractPersonalInfo(applicantData) {
  if (!applicantData) {
    console.log('No applicant data provided to extractPersonalInfo');
    return null;
  }

  try {
    // Log the structure of the applicant data for debugging
    console.log('Extracting personal info from applicant data structure:', 
      JSON.stringify(Object.keys(applicantData)));
    
    if (applicantData.info) {
      console.log('Info fields available:', JSON.stringify(Object.keys(applicantData.info)));
    }

    const info = {};
    let hasUsefulData = false;
    
    // Extract basic info - Check multiple paths and variations
    if (applicantData.info) {
      // Standard fields
      info.firstName = applicantData.info.firstName || applicantData.info.firstNameEn || null;
      info.lastName = applicantData.info.lastName || applicantData.info.lastNameEn || null;
      info.middleName = applicantData.info.middleName || null;
      info.dob = applicantData.info.dob || null;
      info.gender = applicantData.info.gender || null;
      info.nationality = applicantData.info.nationality || null;
      info.email = applicantData.info.email || null;
      info.phone = applicantData.info.phone || null;
      
      // Check if any basic fields were found
      if (info.firstName || info.lastName || info.dob || info.nationality) {
        hasUsefulData = true;
      }
    }
    
    // Look for alternate structures - fixedInfo
    if (!hasUsefulData && applicantData.fixedInfo) {
      info.firstName = applicantData.fixedInfo.firstName || null;
      info.lastName = applicantData.fixedInfo.lastName || null;
      info.middleName = applicantData.fixedInfo.middleName || null;
      info.dob = applicantData.fixedInfo.dob || null;
      info.nationality = applicantData.fixedInfo.nationality || null;
      
      if (info.firstName || info.lastName || info.dob || info.nationality) {
        hasUsefulData = true;
        console.log('Found personal info in fixedInfo structure');
      }
    }
    
    // Extract ID document info
    if (applicantData.info && applicantData.info.idDocs && applicantData.info.idDocs.length > 0) {
      const idDoc = applicantData.info.idDocs[0];
      info.idType = idDoc.idDocType || null;
      info.idNumber = idDoc.number || null;
      info.issueDate = idDoc.issuedDate || idDoc.issueDate || null;
      info.expiryDate = idDoc.expiryDate || null;
      
      if (info.idNumber) {
        hasUsefulData = true;
      }
    }
    
    // Extract address info - multiple possible paths
    let addressFound = false;
    
    // Standard path: info.addresses
    if (applicantData.info && applicantData.info.addresses && applicantData.info.addresses.length > 0) {
      const address = applicantData.info.addresses[0];
      info.country = address.country || null;
      info.state = address.state || address.region || address.province || null;
      info.town = address.town || address.city || null;
      info.street = address.street || address.streetAddress || address.address || null;
      info.postcode = address.postcode || address.postalCode || address.zipCode || null;
      info.buildingNumber = address.buildingNumber || address.houseNumber || null;
      info.flatNumber = address.flatNumber || address.apartmentNumber || address.unitNumber || null;
      addressFound = true;
    }
    
    // Alternative path: applicantData.address
    if (!addressFound && applicantData.address) {
      info.country = applicantData.address.country || null;
      info.state = applicantData.address.state || applicantData.address.region || applicantData.address.province || null;
      info.town = applicantData.address.town || applicantData.address.city || null;
      info.street = applicantData.address.street || applicantData.address.streetAddress || applicantData.address.address || null;
      info.postcode = applicantData.address.postcode || applicantData.address.postalCode || applicantData.address.zipCode || null;
      addressFound = true;
    }
    
    // Check if address info was found
    if (addressFound && (info.country || info.town || info.street)) {
      hasUsefulData = true;
    }
    
    // Only return the info object if we found at least some useful data
    if (hasUsefulData) {
      console.log('Successfully extracted personal information');
      return info;
    } else {
      console.log('No useful personal information found in applicant data');
      return null;
    }
  } catch (error) {
    console.error('Error extracting personal info:', error);
    console.error('Applicant data structure:', JSON.stringify(Object.keys(applicantData || {})));
    return null;
  }
}

/**
 * Saves personal information to the database
 * @param {string} applicantId - Sumsub applicant ID
 * @param {Object} personalInfo - Extracted personal information
 * @returns {Promise<Object>} - Saved personal info record
 */
const savePersonalInfo = async (applicantId, personalInfo) => {
  try {
    if (!applicantId) {
      console.error('Missing applicantId for savePersonalInfo');
      return null;
    }

    if (!personalInfo || Object.keys(personalInfo).length === 0) {
      console.error('No personal info provided to savePersonalInfo');
      return null;
    }

    console.log(`Saving personal info for applicant ${applicantId}`);
    
    // Find existing record or create a new one
    const existingRecord = await prisma.kyc_personal_info.findFirst({
      where: {
        applicant_id: applicantId
      }
    });

    const personalInfoData = {
      first_name: personalInfo.firstName,
      last_name: personalInfo.lastName,
      middle_name: personalInfo.middleName,
      date_of_birth: personalInfo.dob ? new Date(personalInfo.dob) : null,
      gender: personalInfo.gender,
      nationality: personalInfo.nationality,
      id_number: personalInfo.idNumber,
      country: personalInfo.country,
      phone: personalInfo.phone,
      email: personalInfo.email,
      updated_at: new Date()
    };

    if (existingRecord) {
      console.log(`Updating existing personal info record for applicant ${applicantId}`);
      // Update existing record
      return await prisma.kyc_personal_info.update({
        where: { id: existingRecord.id },
        data: personalInfoData
      });
    }
    
    console.log(`Creating new personal info record for applicant ${applicantId}`);
    // Create new record
    return await prisma.kyc_personal_info.create({
      data: {
        ...personalInfoData,
        applicant_id: applicantId,
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error(`Error saving personal info to database for applicant ${applicantId}:`, error);
    if (error.meta && error.meta.field_name) {
      console.error(`Field error: ${error.meta.field_name}`);
    }
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
  extractPersonalInfo,
  savePersonalInfo
};