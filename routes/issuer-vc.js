/**
 * API routes for issuing verifiable credentials to issuers
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const { authenticateJWT } = require('../middleware/auth');

// Constants from environment variables
const API_KEY = process.env.CROSSMINT_API_KEY || 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';
const BASE_URL = 'https://staging.crossmint.com/api';

// Define collection and template IDs for different chains
const CHAIN_CONFIG = {
  'ethereum-sepolia': {
    COLLECTION_ID: process.env.ETH_COLLECTION_ID || '9ead4bd2-b0bb-45c9-957c-a640752d0c68',
    TEMPLATE_ID: process.env.ETH_TEMPLATE_ID || '1fb3506d-38cd-4fcb-95b9-b8aabef80797'
  },
  'polygon-amoy': {
    COLLECTION_ID: process.env.POLYGON_COLLECTION_ID || '', // Add your Polygon collection ID here
    TEMPLATE_ID: process.env.POLYGON_TEMPLATE_ID || ''     // Add your Polygon template ID here
  }
};

const TYPE_ID = process.env.CREDENTIAL_TYPE_ID || 'crossmint:883f05c8-c651-417e-bdc2-6cd3a7ffe8dd:KYCVerification1745921157234';

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Issuer VC routes are working' });
});

/**
 * Issue/mint a verifiable credential for the issuer
 * Performs validation and issues a VC via Crossmint
 */
router.post('/', authenticateJWT, async (req, res) => {
  try {
    console.log('Issue-VC endpoint called');
    
    // Get the issuer for this user
    const userId = req.user.id;
    console.log(`Finding issuer for user ID: ${userId}`);
    
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer) {
      return res.status(404).json({
        success: false,
        message: 'Issuer profile not found for this user'
      });
    }
    
    console.log(`Found issuer profile: ${issuer.id}, Company: ${issuer.company_name}`);
    
    // Verify the issuer has been verified - check both possible field names
    console.log(`Verification status: is_verified=${issuer.is_verified}, verification_status=${issuer.verification_status}`);
    if (!issuer.is_verified && !issuer.verification_status) {
      return res.status(403).json({
        success: false,
        message: 'Issuer must complete verification before issuing credentials'
      });
    }
    
    // Get the issuer's wallet
    const wallet = await prisma.wallet.findFirst({
      where: { user_id: userId }
    });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found for this issuer'
      });
    }
    
    // Get the chain from request or use default
    const chain = req.body.chain || wallet.chain || 'ethereum-sepolia';
    console.log(`Using wallet address: ${wallet.address} on chain: ${chain}`);
    
    // Format recipient address as chain:address
    const recipient = `${chain}:${wallet.address}`;
    
    // Get collection ID for the chain
    let COLLECTION_ID;
    let TEMPLATE_ID;
    
    // Choose collection and template based on chain
    if (chain === 'ethereum-sepolia') {
      COLLECTION_ID = process.env.ETH_COLLECTION_ID || '9ead4bd2-b0bb-45c9-957c-a640752d0c68';
      TEMPLATE_ID = process.env.ETH_TEMPLATE_ID || '1fb3506d-38cd-4fcb-95b9-b8aabef80797';
    } else if (chain === 'polygon-amoy') {
      COLLECTION_ID = process.env.POLYGON_COLLECTION_ID;
      TEMPLATE_ID = process.env.POLYGON_TEMPLATE_ID;
    }
    
    // If no collection ID for the chain
    if (!COLLECTION_ID) {
      return res.status(400).json({
        success: false,
        message: `No collection ID configured for chain: ${chain}`
      });
    }
    
    console.log(`Using collection ID: ${COLLECTION_ID} for chain: ${chain}`);
    
    // Set up dates
    const currentDate = new Date();
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1); // 1 year expiry
    
    console.log(`Making Crossmint API request to mint NFT to: ${recipient}`);
    console.log(`Using collection ID: ${COLLECTION_ID}`);
    
    try {
      // First try to use the credentials API endpoint (v1-alpha1)
      console.log(`Using template ID: ${TEMPLATE_ID} for chain: ${chain}`);
      console.log(`Making Crossmint API request to issue credential to: ${recipient}`);

      const response = await axios({
        method: 'POST',
        url: `${BASE_URL}/v1-alpha1/credentials/collections/${COLLECTION_ID}/vcs`,
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
                value: issuer.company_name
              }
            ]
          },
          credential: {
            subject: {
              entityName: issuer.company_name,
              entityId: issuer.id,
              jurisdictionOfIncorporation: issuer.jurisdiction || 'Unknown',
              verificationDate: currentDate.toISOString().split('T')[0],
              verificationStatus: "VERIFIED"
            },
            expiresAt: expirationDate.toISOString()
          }
        }
      });

      console.log('Credential issued successfully:', response.data);
      console.log('Storing credential record in database');

      // Store the credential record with minimal fields to avoid prisma errors
      const credentialRecord = await prisma.issuer_credentials.create({
        data: {
          issuer_id: issuer.id,
          credential_id: response.data.id || 'unknown',
          credential_type: 'VERIFICATION',
          issued_date: new Date(),
          expiry_date: expirationDate,
          status: 'ACTIVE',
          metadata: JSON.stringify(response.data)
        }
      });

      console.log(`Credential record created with ID: ${credentialRecord.id}`);

      return res.json({
        success: true,
        message: 'Verifiable credential issued successfully',
        id: response.data.id,
        actionId: response.data.actionId || response.data.id
      });
    } catch (credentialsError) {
      console.error('Credentials API error, falling back to NFT API:', credentialsError.message);
      
      // If credentials API fails, try the NFT API
      try {
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
                value: currentDate.toISOString().split('T')[0]
              },
              {
                trait_type: "Expiration Date",
                value: expirationDate.toISOString().split('T')[0]
              },
              {
                trait_type: "Issuer ID",
                value: issuer.id
              },
              {
                trait_type: "Company Name",
                value: issuer.company_name
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
  
        console.log('NFT minted successfully:', nftResponse.data);
        console.log('Storing credential record in database');
  
        // Store the credential record with minimal fields to avoid prisma errors
        const credentialRecord = await prisma.issuer_credentials.create({
          data: {
            issuer_id: issuer.id,
            credential_id: nftResponse.data.id || 'unknown',
            credential_type: 'VERIFICATION',
            issued_date: new Date(),
            expiry_date: expirationDate,
            status: 'ACTIVE',
            metadata: JSON.stringify(nftResponse.data)
          }
        });
  
        console.log(`Credential record created with ID: ${credentialRecord.id}`);
  
        return res.json({
          success: true,
          message: 'Credential issued successfully as NFT',
          id: nftResponse.data.id,
          actionId: nftResponse.data.id
        });
      } catch (nftError) {
        console.error('NFT API error too:', nftError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to issue credential',
          error: process.env.NODE_ENV === 'production' ? 
            'Service unavailable' : nftError.message
        });
      }
    }
  } catch (error) {
    console.error('Error issuing credential:', error);
    return res.status(500).json({
      success: false, 
      message: 'Failed to issue credential',
      error: process.env.NODE_ENV === 'production' ? 
        'Internal server error' : error.message
    });
  }
});

