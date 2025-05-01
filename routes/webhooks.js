const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Verify Crossmint webhook signature
 * @param {string} signature - The signature from the webhook headers
 * @param {string} body - Raw webhook body
 * @param {string} secret - Webhook secret
 * @returns {boolean} - Whether the signature is valid
 */
const verifySignature = (signature, body, secret) => {
  try {
    if (!signature || !secret) {
      return false;
    }
    
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
};

/**
 * Crossmint webhook endpoint
 * @route POST /webhooks/crossmint
 * @desc Receive and process webhooks from Crossmint
 */
router.post('/crossmint', express.json({ verify: (req, res, buf) => {
  // Store the raw body for signature verification
  req.rawBody = buf.toString();
}}), async (req, res) => {
  try {
    console.log('Received Crossmint webhook', {
      event: req.body.type,
      timestamp: new Date().toISOString()
    });
    
    // Verify signature
    const signature = req.headers['x-webhook-signature'];
    const webhookSecret = process.env.CROSSMINT_WEBHOOK_SECRET || 'whsec_wnSCMaGf3uCDYpdXciDBZB30IEMCWt8E';
    
    const isValid = verifySignature(signature, req.rawBody, webhookSecret);
    
    if (!isValid) {
      console.warn('Invalid Crossmint webhook signature');
      // Store the webhook anyway for debugging
      try {
        await prisma.webhookLog.create({
          data: {
            type: req.body.type || 'unknown',
            payload: req.body,
            signature: signature || '',
            status: 'received',
            provider: 'crossmint',
            processed: false,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
      } catch (logError) {
        console.error('Error logging invalid webhook:', logError);
      }
      
      return res.status(403).json({ success: false, message: 'Invalid signature' });
    }
    
    // Store the webhook
    const log = await prisma.webhookLog.create({
      data: {
        type: req.body.type || 'unknown',
        payload: req.body,
        signature: signature || '',
        status: 'received',
        provider: 'crossmint',
        processed: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    console.log(`Stored Crossmint webhook: ${log.id}, type: ${req.body.type}`);
    
    // Process different event types
    switch (req.body.type) {
      case 'wallets.transaction.succeeded':
        // Wallet transaction succeeded
        await processWalletTransaction(req.body);
        break;
        
      case 'credential.creation.succeeded':
        // Credential was created
        await processCredentialCreation(req.body);
        break;
        
      default:
        console.log(`Unhandled Crossmint webhook type: ${req.body.type}`);
        break;
    }
    
    // Mark as processed
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { processed: true, processed_at: new Date() }
    });
    
    // Always return 200 to acknowledge receipt
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing Crossmint webhook:', error);
    // Return 200 even on error to prevent retries
    return res.status(200).json({ error: error.message });
  }
});

/**
 * Process wallet transaction webhook
 * @param {Object} data - Webhook payload
 */
async function processWalletTransaction(data) {
  try {
    console.log('Processing wallet transaction webhook');
    
    const { id, status, chain, address } = data;
    
    if (!address) {
      console.warn('No wallet address in transaction webhook');
      return;
    }
    
    // Find the wallet in our database
    const wallet = await prisma.wallet.findFirst({
      where: { address: address },
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
        status: status,
        updated_at: new Date()
      },
      create: {
        external_id: id,
        wallet_id: wallet.id,
        status: status,
        type: data.type || 'transaction',
        chain: chain,
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
 * @param {Object} data - Webhook payload
 */
async function processCredentialCreation(data) {
  try {
    console.log('Processing credential creation webhook');
    
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
        status: status,
        updated_at: new Date()
      },
      create: {
        external_id: id,
        issuer_id: issuer.id,
        holder_did: holderDid || '',
        issuer_did: issuerDid,
        credential_type: data.type || 'unknown',
        status: status,
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

module.exports = router; 