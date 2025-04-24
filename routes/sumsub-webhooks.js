/**
 * SumSub webhook handler
 * This file handles all webhooks from SumSub and validates their signatures
 */
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { verifyWebhookSignature, fetchApplicantData, extractPersonalInfo, savePersonalInfo } = require('../utils/sumsubUtils');
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
    const secretKey = process.env.SUMSUB_SECRET_KEY || 'Kjp1bbs4_rDiyQYl4feXceLqbkn';
    
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
    let isSignatureValid = true;
    if (process.env.NODE_ENV === 'production') {
      isSignatureValid = await verifyWebhookSignature(rawBody, signature, secretKey);
      if (!isSignatureValid) {
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
    try {
      const webhookData = await prisma.webhookLog.create({
        data: {
          type: payload.type,
          payload: payload,
          signature: signature,
          status: 'received',
          provider: 'sumsub',
          processed: false,
          created_at: new Date(),
          updated_at: new Date()
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
        
        case 'applicantPersonalInfoChanged':
          await handleApplicantPersonalInfoChanged(payload);
          break;
        
        default:
          console.log('Unhandled webhook type:', payload.type);
      }

      // Mark webhook as processed
      await prisma.webhookLog.update({
        where: { id: webhookData.id },
        data: { 
          processed: true,
          processed_at: new Date(),
          updated_at: new Date(),
          status: 'processed'
        }
      });

      res.status(200).json({ success: true });
    } catch (dbError) {
      console.error('Database error while processing webhook:', dbError);
      
      // We still return 200 to Sumsub to prevent retries, but with an error status
      res.status(200).json({ 
        success: false, 
        error: process.env.NODE_ENV === 'production' ? 
          'Database error' : dbError.message 
      });
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Always return 200 to Sumsub, even on errors, to avoid retries
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
    // First create basic KYC verification record
    const verification = await prisma.kycVerification.create({
      data: {
        type: payload.type,
        applicant_id: applicantId,
        correlation_id: payload.correlationId || '',
        event_timestamp: new Date(payload.createdAtMs || Date.now()),
        external_user_id: externalUserId || '',
        inspection_id: payload.inspectionId || '',
        processing_status: 'received',
        raw_data: JSON.stringify(payload),
        review_result: reviewResult?.reviewAnswer || '',
        review_status: payload.reviewStatus || 'unknown',
        signature_valid: true,
        updated_at: new Date(),
        webhook_type: payload.type
      }
    });

    console.log('Created KYC verification record for applicant:', applicantId);
    
    // Parse externalUserId if in format 'user-123'
    let userId = null;
    if (externalUserId) {
      const userIdMatch = externalUserId.match(/^user-(\d+)$/);
      if (userIdMatch && userIdMatch[1]) {
        userId = parseInt(userIdMatch[1]);
        console.log(`Extracted numeric userId: ${userId} from externalUserId: ${externalUserId}`);
      }
    }

    // If verification was successful or we want to store details regardless of outcome
    // Fetch detailed applicant data from Sumsub API
    console.log('Fetching detailed applicant data from Sumsub API...');
    let personalInfo = null;
    
    // Try to get data from Sumsub API first
    const applicantData = await fetchApplicantData(applicantId);
    
    if (applicantData) {
      console.log('Successfully retrieved applicant data, extracting personal info...');
      
      // Extract personal information from applicant data
      personalInfo = extractPersonalInfo(applicantData);
    } else {
      console.warn(`Failed to fetch detailed applicant data for ${applicantId}, using payload data as fallback`);
      
      // Use webhook payload as fallback (might have limited info but better than nothing)
      if (payload.info) {
        personalInfo = {
          firstName: payload.info.firstName || payload.info.firstNameEn || null,
          lastName: payload.info.lastName || payload.info.lastNameEn || null,
          middleName: payload.info.middleName || null,
          dob: payload.info.dob || null,
          gender: payload.info.gender || null,
          nationality: payload.info.nationality || null,
          email: payload.info.email || null,
          phone: payload.info.phone || null
        };
        
        // Extract address info if available
        if (payload.info.addresses && payload.info.addresses.length > 0) {
          const address = payload.info.addresses[0];
          personalInfo.country = address.country || null;
          personalInfo.state = address.state || address.region || address.province || null;
          personalInfo.town = address.town || address.city || null;
          personalInfo.street = address.street || address.streetAddress || address.address || null;
          personalInfo.postcode = address.postcode || address.postalCode || address.zipCode || null;
        }
        
        console.log('Extracted personal info from webhook payload:', personalInfo);
      }
    }
    
    // Check if we have an applicant record already
    let applicantRecord = await prisma.kyc_applicants.findUnique({
      where: { applicant_id: applicantId }
    });
    
    // If no applicant record exists, create one
    if (!applicantRecord) {
      console.log(`Creating new applicant record for ${applicantId}`);
      applicantRecord = await prisma.kyc_applicants.create({
        data: {
          applicant_id: applicantId,
          user_id: userId,
          external_user_id: externalUserId || '',
          status: payload.reviewStatus || 'unknown',
          result: reviewResult?.reviewAnswer || null,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    } else {
      // Update existing applicant record
      console.log(`Updating existing applicant record for ${applicantId}`);
      await prisma.kyc_applicants.update({
        where: { applicant_id: applicantId },
        data: {
          status: payload.reviewStatus || 'unknown',
          result: reviewResult?.reviewAnswer || null,
          updated_at: new Date()
        }
      });
    }
    
    // If we have personal info, save it
    if (personalInfo && Object.keys(personalInfo).length > 0) {
      console.log('Personal info to be stored:', JSON.stringify(personalInfo));
      
      // Use the utility function to save personal info
      const savedInfo = await savePersonalInfo(applicantId, personalInfo);
      
      if (savedInfo) {
        console.log(`Successfully saved personal info for applicant ${applicantId}`);
        
        // If the applicant record doesn't have a personal_info_id yet, update it
        if (!applicantRecord.personal_info_id) {
          await prisma.kyc_applicants.update({
            where: { id: applicantRecord.id },
            data: { personal_info_id: savedInfo.id }
          });
        }
        
        // If we have address information, create or update address record
        if ((personalInfo.street || personalInfo.town || personalInfo.state || personalInfo.postcode) && 
            personalInfo.country) {
          try {
            // Try to find existing address info record
            const existingAddress = await prisma.kyc_address_info.findFirst({
              where: { 
                applicant_id: applicantId,
                is_primary: true
              }
            });
            
            const addressInfoData = {
              address_type: 'RESIDENTIAL',
              is_primary: true,
              street: personalInfo.street || null,
              city: personalInfo.town || null,
              state: personalInfo.state || null,
              postal_code: personalInfo.postcode || null,
              country: personalInfo.country || null,
              updated_at: new Date()
            };
            
            if (existingAddress) {
              console.log(`Updating existing address info for applicant ${applicantId}`);
              await prisma.kyc_address_info.update({
                where: { id: existingAddress.id },
                data: addressInfoData
              });
            } else {
              console.log(`Creating new address info for applicant ${applicantId}`);
              await prisma.kyc_address_info.create({
                data: {
                  ...addressInfoData,
                  applicant_id: applicantId,
                  is_verified: false,
                  created_at: new Date()
                }
              });
            }
          } catch (addressError) {
            console.error(`Error saving address info for applicant ${applicantId}:`, addressError);
          }
        }
      }
    } else {
      console.warn(`No personal info available for applicant ${applicantId}`);
    }
    
    // Store verification event history
    await prisma.kyc_verification_history.create({
      data: {
        applicant_id: applicantId,
        type: payload.type,
        review_status: payload.reviewStatus || 'unknown',
        review_result: reviewResult?.reviewAnswer || null,
        review_answer: reviewResult?.reviewAnswer || null,
        reject_type: reviewResult?.rejectType || null,
        reject_labels: JSON.stringify(reviewResult?.rejectLabels || []),
        timestamp: new Date(payload.createdAtMs || Date.now()),
        created_at: new Date()
      }
    });

    // If verification was successful (GREEN), update issuer verification status
    if (reviewResult?.reviewAnswer === 'GREEN') {
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
    // Don't rethrow - we want to avoid 500 responses to Sumsub
  }
}

async function handleApplicantCreated(payload) {
  const { externalUserId, applicantId } = payload;
  
  try {
    // Log the applicant creation
    console.log(`Processing applicant creation for ${applicantId}, externalUserId: ${externalUserId}`);
    
    // Parse externalUserId if in format 'user-123'
    let userId = null;
    if (externalUserId) {
      const userIdMatch = externalUserId.match(/^user-(\d+)$/);
      if (userIdMatch && userIdMatch[1]) {
        userId = parseInt(userIdMatch[1]);
        console.log(`Extracted numeric userId: ${userId} from externalUserId: ${externalUserId}`);
      }
    }
    
    // Fetch detailed applicant data from Sumsub API
    console.log('Fetching applicant data from Sumsub API...');
    let personalInfo = null;
    
    // Try to get data from Sumsub API first
    const applicantData = await fetchApplicantData(applicantId);
    
    if (applicantData) {
      console.log('Successfully retrieved applicant data, extracting personal info...');
      
      // Extract personal information from applicant data
      personalInfo = extractPersonalInfo(applicantData);
    } else {
      console.warn(`Failed to fetch detailed applicant data for ${applicantId}, using payload data as fallback`);
      
      // Use webhook payload as fallback (might have limited info but better than nothing)
      if (payload.info) {
        personalInfo = {
          firstName: payload.info.firstName || payload.info.firstNameEn || null,
          lastName: payload.info.lastName || payload.info.lastNameEn || null,
          middleName: payload.info.middleName || null,
          dob: payload.info.dob || null,
          gender: payload.info.gender || null,
          nationality: payload.info.nationality || null,
          email: payload.info.email || null,
          phone: payload.info.phone || null
        };
        
        // Extract address info if available
        if (payload.info.addresses && payload.info.addresses.length > 0) {
          const address = payload.info.addresses[0];
          personalInfo.country = address.country || null;
          personalInfo.state = address.state || address.region || address.province || null;
          personalInfo.town = address.town || address.city || null;
          personalInfo.street = address.street || address.streetAddress || address.address || null;
          personalInfo.postcode = address.postcode || address.postalCode || address.zipCode || null;
        }
        
        console.log('Extracted personal info from webhook payload:', personalInfo);
      }
    }
    
    // First, create applicant record - this is required due to foreign key constraints
    const applicantRecord = await prisma.kyc_applicants.create({
      data: {
        applicant_id: applicantId,
        user_id: userId,
        external_user_id: externalUserId || '',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    console.log(`Created applicant record for ${applicantId}`);
    
    // If we have personal info, save it
    if (personalInfo && Object.keys(personalInfo).length > 0) {
      // Use the utility function to save personal info
      const savedInfo = await savePersonalInfo(applicantId, personalInfo);
      
      if (savedInfo) {
        console.log(`Successfully saved personal info for applicant ${applicantId}`);
        
        // Now update the applicant record with the personal_info_id
        await prisma.kyc_applicants.update({
          where: { id: applicantRecord.id },
          data: { personal_info_id: savedInfo.id }
        });
        
        // If we have address information, create address record
        if ((personalInfo.street || personalInfo.town || personalInfo.state || personalInfo.postcode) && 
            personalInfo.country) {
          try {
            const addressInfoData = {
              applicant_id: applicantId,
              address_type: 'RESIDENTIAL',
              is_primary: true,
              street: personalInfo.street || null,
              city: personalInfo.town || null,
              state: personalInfo.state || null,
              postal_code: personalInfo.postcode || null,
              country: personalInfo.country || null,
              is_verified: false,
              created_at: new Date(),
              updated_at: new Date()
            };
            
            await prisma.kyc_address_info.create({
              data: addressInfoData
            });
            
            console.log(`Created address info record for applicant ${applicantId}`);
          } catch (addressError) {
            console.error(`Error creating address info for applicant ${applicantId}:`, addressError);
          }
        }
      }
    } else {
      console.warn(`No personal info available for applicant ${applicantId}`);
    }

    // Find the issuer if this is an issuer applicant
    const issuer = await prisma.issuer.findFirst({
      where: { sumsub_applicant_id: applicantId }
    });

    if (issuer) {
      // Create initial wallet and DID
      try {
        const walletResult = await createInitialWalletAndDID(issuer.id);
        
        if (!walletResult.success) {
          console.error('Failed to create initial wallet and DID:', walletResult.error);
          return;
        }

        console.log(`Created initial wallet and DID for issuer ${issuer.id}:`, {
          did: walletResult.did,
          walletAddress: walletResult.wallet.address
        });
      } catch (error) {
        console.error(`Error creating wallet and DID for issuer ${issuer.id}:`, error);
      }
    } else {
      // If there's no existing issuer, check if we need to create a new one
      // This depends on your business logic - perhaps you want to create
      // an issuer record automatically based on the externalUserId
      console.log(`No issuer found for applicant ${applicantId}, externalUserId: ${externalUserId}`);
    }
  } catch (error) {
    console.error('Failed to handle applicant creation:', error);
    // Don't rethrow - we want to avoid 500 responses to Sumsub
  }
}

async function handleApplicantPersonalInfoChanged(payload) {
  const { applicantId, externalUserId } = payload;
  
  try {
    console.log(`Processing personal info update for applicant ${applicantId}, externalUserId: ${externalUserId}`);
    
    // Parse externalUserId if in format 'user-123'
    let userId = null;
    if (externalUserId) {
      const userIdMatch = externalUserId.match(/^user-(\d+)$/);
      if (userIdMatch && userIdMatch[1]) {
        userId = parseInt(userIdMatch[1]);
        console.log(`Extracted numeric userId: ${userId} from externalUserId: ${externalUserId}`);
      }
    }

    // First check if we need to create a kyc_applicants record 
    // This is important because kyc_address_info has a foreign key constraint on applicant_id
    let applicantRecord = await prisma.kyc_applicants.findUnique({
      where: { applicant_id: applicantId }
    });
    
    if (!applicantRecord) {
      console.log(`Creating new applicant record for ${applicantId} before processing personal info`);
      applicantRecord = await prisma.kyc_applicants.create({
        data: {
          applicant_id: applicantId,
          user_id: userId,
          external_user_id: externalUserId || '',
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }

    // Create an audit log entry for this change
    await prisma.kyc_audit_log.create({
      data: {
        applicant_id: applicantId,
        action: 'PERSONAL_INFO_CHANGED',
        performed_by: 'SUMSUB_WEBHOOK',
        details: JSON.stringify({
          timestamp: new Date(payload.createdAtMs || Date.now()),
          source: 'webhook',
          type: payload.type
        }),
      }
    });
    
    // Fetch detailed applicant data from Sumsub API
    console.log('Fetching applicant data for personal info change...');
    let personalInfo = null;
    
    // Try to get data from Sumsub API first
    const applicantData = await fetchApplicantData(applicantId);
    
    if (applicantData) {
      console.log('Successfully retrieved applicant data, extracting personal info...');
      
      // Extract personal information from applicant data
      personalInfo = extractPersonalInfo(applicantData);
    } else {
      console.warn(`Failed to fetch detailed applicant data for ${applicantId}, using payload data as fallback`);
      
      // Use webhook payload as fallback (might have limited info but better than nothing)
      if (payload.info) {
        personalInfo = {
          firstName: payload.info.firstName || payload.info.firstNameEn || null,
          lastName: payload.info.lastName || payload.info.lastNameEn || null,
          middleName: payload.info.middleName || null,
          dob: payload.info.dob || null,
          gender: payload.info.gender || null,
          nationality: payload.info.nationality || null,
          email: payload.info.email || null,
          phone: payload.info.phone || null
        };
        
        // Extract address info if available
        if (payload.info.addresses && payload.info.addresses.length > 0) {
          const address = payload.info.addresses[0];
          personalInfo.country = address.country || null;
          personalInfo.state = address.state || address.region || address.province || null;
          personalInfo.town = address.town || address.city || null;
          personalInfo.street = address.street || address.streetAddress || address.address || null;
          personalInfo.postcode = address.postcode || address.postalCode || address.zipCode || null;
        }
        
        console.log('Extracted personal info from webhook payload:', personalInfo);
      }
    }
    
    if (personalInfo && Object.keys(personalInfo).length > 0) {
      console.log('Personal info update to be stored:', JSON.stringify(personalInfo));
      
      // Use the utility function to save personal info
      const savedInfo = await savePersonalInfo(applicantId, personalInfo);
      
      if (savedInfo) {
        console.log(`Successfully saved personal info for applicant ${applicantId}`);
        
        // If we have address information and it's a valid KYC applicant record,
        // add or update the address information
        if ((personalInfo.street || personalInfo.town || personalInfo.state || personalInfo.postcode) && 
            personalInfo.country) {
          try {
            // Try to find existing address info record
            const existingAddress = await prisma.kyc_address_info.findFirst({
              where: { 
                applicant_id: applicantId,
                is_primary: true
              }
            });
            
            const addressInfoData = {
              address_type: 'RESIDENTIAL',
              is_primary: true,
              street: personalInfo.street || null,
              city: personalInfo.town || null,
              state: personalInfo.state || null,
              postal_code: personalInfo.postcode || null,
              country: personalInfo.country || null,
              updated_at: new Date()
            };
            
            if (existingAddress) {
              console.log(`Updating existing address info for applicant ${applicantId}`);
              await prisma.kyc_address_info.update({
                where: { id: existingAddress.id },
                data: addressInfoData
              });
            } else {
              // Make sure we have a valid applicant record before creating address
              console.log(`Creating new address info for applicant ${applicantId}`);
              await prisma.kyc_address_info.create({
                data: {
                  ...addressInfoData,
                  applicant_id: applicantId,
                  is_verified: false,
                  created_at: new Date()
                }
              });
            }
          } catch (addressError) {
            console.error(`Error saving address info for applicant ${applicantId}:`, addressError);
          }
        }
      }
    } else {
      console.warn(`No personal info available for applicant ${applicantId}`);
    }
    
    console.log(`Completed processing personal info change for ${applicantId}`);
  } catch (error) {
    console.error('Failed to handle applicant personal info change:', error);
    // Don't rethrow - we want to avoid 500 responses to Sumsub
  }
}

module.exports = router; 