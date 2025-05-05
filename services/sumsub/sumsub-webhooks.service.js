const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { extractUserId } = require('../../utils/sumsubUtils');

/**
 * Sumsub Webhooks Service - Contains business logic for Sumsub webhook handling
 */
class SumsubWebhooksService {
  /**
   * Process a Sumsub webhook
   * @param {string} type - Webhook type
   * @param {object} payload - Webhook payload
   * @returns {Promise<object>} Processing result
   */
  async processWebhook(type, payload) {
    // Log the webhook
    console.log(`Processing Sumsub webhook of type: ${type}`);
    let log;
    
    try {
      // Store the webhook in the database
      log = await this._logWebhook(type, payload);
      
      // Process based on type
      switch (type) {
        case 'applicantReviewed':
          return await this._processApplicantReviewed(payload);
          
        case 'applicantCreated':
          return await this._processApplicantCreated(payload);
          
        case 'applicantPending':
          return await this._processApplicantPending(payload);
          
        case 'applicantOnHold':
          return await this._processApplicantOnHold(payload);
          
        case 'applicantPersonalInfoChanged':
          return await this._processApplicantPersonalInfoChanged(payload);
          
        default:
          console.log(`Unhandled webhook type: ${type}`);
          return { webhookId: log?.id, action: 'logged', type };
      }
    } catch (error) {
      console.error(`Error processing ${type} webhook:`, error);
      
      // Update log status if available
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
      
      throw error;
    }
  }

  /**
   * Log webhook in database
   * @param {string} type - Webhook type
   * @param {object} payload - Webhook payload
   * @returns {Promise<object>} Created webhook log
   * @private
   */
  async _logWebhook(type, payload) {
    try {
      return await prisma.webhookLog.create({
        data: {
          type,
          payload,
          provider: 'sumsub',
          status: 'received',
          created_at: new Date()
        }
      });
    } catch (error) {
      console.error('Error logging webhook:', error);
      return null;
    }
  }

  /**
   * Process applicantReviewed webhook
   * @param {object} payload - Webhook payload
   * @returns {Promise<object>} Processing result
   * @private
   */
  async _processApplicantReviewed(payload) {
    // Extract the necessary data
    const applicantId = payload.applicantId;
    const reviewResult = payload.reviewResult;
    const reviewStatus = reviewResult?.reviewStatus;
    const externalUserId = payload.externalUserId;
    
    if (!applicantId) {
      throw new Error('Missing applicant ID in webhook payload');
    }
    
    // Try to extract userId from externalUserId
    const userId = extractUserId(externalUserId);
    
    // Store the verification record
    let kycVerification;
    try {
      kycVerification = await prisma.kycVerification.create({
        data: {
          applicant_id: applicantId,
          external_user_id: externalUserId,
          review_status: reviewStatus || 'unknown',
          review_result: reviewResult,
          raw_data: payload,
          user_id: userId || null,
          created_at: new Date()
        }
      });
      
      console.log(`Created KYC verification record: ${kycVerification.id}`);
    } catch (error) {
      console.error('Error creating KYC verification record:', error);
      throw new Error('Failed to create KYC verification record');
    }
    
    // If the review is "completed" or "approved", update the issuer's verification status
    const isApproved = reviewStatus === 'completed' || reviewStatus === 'approved';
    
    if (isApproved && userId) {
      try {
        // Update the issuer's verification status
        await prisma.issuer.updateMany({
          where: { 
            OR: [
              { user_id: userId },
              { sumsub_applicant_id: applicantId }
            ]
          },
          data: { 
            verification_status: true,
            verification_date: new Date()
          }
        });
        
        console.log(`Updated verification status for userId: ${userId}`);
      } catch (updateError) {
        console.error('Error updating issuer verification status:', updateError);
        // Don't throw, continue processing
      }
    }
    
    return {
      success: true,
      action: 'applicant_reviewed',
      verificationId: kycVerification.id,
      status: reviewStatus,
      isApproved
    };
  }

  /**
   * Process applicantCreated webhook
   * @param {object} payload - Webhook payload
   * @returns {Promise<object>} Processing result
   * @private
   */
  async _processApplicantCreated(payload) {
    const applicantId = payload.applicantId;
    const externalUserId = payload.externalUserId;
    
    if (!applicantId) {
      throw new Error('Missing applicant ID in webhook payload');
    }
    
    // Try to extract userId from externalUserId
    const userId = extractUserId(externalUserId);
    
    // Update issuer if userId is found
    if (userId) {
      try {
        await prisma.issuer.updateMany({
          where: { user_id: userId },
          data: { sumsub_applicant_id: applicantId }
        });
        
        console.log(`Associated applicant ${applicantId} with user ${userId}`);
      } catch (error) {
        console.error('Error updating issuer record:', error);
        // Don't throw, continue processing
      }
    }
    
    return {
      success: true,
      action: 'applicant_created',
      applicantId,
      userId
    };
  }

  /**
   * Process applicantPending webhook
   * @param {object} payload - Webhook payload
   * @returns {Promise<object>} Processing result
   * @private
   */
  async _processApplicantPending(payload) {
    return {
      success: true,
      action: 'applicant_pending',
      applicantId: payload.applicantId
    };
  }

  /**
   * Process applicantOnHold webhook
   * @param {object} payload - Webhook payload
   * @returns {Promise<object>} Processing result
   * @private
   */
  async _processApplicantOnHold(payload) {
    return {
      success: true,
      action: 'applicant_on_hold',
      applicantId: payload.applicantId
    };
  }

  /**
   * Process applicantPersonalInfoChanged webhook
   * @param {object} payload - Webhook payload
   * @returns {Promise<object>} Processing result
   * @private
   */
  async _processApplicantPersonalInfoChanged(payload) {
    // Get the personal info from the payload
    const applicantId = payload.applicantId;
    const info = payload.info || {};
    
    if (!applicantId) {
      throw new Error('Missing applicant ID in webhook payload');
    }
    
    // Store or update personal info
    try {
      // Check if personal info already exists
      const existingInfo = await prisma.kyc_personal_info.findFirst({
        where: { applicant_id: applicantId }
      });
      
      if (existingInfo) {
        // Update existing record
        await prisma.kyc_personal_info.update({
          where: { id: existingInfo.id },
          data: {
            first_name: info.firstName || existingInfo.first_name,
            middle_name: info.middleName || existingInfo.middle_name,
            last_name: info.lastName || existingInfo.last_name,
            dob: info.dob ? new Date(info.dob) : existingInfo.dob,
            country: info.country || existingInfo.country,
            updated_at: new Date(),
            raw_data: info
          }
        });
        
        console.log(`Updated personal info for applicant ${applicantId}`);
      } else {
        // Create new record
        await prisma.kyc_personal_info.create({
          data: {
            applicant_id: applicantId,
            first_name: info.firstName || '',
            middle_name: info.middleName || '',
            last_name: info.lastName || '',
            dob: info.dob ? new Date(info.dob) : null,
            country: info.country || '',
            created_at: new Date(),
            updated_at: new Date(),
            raw_data: info
          }
        });
        
        console.log(`Created personal info for applicant ${applicantId}`);
      }
      
      return {
        success: true,
        action: 'personal_info_updated',
        applicantId
      };
    } catch (error) {
      console.error('Error updating personal info:', error);
      throw new Error('Failed to update personal information');
    }
  }
}

module.exports = new SumsubWebhooksService(); 