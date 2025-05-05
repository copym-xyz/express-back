const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const { generateCredentialSvg } = require('../../utils/svgGenerator');

// Configuration
const WEBHOOK_SECRET = process.env.CROSSMINT_WEBHOOK_SECRET || 'whsec_wnSCMaGf3uCDYpdXciDBZB30IEMCWt8E';
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

/**
 * Crossmint Webhooks Service - Contains business logic for Crossmint webhook handling
 */
class CrossmintWebhooksService {
  /**
   * Verify the webhook signature from Crossmint
   * @param {string} signature - The signature from X-Webhook-Signature header
   * @param {string} payload - The raw request body
   * @returns {boolean} - Whether the signature is valid
   * @private
   */
  _verifySignature(signature, payload) {
    if (!signature || !payload) return false;
    
    try {
      // Compute the expected signature
      const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
      const expectedSignature = hmac.update(payload).digest('hex');
      
      // Check if the signature matches directly
      if (signature === expectedSignature) return true;
      
      // Extract signature if it's in t=timestamp,v1=signature format
      if (signature.includes(',')) {
        return signature.split(',')
          .some(part => part.startsWith('v1=') && 
                part.substring(3) === expectedSignature);
      }
      
      return false;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Log webhook data
   * @param {object} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {Promise<object>} Created log entry
   * @private
   */
  async _logWebhook(payload, signature) {
    try {
      const webhookLog = await prisma.webhookLog.create({
        data: {
          type: payload.type || 'unknown',
          provider: 'crossmint',
          status: 'received',
          payload: payload,
          signature: signature || '',
          created_at: new Date()
        }
      });
      
      console.log(`Webhook logged: ${webhookLog.id}`);
      return webhookLog;
    } catch (error) {
      console.error('Error logging webhook:', error);
      // Don't throw, just return null
      return null;
    }
  }

  /**
   * Update the wallet with NFT information
   * @param {Object} nftData - The NFT data from the webhook
   * @returns {Promise<boolean>} - Success status
   * @private
   */
  async _updateWalletWithNFT(nftData) {
    try {
      // Extract NFT and transaction information
      const nftId = nftData.nft?.id || nftData.tokenId || nftData.id;
      if (!nftId) {
        console.error('Missing NFT ID in webhook data');
        return false;
      }
      
      const transactionHash = nftData.onChain?.transactionHash || nftData.transaction?.hash || nftData.hash;
      
      // Get chain information
      let chain = nftData.onChain?.chain || nftData.chain;
      if (!chain && nftData.recipient && nftData.recipient.includes(':')) {
        chain = nftData.recipient.split(':')[0];
      }
      
      // Get contract address
      const contractAddress = nftData.onChain?.contractAddress || 
                            nftData.contractAddress || 
                            nftData.contract?.address || 
                            nftData.metadata?.contract_address;
      
      const tokenId = nftData.onChain?.tokenId || nftData.tokenId;
      const recipient = nftData.recipient || nftData.to || '';
      
      // Extract wallet address from recipient
      let walletAddress = await this._extractWalletAddress(recipient);
      
      // If no wallet address, try to find an issuer's wallet
      if (!walletAddress && tokenId) {
        walletAddress = await this._findIssuerWalletAddress();
      }
      
      if (!walletAddress) {
        console.error('Could not determine wallet address for NFT');
        return false;
      }
      
      // Find the wallet and associated issuer
      const wallet = await prisma.wallet.findFirst({ where: { address: walletAddress } });
      if (!wallet) {
        console.error(`No wallet found for address ${walletAddress}`);
        return false;
      }
      
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
      
      // Extract or generate image URL
      let imageUrl = nftData.metadata?.image || nftData.image;
      
      // If no image provided, generate an SVG
      if (!imageUrl) {
        imageUrl = generateCredentialSvg(nftData, issuer.company_name);
      }
      
      await this._upsertCredential(nftId, issuer.id, transactionHash, tokenId, contractAddress, chain, imageUrl, nftData);
      return true;
    } catch (error) {
      console.error('Error updating wallet with NFT:', error);
      return false;
    }
  }

  /**
   * Extract wallet address from recipient string
   * @param {string} recipient - The recipient identifier
   * @returns {Promise<string|null>} - The wallet address or null
   * @private
   */
  async _extractWalletAddress(recipient) {
    if (!recipient) return null;
    
    const parts = recipient.split(':');
    
    if (parts.length === 2 && parts[0] !== 'email') {
      // Format: chain:address
      return parts[1];
    } else if (parts.length === 3 && parts[0] === 'email') {
      // Try to find the wallet by email
      const email = parts[1];
      const user = await prisma.users.findFirst({ where: { email } });
      
      if (user) {
        const userWallet = await prisma.wallet.findFirst({ 
          where: { user_id: user.id } 
        });
        if (userWallet) return userWallet.address;
      }
    }
    return null;
  }

  /**
   * Find first issuer's wallet address
   * @returns {Promise<string|null>} - The wallet address or null
   * @private
   */
  async _findIssuerWalletAddress() {
    const issuers = await prisma.issuer.findMany({});
    
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
      
      return wallet?.address || null;
    }
    return null;
  }

  /**
   * Insert or update a credential record
   * @param {string} nftId - The NFT ID
   * @param {number} issuerId - The issuer ID
   * @param {string} transactionHash - The transaction hash
   * @param {string} tokenId - The token ID
   * @param {string} contractAddress - The contract address
   * @param {string} chain - The blockchain chain
   * @param {string} imageUrl - The image URL
   * @param {Object} nftData - The full NFT data
   * @private
   */
  async _upsertCredential(nftId, issuerId, transactionHash, tokenId, contractAddress, chain, imageUrl, nftData) {
    // Check if credential record already exists
    const existingCredential = await prisma.issuer_credentials.findFirst({
      where: { credential_id: nftId }
    });
    
    // Build metadata
    const metadata = {
      ...nftData,
      onChain: {
        chain,
        contractAddress,
        tokenId,
        transactionHash
      }
    };
    
    if (existingCredential) {
      // Update existing credential
      await prisma.issuer_credentials.update({
        where: { id: existingCredential.id },
        data: {
          status: 'ACTIVE',
          metadata: JSON.stringify(metadata),
          updated_at: new Date()
        }
      });
      console.log(`Updated existing credential: ${existingCredential.id}`);
    } else {
      // Create new credential record
      const credential = await prisma.issuer_credentials.create({
        data: {
          issuer_id: issuerId,
          credential_id: nftId,
          credential_type: this._getCredentialType(nftData),
          status: 'ACTIVE',
          issued_date: new Date(),
          expiry_date: this._calculateExpiryDate(nftData),
          image_url: imageUrl,
          contract_address: contractAddress,
          token_id: tokenId ? tokenId.toString() : null,
          chain,
          metadata: JSON.stringify(metadata),
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log(`Created new credential: ${credential.id}`);
    }
  }

  /**
   * Calculate expiry date for a credential
   * @param {Object} nftData - The NFT data
   * @returns {Date} - The expiry date
   * @private
   */
  _calculateExpiryDate(nftData) {
    // Try to find expiry in metadata
    if (nftData.metadata?.attributes) {
      const expiryAttr = nftData.metadata.attributes.find(
        attr => attr.trait_type === 'Expiry Date' || attr.trait_type === 'Expiration Date'
      );
      
      if (expiryAttr && expiryAttr.value) {
        try {
          return new Date(expiryAttr.value);
        } catch (e) {
          console.warn('Could not parse expiry date:', e);
        }
      }
    }
    
    // Default: 1 year from now
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    return expiryDate;
  }

  /**
   * Determine credential type from NFT data
   * @param {Object} nftData - The NFT data
   * @returns {string} - The credential type
   * @private
   */
  _getCredentialType(nftData) {
    // Try to find type in metadata
    if (nftData.metadata?.attributes) {
      const typeAttr = nftData.metadata.attributes.find(
        attr => attr.trait_type === 'Credential Type' || attr.trait_type === 'Type'
      );
      
      if (typeAttr && typeAttr.value) {
        return typeAttr.value.toUpperCase();
      }
    }
    
    // Check name for type indicators
    const name = nftData.metadata?.name || nftData.name || '';
    if (name.includes('KYC') || name.includes('Verification')) {
      return 'VERIFICATION';
    }
    
    return 'UNKNOWN';
  }

  /**
   * Process a Crossmint webhook
   * @param {object} data - Webhook payload
   * @param {string} signature - Webhook signature
   * @param {string} rawBody - Raw request body
   * @returns {Promise<object>} Processing result
   */
  async processWebhook(data, signature, rawBody) {
    // Verify the signature
    if (!this._verifySignature(signature, rawBody)) {
      console.warn('Invalid webhook signature');
      await this._logWebhook(data, signature); // Still log invalid requests
      throw new Error('Invalid webhook signature');
    }
    
    // Log the webhook
    const log = await this._logWebhook(data, signature);
    
    // Process by event type
    const event = data.type || 'unknown';
    let result = { success: true, event };
    
    try {
      switch (event) {
        case 'nft.minted':
        case 'nft.transferred':
          await this._updateWalletWithNFT(data);
          result.action = 'NFT processed';
          break;
          
        case 'collection.created':
          result.action = 'Collection received';
          break;
          
        default:
          result.action = 'Event logged';
      }
      
      // Mark the webhook as processed
      if (log) {
        await prisma.webhookLog.update({
          where: { id: log.id },
          data: { 
            processed: true,
            processed_at: new Date(),
            status: 'processed'
          }
        });
      }
      
      return result;
    } catch (error) {
      console.error(`Error processing webhook event ${event}:`, error);
      
      // Mark as failed in the database
      if (log) {
        await prisma.webhookLog.update({
          where: { id: log.id },
          data: { 
            processed: false,
            status: 'error',
            error_message: error.message
          }
        });
      }
      
      return {
        success: false,
        event,
        error: error.message
      };
    }
  }
}

module.exports = new CrossmintWebhooksService(); 