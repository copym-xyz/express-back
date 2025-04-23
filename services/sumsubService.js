const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { createDateBasedFolderStructure } = require('../utils/sumsubUtils');

const prisma = new PrismaClient();

// Sumsub API credentials - should be in env variables in production
const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'sbx:tM8HVP9NTOKvJMGn0ivKhYpr.eL4yA7WHjYXzbZDeh818LZdZ2cnHCLZr';
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || '535NduU5ydNWqHnFsplSuiq7wDPR3BnC';
const SUMSUB_BASE_URL = process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com';

/**
 * Create signature for Sumsub API request
 */
function createSignature(method, endpoint, ts, payload = '') {
  const methodUpperCase = method.toUpperCase();
  const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : (payload || '');
  const data = ts + methodUpperCase + endpoint + payloadStr;
  
  return crypto
    .createHmac('sha256', SUMSUB_SECRET_KEY)
    .update(data)
    .digest('hex');
}

/**
 * Make authenticated request to Sumsub API
 */
async function makeSumsubRequest(method, endpoint, body = null, params = null, isBinary = false) {
  try {
    // Generate fresh timestamp for the request
    const ts = Math.floor(Date.now() / 1000).toString();
    
    // Calculate signature
    const signature = createSignature(method, endpoint, ts, body);
    
    // Set up request headers
    const headers = {
      'Accept': 'application/json',
      'X-App-Token': SUMSUB_APP_TOKEN,
      'X-App-Access-Sig': signature,
      'X-App-Access-Ts': ts
    };
    
    // Add Content-Type header for requests with body
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    
    const options = {
      method: method.toUpperCase(),
      url: `${SUMSUB_BASE_URL}${endpoint}`,
      headers,
      params: params || undefined
    };
    
    // Add body if provided
    if (body) {
      options.data = typeof body === 'string' ? body : JSON.stringify(body);
    }
    
    // Set response type for binary data
    if (isBinary) {
      options.responseType = 'arraybuffer';
    }
    
    // Make the request
    const response = await axios(options);
    return response.data;
  } catch (error) {
    console.error(`Sumsub API error (${method} ${endpoint}):`, error.message);
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Download and store documents for an applicant
 */
async function storeApplicantDocuments(applicantId, userId = null) {
  try {
    console.log(`Downloading documents for applicant ${applicantId}`);
    
    // Get document info
    const docsEndpoint = `/resources/applicants/${applicantId}/info/idDocs`;
    const docsData = await makeSumsubRequest('GET', docsEndpoint);
    
    console.log(`Found ${docsData.docs?.length || 0} documents for applicant ${applicantId}`);
    
    if (!docsData.docs || docsData.docs.length === 0) {
      return { success: true, count: 0, documents: [] };
    }
    
    // Create folder structure
    const folders = await createDateBasedFolderStructure(applicantId);
    
    // Track stored documents
    const documents = [];
    
    // Process each document
    for (const doc of docsData.docs) {
      try {
        // Create document type folder
        const docTypeDir = path.join(folders.applicantDir, doc.idDocType);
        await fs.mkdir(docTypeDir, { recursive: true });
        
        // Process each page
        for (const page of doc.pages || []) {
          if (page.fileId) {
            try {
              // Download the file
              const fileEndpoint = `/resources/applicants/${applicantId}/info/idDocs/${doc.idDocType}/files/${page.fileId}`;
              const fileData = await makeSumsubRequest('GET', fileEndpoint, null, null, true);
              
              if (!fileData || fileData.length === 0) {
                console.warn(`Empty file data for fileId: ${page.fileId}`);
                continue;
              }
              
              // Determine file extension
              let extension = 'jpg';  // default
              if (page.mimeType) {
                if (page.mimeType.includes('png')) extension = 'png';
                else if (page.mimeType.includes('pdf')) extension = 'pdf';
              }
              
              // Create filename
              const fileName = `${doc.idDocType}_${page.type || 'page'}_${page.fileId}.${extension}`;
              const filePath = path.join(docTypeDir, fileName);
              
              // Save the file with error handling
              try {
                await fs.writeFile(filePath, fileData);
              } catch (writeError) {
                console.error(`Error writing file ${fileName}: ${writeError.message}`);
                throw writeError;
              }
              
              // Create relative path for database
              const relativePath = path.join(folders.datePath, doc.idDocType, fileName);
              
              // Store in database
              const documentRecord = await prisma.kycDocument.upsert({
                where: { fileId: page.fileId },
                update: {
                  filePath: relativePath,
                  fileName,
                  fileSize: fileData.length,
                  userId: userId
                },
                create: {
                  applicantId,
                  documentType: doc.idDocType,
                  documentSide: page.type || 'unknown',
                  fileId: page.fileId,
                  mimeType: page.mimeType || `image/${extension}`,
                  filePath: relativePath,
                  fileName,
                  fileSize: fileData.length,
                  yearFolder: folders.year,
                  monthFolder: folders.month,
                  dayFolder: folders.day,
                  userId: userId
                }
              });
              
              documents.push(documentRecord);
              console.log(`Saved document: ${fileName} for applicant ${applicantId}`);
            } catch (pageError) {
              console.error(`Error processing page with fileId ${page.fileId}: ${pageError.message}`);
              // Continue with other pages
            }
          }
        }
      } catch (docError) {
        console.error(`Error processing document ${doc.idDocType}: ${docError.message}`);
        // Continue with other documents
      }
    }
    
    return { 
      success: true, 
      count: documents.length, 
      documents 
    };
  } catch (error) {
    console.error(`Error downloading documents: ${error.message}`);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

module.exports = {
  makeSumsubRequest,
  storeApplicantDocuments
};
