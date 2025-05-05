const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// DID prefix configuration
const DID_PREFIXES = {
  'ethereum-sepolia': 'did:ethr:sepolia',
  'polygon-mumbai': 'did:polygon:mumbai',
  'base-sepolia': 'did:base:sepolia'
};

/**
 * Generate a DID (Decentralized Identifier) for an issuer
 * @param {number} userId - User ID
 * @returns {Promise<string>} Generated DID
 */
async function generateDIDForIssuer(userId) {
  try {
    // Get the issuer
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer) {
      throw new Error(`No issuer found for user ID ${userId}`);
    }
    
    // Check if the issuer already has a DID
    if (issuer.did) {
      console.log(`Issuer ${issuer.id} already has DID: ${issuer.did}`);
      return issuer.did;
    }
    
    // Get the wallet for this issuer
    const wallet = await prisma.wallet.findFirst({
      where: { 
        user_id: userId,
        is_active: true
      }
    });
    
    if (!wallet) {
      throw new Error(`No active wallet found for issuer with user ID ${userId}`);
    }
    
    // Generate DID based on chain and wallet address
    const prefix = DID_PREFIXES[wallet.chain] || 'did:web';
    const did = `${prefix}:${wallet.address}`;
    
    // Update the issuer record with the DID
    await prisma.issuer.update({
      where: { id: issuer.id },
      data: {
        did,
        did_created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    console.log(`Generated DID for issuer ${issuer.id}: ${did}`);
    return did;
  } catch (error) {
    console.error('Error generating DID for issuer:', error);
    throw error;
  }
}

/**
 * Verify a DID
 * @param {string} did - DID to verify
 * @returns {boolean} Whether DID is valid
 */
function verifyDID(did) {
  if (!did || typeof did !== 'string') return false;
  
  // Check DID format (did:method:specific-id)
  const didPattern = /^did:[a-z0-9]+:.+$/;
  return didPattern.test(did);
}

/**
 * Get DID method from DID
 * @param {string} did - DID
 * @returns {string|null} DID method or null
 */
function getDIDMethod(did) {
  if (!verifyDID(did)) return null;
  
  const parts = did.split(':');
  return parts.length >= 2 ? parts[1] : null;
}

/**
 * Generate all DIDs for issuers without DIDs
 * @returns {Promise<Array>} Generated DIDs
 */
async function generateAllDIDs() {
  try {
    // Get all issuers without DIDs
    const issuers = await prisma.issuer.findMany({
      where: {
        OR: [
          { did: null },
          { did: '' }
        ]
      },
      select: {
        id: true,
        user_id: true,
        company_name: true
      }
    });
    
    console.log(`Found ${issuers.length} issuers without DIDs`);
    
    const results = [];
    
    // Generate DID for each issuer
    for (const issuer of issuers) {
      try {
        const did = await generateDIDForIssuer(issuer.user_id);
        results.push({
          issuerId: issuer.id,
          userId: issuer.user_id,
          did,
          success: true
        });
      } catch (error) {
        console.error(`Error generating DID for issuer ${issuer.id}:`, error);
        results.push({
          issuerId: issuer.id,
          userId: issuer.user_id,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error generating all DIDs:', error);
    throw error;
  }
}

module.exports = {
  generateDIDForIssuer,
  generateAllDIDs,
  verifyDID,
  getDIDMethod
}; 