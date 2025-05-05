const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

/**
 * Webhooks Service - Contains business logic for webhook handling
 */
class WebhooksService {
  /**
   * Verify Crossmint webhook signature
   * @param {string} signature - Webhook signature
   * @param {string} body - Raw request body
   * @param {string} secret - Webhook secret
   * @returns {boolean} Whether signature is valid
   * @private
   */
  _verifySignature(signature, body, secret) {
    try {
      if (!signature || !secret) return false;
      
      const hmac = crypto.createHmac('sha256', secret)
        .update(body)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(`sha256=${hmac}`, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Log webhook in database
   * @param {string} type - Webhook type
   * @param {object} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @param {string} provider - Webhook provider
   * @param {boolean} processed - Whether webhook was processed
   * @returns {Promise<object>} Created webhook log
   * @private
   */
  async _logWebhook(type, payload, signature, provider, processed = false) {
    return await prisma.webhookLog.create({
      data: {
        type: type || 'unknown',
        payload,
        signature: signature || '',
        status: 'received',
        provider,
        processed,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
  }

  /**
   * Process Crossmint webhook
   * @param {object} data - Webhook data
   * @param {string} signature - Webhook signature
   * @param {string} rawBody - Raw request body
   * @returns {Promise<object>} Processing result
   */
  async processCrossmintWebhook(data, signature, rawBody) {
    console.log('Received Crossmint webhook', {
      event: data.type,
      timestamp: new Date().toISOString()
    });
    
    // Verify signature
    const webhookSecret = process.env.CROSSMINT_WEBHOOK_SECRET || 'whsec_wnSCMaGf3uCDYpdXciDBZB30IEMCWt8E';
    
    const isValid = this._verifySignature(signature, rawBody, webhookSecret);
    let log;
    
    if (!isValid) {
      console.warn('Invalid Crossmint webhook signature');
      try {
        await this._logWebhook(data.type, data, signature, 'crossmint');
      } catch (logError) {
        console.error('Error logging invalid webhook:', logError);
      }
      
      throw new Error('Invalid signature');
    }
    
    // Store the webhook
    log = await this._logWebhook(data.type, data, signature, 'crossmint');
    console.log(`Stored Crossmint webhook: ${log.id}, type: ${data.type}`);
    
    // Process different event types
    switch (data.type) {
      case 'wallets.transaction.succeeded':
        await this._processWalletTransaction(data);
        break;
        
      case 'credential.creation.succeeded':
        await this._processCredentialCreation(data);
        break;
        
      default:
        console.log(`Unhandled Crossmint webhook type: ${data.type}`);
        break;
    }
    
    // Mark as processed
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { processed: true, processed_at: new Date() }
    });
    
    return { webhookId: log.id, eventType: data.type };
  }

  /**
   * Process wallet transaction webhook
   * @param {object} data - Transaction data
   * @returns {Promise<void>}
   * @private
   */
  async _processWalletTransaction(data) {
    try {
      const { id, status, chain, address } = data;
      
      if (!address) {
        console.warn('No wallet address in transaction webhook');
        return;
      }
      
      // Find the wallet in our database
      const wallet = await prisma.wallet.findFirst({
        where: { address },
        include: { issuer: true }
      });
      
      if (!wallet) {
        console.warn(`Wallet not found for address: ${address}`);
        return;
      }
      
      // Update transaction status
      await prisma.walletTransaction.upsert({
        where: { external_id: id },
        update: {
          status,
          updated_at: new Date()
        },
        create: {
          external_id: id,
          wallet_id: wallet.id,
          status,
          type: data.type || 'transaction',
          chain,
          amount: data.amount || '0',
          token: data.token || 'MATIC',
          from_address: data.fromAddress || '',
          to_address: data.toAddress || '',
          raw_data: JSON.stringify(data),
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      
      console.log(`Updated transaction status: ${id} -> ${status}`);
    } catch (error) {
      console.error('Error processing wallet transaction webhook:', error);
    }
  }

  /**
   * Process credential creation webhook
   * @param {object} data - Credential data
   * @returns {Promise<void>}
   * @private
   */
  async _processCredentialCreation(data) {
    try {
      const { id, status, holderDid, issuerDid } = data;
      
      if (!issuerDid) {
        console.warn('No issuer DID in credential webhook');
        return;
      }
      
      // Find the issuer with this DID
      const issuer = await prisma.issuer.findFirst({
        where: { did: issuerDid }
      });
      
      if (!issuer) {
        console.warn(`Issuer not found for DID: ${issuerDid}`);
        return;
      }
      
      // Store or update the credential
      await prisma.verifiableCredential.upsert({
        where: { external_id: id },
        update: {
          status,
          updated_at: new Date()
        },
        create: {
          external_id: id,
          issuer_id: issuer.id,
          holder_did: holderDid || '',
          issuer_did: issuerDid,
          credential_type: data.type || 'unknown',
          status,
          raw_data: JSON.stringify(data),
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      
      console.log(`Updated credential status: ${id} -> ${status}`);
    } catch (error) {
      console.error('Error processing credential creation webhook:', error);
    }
  }
}

module.exports = new WebhooksService(); 