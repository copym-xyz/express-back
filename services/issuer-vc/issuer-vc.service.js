const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { generateCredentialSvg } = require('../../utils/svgGenerator');

const prisma = new PrismaClient();

// Constants from environment variables
const API_KEY = process.env.CROSSMINT_API_KEY || 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';
const BASE_URL = 'https://staging.crossmint.com/api';

// Define template and collection IDs for different chains
const CHAIN_CONFIG = {
  'ethereum-sepolia': {
    COLLECTION_ID: process.env.ETH_COLLECTION_ID || '9ead4bd2-b0bb-45c9-957c-a640752d0c68',
    TEMPLATE_ID: process.env.ETH_TEMPLATE_ID || '1fb3506d-38cd-4fcb-95b9-b8aabef80797'
  },
  'polygon-amoy': {
    COLLECTION_ID: process.env.POLYGON_COLLECTION_ID || '', 
    TEMPLATE_ID: process.env.POLYGON_TEMPLATE_ID || ''
  }
};

const TYPE_ID = process.env.CREDENTIAL_TYPE_ID || 'crossmint:883f05c8-c651-417e-bdc2-6cd3a7ffe8dd:KYCVerification1745921157234';

/**
 * Issuer VC Service - Contains business logic for issuer verifiable credentials
 */
class IssuerVcService {
  /**
   * Issue/mint a verifiable credential for the issuer
   * @param {number} userId - User ID
   * @param {object} data - Request data
   * @returns {Promise<object>} Result of credential issuance
   */
  async issueCredential(userId, data = {}) {
    // Get the issuer for this user
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer) {
      throw new Error('Issuer profile not found for this user');
    }
    
    // Verify the issuer has been verified
    if (!issuer.verification_status) {
      throw new Error('Issuer must complete verification before issuing credentials');
    }
    
    // Get the issuer's wallet
    const wallet = await prisma.wallet.findFirst({
      where: { user_id: userId }
    });
    
    if (!wallet) {
      throw new Error('Wallet not found for this issuer');
    }
    
    // Get the chain from request or use default
    const chain = data.chain || wallet.chain || 'ethereum-sepolia';
    
    // Format recipient address as chain:address
    const recipient = `${chain}:${wallet.address}`;
    
    // Choose template ID based on chain
    const { TEMPLATE_ID, COLLECTION_ID } = CHAIN_CONFIG[chain] || {};
    
    // Skip template API and go straight to NFT API since template is giving errors
    try {
      console.log(`Attempting to mint NFT using collection ID: ${COLLECTION_ID}`);
      const nftResponse = await axios.post(`${BASE_URL}/2022-06-09/collections/${COLLECTION_ID}/nfts`, {
        metadata: {
          name: "KYC Verification Credential",
          description: "Proof of successful KYC verification",
          image: "https://www.crossmint.com/assets/crossmint/logo.png",
          attributes: [
            {
              trait_type: "Verification Status",
              value: "Verified"
            },
            {
              trait_type: "Issued Date",
              value: new Date().toISOString().split('T')[0]
            },
            {
              trait_type: "Company Name",
              value: issuer.company_name
            },
            {
              trait_type: "Issuer ID",
              value: issuer.id.toString()
            },
            {
              trait_type: "Credential Type",
              value: "Issuer Verification"
            }
          ]
        },
        recipient: recipient,
        sendNotification: true,
        reuploadLinkedFiles: false
      }, {
        headers: {
          "X-API-KEY": API_KEY,
          "Content-Type": "application/json",
        }
      });

      // Store the credential record
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1); // 1 year expiry
      
      const credentialRecord = await this._saveCredentialRecord(issuer.id, nftResponse.data, expirationDate);

      return {
        success: true,
        message: 'Credential issued successfully as NFT',
        id: nftResponse.data.id,
        actionId: nftResponse.data.id
      };
    } catch (nftError) {
      console.error('NFT API error details:', nftError.response?.data || nftError.message);
      console.error('NFT API error:', nftError.message);
      throw new Error('Failed to issue credential: ' + (nftError.response?.data?.message || nftError.message));
    }
  }

  /**
   * Save credential record to database
   * @param {number} issuerId - Issuer ID
   * @param {object} responseData - API response data
   * @param {Date} expirationDate - Expiration date
   * @returns {Promise<object>} Created credential record
   * @private
   */
  async _saveCredentialRecord(issuerId, responseData, expirationDate) {
    return await prisma.issuer_credentials.create({
      data: {
        issuer_id: issuerId,
        credential_id: responseData.id || 'unknown',
        credential_type: 'VERIFICATION',
        issued_date: new Date(),
        expiry_date: expirationDate,
        status: 'ACTIVE',
        metadata: JSON.stringify(responseData)
      }
    });
  }
}

module.exports = new IssuerVcService(); 