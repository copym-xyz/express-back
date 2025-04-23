/**
 * SumSub webhook handler
 * This file handles all webhooks from SumSub and validates their signatures
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyWebhookSignature } = require('../utils/sumsubUtils');
const { generateDIDForIssuer, createInitialWalletAndDID } = require('../utils/didUtils');

// Raw body parser middleware for this route
router.use(express.raw({ 
  type: 'application/json',
  limit: '50mb'
}));

// Webhook handler
router.post('/', async (req, res) => {
  try {
    const signature = req.headers['x-payload-digest'];
    
    // Log incoming webhook details
    console.log('Received Sumsub webhook:', {
      signature,
      bodyType: typeof req.body,
      isBuffer: Buffer.isBuffer(req.body),
      contentType: req.headers['content-type']
    });

    // Convert body to string if it's a Buffer
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : 
                    typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;

    // Verify signature in production
    if (process.env.NODE_ENV === 'production') {
      const isValid = await verifyWebhookSignature(signature, rawBody);
      if (!isValid) {
        console.warn('Invalid webhook signature received');
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }
    }

    // Parse the payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
      console.log('Parsed webhook payload:', payload);
    } catch (err) {
      console.error('Failed to parse webhook payload:', err);
      return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    }

    // Store webhook data
    const webhookData = await prisma.webhookLog.create({
      data: {
        type: payload.type,
        payload: payload,
        signature,
        status: 'received'
      }
    });

    // Handle different webhook types
    switch (payload.type) {
      case 'applicantReviewed':
        await handleApplicantReviewed(payload);
        break;
      
      case 'applicantPending':
        console.log('Applicant pending review:', payload.applicantId);
        break;
      
      case 'applicantCreated':
        await handleApplicantCreated(payload);
        break;
      
      default:
        console.log('Unhandled webhook type:', payload.type);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(200).json({ 
      success: false, 
      error: process.env.NODE_ENV === 'production' ? 
        'Internal server error' : error.message 
    });
  }
});

async function handleApplicantReviewed(payload) {
  const { reviewResult, applicantId, externalUserId } = payload;
  
  try {
    // Update KYC verification status
    await prisma.kycVerification.update({
      where: { sumsub_applicant_id: applicantId },
      data: {
        status: reviewResult.reviewAnswer.toLowerCase(),
        review_answer: reviewResult.reviewAnswer,
        review_rejectLabels: reviewResult.rejectLabels,
        reviewed_at: new Date()
      }
    });

    console.log('Updated KYC verification for applicant:', applicantId);

    // If verification was successful (GREEN), update issuer verification status
    if (reviewResult.reviewAnswer === 'GREEN') {
      // Find the issuer by applicantId
      const issuer = await prisma.issuer.findFirst({
        where: { sumsub_applicant_id: applicantId }
      });

      if (issuer) {
        // Update issuer verification status
        await prisma.issuer.update({
          where: { id: issuer.id },
          data: { 
            verification_status: true,
            verified_at: new Date(),
            updated_at: new Date()
          }
        });

        console.log(`Updated verification status for issuer ${issuer.id}`);

        // Update DID for the verified issuer
        try {
          const didResult = await generateDIDForIssuer(issuer.id);
          if (didResult.success) {
            console.log(`Updated DID for verified issuer ${issuer.id}: ${didResult.did}`);
          } else {
            console.error(`Failed to update DID for issuer ${issuer.id}:`, didResult.error);
          }
        } catch (didError) {
          console.error(`Error updating DID for issuer ${issuer.id}:`, didError);
        }
      }
    }
  } catch (error) {
    console.error('Failed to handle applicant review:', error);
    throw error;
  }
}

async function handleApplicantCreated(payload) {
  const { externalUserId, applicantId } = payload;
  
  try {
    // Find the issuer
    const issuer = await prisma.issuer.findFirst({
      where: { sumsub_applicant_id: applicantId }
    });

    if (issuer) {
      // Create initial wallet and DID
      const walletResult = await createInitialWalletAndDID(issuer.id);
      
      if (!walletResult.success) {
        console.error('Failed to create initial wallet and DID:', walletResult.error);
        return;
      }

      console.log(`Created initial wallet and DID for issuer ${issuer.id}:`, {
        did: walletResult.did,
        walletAddress: walletResult.wallet.address
      });
    }
  } catch (error) {
    console.error('Failed to handle applicant creation:', error);
    throw error;
  }
}

module.exports = router; 