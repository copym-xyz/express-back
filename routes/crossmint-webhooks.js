/**
 * Crossmint webhook handler
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// Webhook secret from environment variable
const WEBHOOK_SECRET = process.env.CROSSMINT_WEBHOOK_SECRET || 'whsec_wnSCMaGf3uCDYpdXciDBZB30IEMCWt8E';

// Test route to verify the router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Crossmint webhook router is working' });
});

// Add logging middleware
router.use((req, res, next) => {
  console.log(`Webhook request received: ${req.method} ${req.originalUrl}`);
  console.log('Headers:', JSON.stringify(req.headers));
  next();
});

/**
 * Verify the webhook signature from Crossmint
 * @param {string} signature - The signature from X-Webhook-Signature header
 * @param {string} payload - The raw request body
 * @returns {boolean} - Whether the signature is valid
 */
function verifySignature(signature, payload) {
  if (!signature || !payload) return false;
  
  try {
    // Compute the expected signature
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const expectedSignature = hmac.update(payload).digest('hex');
    
    console.log('Expected signature:', expectedSignature);
    console.log('Received signature:', signature);
    
    // Check if the signature matches directly
    if (signature === expectedSignature) {
      return true;
    }
    
    // Some webhook providers prefix the signature with t=timestamp,v1=
    // Try to extract the actual signature if it contains a comma
    if (signature.includes(',')) {
      const parts = signature.split(',');
      for (const part of parts) {
        if (part.startsWith('v1=')) {
          const extractedSignature = part.substring(3);
          console.log('Extracted signature:', extractedSignature);
          
          if (extractedSignature === expectedSignature) {
            return true;
          }
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Generate an SVG image for the NFT
 * @param {Object} nftData - The NFT data
 * @param {string} issuerName - Name of the issuer
 * @returns {string} - SVG image content as a data URL
 */
function generateNftSvg(nftData, issuerName) {
  // Get data from NFT or use defaults
  const companyName = issuerName || 'Verified Issuer';
  const issueDate = new Date().toISOString().split('T')[0];
  
  // Create a unique pattern based on the credential ID
  const nftId = nftData.nft?.id || nftData.tokenId || nftData.id || '';
  const pattern = nftId.substring(0, 6); // Use first 6 characters for pattern
  
  // Pick colors based on the pattern
  const hash = crypto.createHash('md5').update(pattern).digest('hex');
  const primaryColor = `#${hash.substring(0, 6)}`;
  const secondaryColor = `#${hash.substring(6, 12)}`;
  
  // Create SVG
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.7" />
        <stop offset="100%" stop-color="${secondaryColor}" stop-opacity="0.7" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3" />
      </filter>
    </defs>
    <rect width="400" height="400" rx="20" fill="url(#bgGradient)" />
    <circle cx="200" cy="130" r="50" fill="white" opacity="0.9" filter="url(#shadow)" />
    <text x="200" y="150" text-anchor="middle" font-family="Arial, sans-serif" font-size="50" font-weight="bold" fill="${secondaryColor}">✓</text>
    <rect x="50" y="200" width="300" height="150" rx="10" fill="white" opacity="0.9" filter="url(#shadow)" />
    <text x="200" y="235" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#333">Verified Issuer</text>
    <text x="200" y="265" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#555">${companyName}</text>
    <text x="200" y="295" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#777">Issued: ${issueDate}</text>
    <text x="200" y="325" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#999">ID: ${nftId}</text>
  </svg>
  `;
  
  // Convert to data URL
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Update the wallet with NFT information
 * @param {Object} nftData - The NFT data from the webhook
 */
async function updateWalletWithNFT(nftData) {
  try {
    console.log('Processing NFT webhook data:', JSON.stringify(nftData, null, 2));
    
    // Extract NFT and transaction information more thoroughly
    const nftId = nftData.nft?.id || nftData.tokenId || nftData.id;
    const transactionHash = nftData.onChain?.transactionHash || nftData.transaction?.hash || nftData.hash;
    
    // Make sure we get the chain information from all possible locations
    let chain = nftData.onChain?.chain || nftData.chain;
    if (!chain && nftData.recipient && nftData.recipient.includes(':')) {
      chain = nftData.recipient.split(':')[0];
    }
    
    // Get contract address from all possible locations
    const contractAddress = nftData.onChain?.contractAddress || 
                           nftData.contractAddress || 
                           nftData.contract?.address || 
                           nftData.metadata?.contract_address;
    
    const tokenId = nftData.onChain?.tokenId || nftData.tokenId;
    const recipient = nftData.recipient || nftData.to || '';
    
    if (!nftId) {
      console.error('Missing NFT ID in webhook data');
      return false;
    }
    
    console.log(`Processing NFT ${nftId} for recipient ${recipient}`);
    console.log(`Chain: ${chain}, Contract: ${contractAddress}, TokenId: ${tokenId}`);
    
    // Extract wallet address from recipient (format: chain:address or email:email:chain)
    let walletAddress = null;
    if (recipient) {
      const parts = recipient.split(':');
      
      if (parts.length === 2 && parts[0] !== 'email') {
        // Format: chain:address
        walletAddress = parts[1];
      } else if (parts.length === 3 && parts[0] === 'email') {
        // Try to find the wallet by email
        const email = parts[1];
        console.log(`Looking for wallet by email: ${email}`);
        
        const user = await prisma.users.findFirst({
          where: { email }
        });
        
        if (user) {
          const userWallet = await prisma.wallet.findFirst({
            where: { user_id: user.id }
          });
          
          if (userWallet) {
            walletAddress = userWallet.address;
          }
        }
      }
    }
    
    if (!walletAddress) {
      console.log('Could not extract wallet address from recipient, trying to find issuers');
      
      // Find any issuer wallet if there's a token ID
      if (tokenId) {
        const issuers = await prisma.issuer.findMany({});
        
        console.log(`Found ${issuers.length} issuers`);
        if (issuers.length > 0) {
          const issuer = issuers[0];
          const wallet = await prisma.wallet.findFirst({
            where: { 
              OR: [
                { user_id: issuer.user_id },
                { issuer_id: issuer.id }
              ]
            }
          });
          
          if (wallet) {
            walletAddress = wallet.address;
            console.log(`Using issuer wallet address: ${walletAddress}`);
          }
        }
      }
    }
    
    if (!walletAddress) {
      console.error('Could not determine wallet address for NFT');
      return false;
    }
    
    // Find the wallet by address
    const wallet = await prisma.wallet.findFirst({
      where: { address: walletAddress }
    });
    
    if (!wallet) {
      console.error(`No wallet found for address ${walletAddress}`);
      return false;
    }
    
    // Find the issuer associated with this wallet
    const issuer = await prisma.issuer.findFirst({
      where: { 
        OR: [
          { user_id: wallet.user_id },
          { id: wallet.issuer_id }
        ]
      }
    });
    
    if (!issuer) {
      console.error(`No issuer found for wallet ${wallet.id}`);
      return false;
    }
    
    console.log(`Found issuer ${issuer.id} for NFT ${nftId}`);
    
    // Extract image URL from metadata if available
    let imageUrl = null;
    if (nftData.metadata?.image) {
      imageUrl = nftData.metadata.image;
    } else if (nftData.image) {
      imageUrl = nftData.image;
    }
    
    // If no image provided, generate an SVG
    if (!imageUrl) {
      console.log('No image found in data, generating SVG');
      imageUrl = generateNftSvg(nftData, issuer.company_name);
    }
    
    // Check if credential record already exists for this NFT
    const existingCredential = await prisma.issuer_credentials.findFirst({
      where: { credential_id: nftId }
    });
    
    if (existingCredential) {
      // Update the existing credential with on-chain data
      await prisma.issuer_credentials.update({
        where: { id: existingCredential.id },
        data: {
          status: 'ACTIVE',
          transaction_hash: transactionHash,
          token_id: tokenId,
          contract_address: contractAddress,
          chain: chain,
          image_url: imageUrl,
          updated_at: new Date()
        }
      });
      
      console.log(`Updated existing credential record ${existingCredential.id} for NFT ${nftId}`);
      return true;
    }
    
    // Create a new credential record
    const newCredential = await prisma.issuer_credentials.create({
      data: {
        issuer_id: issuer.id,
        credential_id: nftId,
        credential_type: 'VERIFICATION',
        transaction_hash: transactionHash,
        token_id: tokenId,
        contract_address: contractAddress,
        status: 'ACTIVE',
        chain: chain,
        image_url: imageUrl,
        issued_date: new Date(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
        metadata: JSON.stringify(nftData),
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    console.log(`Created new credential record ${newCredential.id} for NFT ${nftId}`);
    return true;
  } catch (error) {
    console.error('Error updating wallet with NFT:', error);
    return false;
  }
}

// Webhook handler for Crossmint events
router.post('/', express.json(), async (req, res) => {
  try {
    console.log('Received webhook payload:', JSON.stringify(req.body, null, 2));
    
    // Get the signature from the headers
    const signature = req.headers['x-webhook-signature'];
    const payload = req.body;
    const isTestEvent = payload.event && payload.event.includes('test');
    
    // Skip signature verification in development or for test events
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment || isTestEvent) {
      console.log('Development mode or test event - bypassing signature verification');
    } else if (!signature) {
      // Only enforce signature in production and for non-test events
      return res.status(400).json({ success: false, message: 'Missing signature header' });
    } else {
      // Verify signature in production
      const isValid = verifySignature(signature, JSON.stringify(payload));
      if (!isValid) {
        return res.status(403).json({ success: false, message: 'Invalid signature' });
      }
    }
    
    // Log receipt of the webhook
    try {
      await prisma.webhookLog.create({
        data: {
          type: payload.event || 'unknown',
          payload: JSON.stringify(payload).substring(0, 10000), // Truncate to avoid DB errors
          signature: signature || '',
          status: 'received',
          provider: 'crossmint',
          processed: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } catch (dbError) {
      console.error('Error storing webhook in database:', dbError);
      // Continue processing even if database storage fails
    }
    
    // Process different event types
    const eventType = payload.event?.replace('test-event-', '') || '';
    
    switch (eventType) {
      case 'nfts.create.succeeded':
        console.log('Processing NFT creation success event');
        await updateWalletWithNFT(payload.data);
        break;
        
      case 'credentials.issue.succeeded':
        console.log('Processing credential issuance success event');
        await updateWalletWithNFT(payload.data);
        break;
        
      case 'wallets.create.succeeded':
        // Handle wallet creation events if needed
        console.log('Wallet created successfully:', payload.data);
        break;
        
      default:
        console.log(`Unhandled event type: ${payload.event}`);
    }
    
    // Always return 200 to Crossmint
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing Crossmint webhook:', error);
    // Return 200 even on error to prevent retries
    res.status(200).json({ 
      success: false, 
      error: process.env.NODE_ENV === 'production' ? 
        'Internal server error' : error.message 
    });
  }
});

module.exports = router; 