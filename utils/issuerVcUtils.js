/**
 * Utility functions for issuing verifiable credentials to issuers
 */
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createWallet } = require('./crossmintUtils');

// Constants from environment variables
const API_KEY = process.env.CROSSMINT_API_KEY || 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';
const BASE_URL = 'https://staging.crossmint.com/api';
const COLLECTION_ID = process.env.COLLECTION_ID || '9ead4bd2-b0bb-45c9-957c-a640752d0c68';
const TEMPLATE_ID = process.env.TEMPLATE_ID || '1fb3506d-38cd-4fcb-95b9-b8aabef80797';

/**
 * Create wallet for issuer if one doesn't exist
 * @param {string} issuerId - The issuer ID
 * @param {number} userId - The user ID associated with the issuer
 * @returns {Promise<Object>} - Wallet information
 */
async function ensureIssuerWallet(issuerId, userId) {
  console.log(`Ensuring wallet exists for issuer: ${issuerId}, user: ${userId}`);
  
  // Check if wallet already exists
  const existingWallet = await prisma.wallet.findFirst({
    where: { user_id: userId }
  });

  if (existingWallet) {
    console.log(`Wallet already exists for issuer ${issuerId}:`, existingWallet.address);
    return existingWallet;
  }

  // Create new wallet
  console.log(`Creating new wallet for issuer ${issuerId}`);
  const walletResult = await createWallet(userId, true);
  
  if (!walletResult.success) {
    throw new Error(`Failed to create wallet: ${walletResult.error}`);
  }
  
  console.log(`Created wallet for issuer ${issuerId}:`, walletResult.data.address);
  return walletResult.data.wallet;
}

/**
 * Issue verifiable credential to issuer after KYC verification
 * @param {string} issuerId - The issuer ID
 * @returns {Promise<Object>} - Credential information
 */