// For backward compatibility, add a route for the endpoint the frontend is calling
router.post('/issue-vc', authenticateJWT, async (req, res) => {
  // Reuse the same handler as the root route
  try {
    console.log('Issue-VC compatibility endpoint called');
    
    // Get the issuer for this user
    const userId = req.user.id;
    console.log(`Finding issuer for user ID: ${userId}`);
    
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer) {
      return res.status(404).json({
        success: false,
        message: 'Issuer profile not found for this user'
      });
    }
    
    console.log(`Found issuer profile: ${issuer.id}, Company: ${issuer.company_name}`);
    
    // Verify the issuer has been verified - check both possible field names
    console.log(`Verification status: is_verified=${issuer.is_verified}, verification_status=${issuer.verification_status}`);
    if (!issuer.is_verified && !issuer.verification_status) {
      return res.status(403).json({
        success: false,
        message: 'Issuer must complete verification before issuing credentials'
      });
    }
    
    // Get the issuer's wallet
    const wallet = await prisma.wallet.findFirst({
      where: { user_id: userId }
    });
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found for this issuer'
      });
    }
    
    // Get the chain from request or use default
    const chain = req.body.chain || wallet.chain || 'ethereum-sepolia';
    console.log(`Using wallet address: ${wallet.address} on chain: ${chain}`);
    
    // Format recipient address as chain:address
    const recipient = `${chain}:${wallet.address}`;
    
    // Get collection ID for the chain
    let COLLECTION_ID;
    let TEMPLATE_ID;
    
    // Choose collection and template based on chain
    if (chain === 'ethereum-sepolia') {
      COLLECTION_ID = process.env.ETH_COLLECTION_ID || '9ead4bd2-b0bb-45c9-957c-a640752d0c68';
      TEMPLATE_ID = process.env.ETH_TEMPLATE_ID || '1fb3506d-38cd-4fcb-95b9-b8aabef80797';
    } else if (chain === 'polygon-amoy') {
      COLLECTION_ID = process.env.POLYGON_COLLECTION_ID;
      TEMPLATE_ID = process.env.POLYGON_TEMPLATE_ID;
    }
    
    // If no collection ID for the chain
    if (!COLLECTION_ID) {
      return res.status(400).json({
        success: false,
        message: `No collection ID configured for chain: ${chain}`
      });
    }
    
    console.log(`Using collection ID: ${COLLECTION_ID} for chain: ${chain}`);
    
    // Set up dates
    const currentDate = new Date();
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1); // 1 year expiry
    
    console.log(`Making Crossmint API request to mint NFT to: ${recipient}`);
    console.log(`Using collection ID: ${COLLECTION_ID}`);
    
    try {
      // First try to use the credentials API endpoint (v1-alpha1)
      console.log(`Using template ID: ${TEMPLATE_ID} for chain: ${chain}`);
      console.log(`Making Crossmint API request to issue credential to: ${recipient}`);

      const response = await axios({
        method: 'POST',
        url: `${BASE_URL}/v1-alpha1/credentials/collections/${COLLECTION_ID}/vcs`,
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
                value: issuer.company_name
              }
            ]
          },
          credential: {
            subject: {
              entityName: issuer.company_name,
              entityId: issuer.id,
              jurisdictionOfIncorporation: issuer.jurisdiction || 'Unknown',
              verificationDate: currentDate.toISOString().split('T')[0],
              verificationStatus: "VERIFIED"
            },
            expiresAt: expirationDate.toISOString()
          }
        }
      });

      console.log('Credential issued successfully:', response.data);
      console.log('Storing credential record in database');

      // Store the credential record with minimal fields to avoid prisma errors
      const credentialRecord = await prisma.issuer_credentials.create({
        data: {
          issuer_id: issuer.id,
          credential_id: response.data.id || 'unknown',
          credential_type: 'VERIFICATION',
          issued_date: new Date(),
          expiry_date: expirationDate,
          status: 'ACTIVE',
          metadata: JSON.stringify(response.data)
        }
      });

      console.log(`Credential record created with ID: ${credentialRecord.id}`);

      return res.json({
        success: true,
        message: 'Verifiable credential issued successfully',
        id: response.data.id,
        actionId: response.data.actionId || response.data.id
      });
    } catch (credentialsError) {
      console.error('Credentials API error, falling back to NFT API:', credentialsError.message);
      
      // If credentials API fails, try the NFT API
      try {
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
                value: currentDate.toISOString().split('T')[0]
              },
              {
                trait_type: "Expiration Date",
                value: expirationDate.toISOString().split('T')[0]
              },
              {
                trait_type: "Issuer ID",
                value: issuer.id
              },
              {
                trait_type: "Company Name",
                value: issuer.company_name
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
  
        console.log('NFT minted successfully:', nftResponse.data);
        console.log('Storing credential record in database');
  
        // Store the credential record with minimal fields to avoid prisma errors
        const credentialRecord = await prisma.issuer_credentials.create({
          data: {
            issuer_id: issuer.id,
            credential_id: nftResponse.data.id || 'unknown',
            credential_type: 'VERIFICATION',
            issued_date: new Date(),
            expiry_date: expirationDate,
            status: 'ACTIVE',
            metadata: JSON.stringify(nftResponse.data)
          }
        });
  
        console.log(`Credential record created with ID: ${credentialRecord.id}`);
  
        return res.json({
          success: true,
          message: 'Credential issued successfully as NFT',
          id: nftResponse.data.id,
          actionId: nftResponse.data.id
        });
      } catch (nftError) {
        console.error('NFT API error too:', nftError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to issue credential',
          error: process.env.NODE_ENV === 'production' ? 
            'Service unavailable' : nftError.message
        });
      }
    }
  } catch (error) {
    console.error('Error issuing credential:', error);
    return res.status(500).json({
      success: false, 
      message: 'Failed to issue credential',
      error: process.env.NODE_ENV === 'production' ? 
        'Internal server error' : error.message
    });
  }
});

module.exports = router; 