async function issueVerificationCredential(issuerId) {
  console.log(`Issuing verification credential to issuer: ${issuerId}`);
  
  try {
    // Find the issuer and associated wallet
    const issuer = await prisma.issuer.findFirst({
      where: { id: issuerId },
      include: {
        users: {
          include: {
            wallet: true
          }
        }
      }
    });

    if (!issuer) {
      throw new Error(`Issuer not found with ID: ${issuerId}`);
    }

    if (!issuer.verification_status) {
      throw new Error(`Issuer ${issuerId} is not verified yet`);
    }

    // Ensure wallet exists
    let wallet = issuer.users.wallet;
    if (!wallet) {
      wallet = await ensureIssuerWallet(issuerId, issuer.user_id);
    }

    const walletAddress = wallet.address;
    const chain = 'ethereum-sepolia'; // Using specified chain
    const recipient = `${chain}:${walletAddress}`;

    console.log(`Issuing credential to ${recipient}`);
    
    // Current date and expiration date (1 year from now)
    const currentDate = new Date();
    const expirationDate = new Date(currentDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    // Try using NFT minting endpoint with collection ID
    try {
      console.log(`Using NFT minting endpoint with collection ID: ${COLLECTION_ID}`);
      
      const response = await axios({
        method: 'POST',
        url: `${BASE_URL}/2022-06-09/collections/${COLLECTION_ID}/nfts`,
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY
        },
        data: {
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
                value: currentDate.toISOString().split('T')[0]
              },
              {
                trait_type: "Expiration Date",
                value: expirationDate.toISOString().split('T')[0]
              },
              {
                trait_type: "Issuer ID",
                value: issuerId
              },
              {
                trait_type: "Company Name",
                value: issuer.company_name || "Verified Company"
              }
            ]
          },
          recipient: recipient
        }
      });
      
      console.log('NFT endpoint response:', response.data);
      
      // Store the credential record
      const credentialRecord = await prisma.issuer_credentials.create({
        data: {
          issuer_id: issuerId,
          credential_id: response.data.id || 'unknown',
          credential_type: 'VERIFICATION',
          issued_date: new Date(),
          expiry_date: expirationDate,
          status: 'ACTIVE',
          metadata: JSON.stringify(response.data),
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      
      return {
        success: true,
        message: 'Credential issued successfully via NFT endpoint',
        id: response.data.id,
        actionId: response.data.actionId || response.data.id,
        credentialRecord
      };
    } catch (nftError) {
      console.error('Error using NFT minting endpoint:', nftError.response?.data || nftError.message);
      console.log('Trying alternative approach with VC template endpoint...');
      
      // If NFT minting fails, try the VC template endpoint as a backup
      try {
        console.log(`Using VC template endpoint with template ID: ${TEMPLATE_ID}`);
        
        const response = await axios({
          method: 'POST',
          url: `${BASE_URL}/v1-alpha1/credentials/templates/${TEMPLATE_ID}/vcs`,
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': API_KEY
          },
          data: {
            recipient,
            sendNotification: true,
            locale: 'en-US',
            metadata: {
              name: "Issuer Verification Credential",
              description: "Verifiable credential confirming issuer KYC verification",
              image: "https://www.crossmint.com/assets/crossmint/logo.png",
              attributes: [
                {
                  trait_type: "Verification Type",
                  value: "Issuer Verification"
                },
                {
                  trait_type: "Issue Date",
                  value: currentDate.toISOString().split('T')[0]
                },
                {
                  trait_type: "Company Name",
                  value: issuer.company_name || "Verified Company"
                }
              ]
            },
            credential: {
              subject: {
                entityName: issuer.company_name || "Verified Company",
                entityId: issuerId,
                jurisdictionOfIncorporation: issuer.jurisdiction || "Unknown",
                verificationDate: currentDate.toISOString().split('T')[0],
                verificationStatus: "VERIFIED"
              },
              expiresAt: expirationDate.toISOString()
            }
          }
        });
        
        console.log('VC template endpoint response:', response.data);
        
        // Store the credential record
        const credentialRecord = await prisma.issuer_credentials.create({
          data: {
            issuer_id: issuerId,
            credential_id: response.data.id || 'unknown',
            credential_type: 'VERIFICATION',
            issued_date: new Date(),
            expiry_date: expirationDate,
            status: 'ACTIVE',
            metadata: JSON.stringify(response.data),
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        
        return {
          success: true,
          message: 'Verifiable credential issued successfully via template',
          id: response.data.id,
          actionId: response.data.actionId || response.data.id,
          credentialRecord
        };
      } catch (vcError) {
        console.error('Error using VC template endpoint:', vcError.response?.data || vcError.message);
        
        // Check for specific error messages and provide clear feedback
        const errorMessage = vcError.response?.data?.message || vcError.message;
        
        if (errorMessage.includes('not found')) {
          throw new Error(`Template or collection not found. Template ID: ${TEMPLATE_ID}, Collection ID: ${COLLECTION_ID}. Please verify these IDs in the Crossmint console.`);
        } else if (errorMessage.includes('invalid recipient')) {
          throw new Error(`Invalid recipient format: ${recipient}. Please check the chain and wallet address.`);
        } else if (errorMessage.includes('unauthorized')) {
          throw new Error(`API key unauthorized. Please check your Crossmint API key permissions.`);
        } else {
          throw new Error(`Failed to issue credential: ${errorMessage}`);
        }
      }
    }
  } catch (error) {
    console.error('Error issuing verification credential:', error);
    return {
      success: false,
      error: error.message,
      details: error.response?.data || error.stack
    };
  }
}

/**
 * Check credential issuance status
 * @param {string} actionId - The action ID returned from credential issuance
 * @returns {Promise<Object>} - Status information
 */
async function checkCredentialStatus(actionId) {
  try {
    console.log(`Checking credential status for action ID: ${actionId}`);
    
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}/2022-06-09/actions/${actionId}`,
      headers: {
        'X-API-KEY': API_KEY
      }
    });
    
    console.log(`Status for credential ${actionId}: ${response.data.status}`);
    
    return {
      success: true,
      status: response.data.status,
      data: response.data
    };
  } catch (error) {
    console.error(`Error checking credential status for ${actionId}:`, error);
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

module.exports = {
  ensureIssuerWallet,
  issueVerificationCredential,
  checkCredentialStatus
}; 