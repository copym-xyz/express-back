const issuerService = require('../../services/issuer/issuer.service');

/**
 * Issuer Controller - Handles issuer-related HTTP requests
 */
class IssuerController {
  /**
   * Get profile information for the current issuer
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getProfile(req, res) {
    try {
      const profile = await issuerService.getProfile(req.user.id);
      res.json(profile);
    } catch (error) {
      console.error('Error fetching issuer profile:', error);
      const statusCode = error.message === 'Issuer profile not found' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch issuer profile',
        error: error.message 
      });
    }
  }

  /**
   * Update the issuer's profile
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async updateProfile(req, res) {
    try {
      const updatedProfile = await issuerService.updateProfile(req.user.id, req.body);
      res.json(updatedProfile);
    } catch (error) {
      console.error('Error updating issuer profile:', error);
      const statusCode = error.message === 'Issuer profile not found' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to update issuer profile',
        error: error.message 
      });
    }
  }

  /**
   * Get KYC verification status for the issuer
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getKycStatus(req, res) {
    try {
      const kycStatus = await issuerService.getKycStatus(req.user.id);
      res.json(kycStatus);
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      const statusCode = error.message === 'Issuer profile not found' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch KYC status',
        error: error.message 
      });
    }
  }

  /**
   * Generate Sumsub KYC verification URL
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getKycVerificationUrl(req, res) {
    try {
      const verificationUrl = await issuerService.getKycVerificationUrl(req.user.id);
      res.json(verificationUrl);
    } catch (error) {
      console.error('Error generating KYC verification URL:', error);
      
      const statusCode = error.message === 'Issuer profile not found' ? 404 : 
                        error.message === 'User email is required for KYC verification' ? 400 : 500;
      
      res.status(statusCode).json({ 
        message: error.message || 'Failed to generate KYC verification URL',
        error: error.message 
      });
    }
  }

  /**
   * Get offerings created by the issuer
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getOfferings(req, res) {
    try {
      const offerings = await issuerService.getOfferings(req.user.id);
      res.json(offerings);
    } catch (error) {
      console.error('Error fetching issuer offerings:', error);
      const statusCode = error.message === 'Issuer profile not found' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch offerings',
        error: error.message 
      });
    }
  }

  /**
   * Create a new offering
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async createOffering(req, res) {
    try {
      const offering = await issuerService.createOffering(req.user.id, req.body);
      res.status(201).json(offering);
    } catch (error) {
      console.error('Error creating offering:', error);
      
      const statusCode = error.message === 'Issuer profile not found' ? 404 : 
                        error.message === 'Issuer must be verified to create offerings' ? 403 : 500;
      
      res.status(statusCode).json({ 
        message: error.message || 'Failed to create offering',
        error: error.message 
      });
    }
  }

  /**
   * Get details for a specific offering
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getOfferingDetails(req, res) {
    try {
      const { offeringId } = req.params;
      const offering = await issuerService.getOfferingDetails(req.user.id, offeringId);
      res.json(offering);
    } catch (error) {
      console.error('Error fetching offering details:', error);
      
      const statusCode = error.message === 'Issuer profile not found' || 
                        error.message === 'Offering not found' ? 404 : 500;
      
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch offering details',
        error: error.message 
      });
    }
  }

  /**
   * Update an offering
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async updateOffering(req, res) {
    try {
      const { offeringId } = req.params;
      const offering = await issuerService.updateOffering(req.user.id, offeringId, req.body);
      res.json(offering);
    } catch (error) {
      console.error('Error updating offering:', error);
      
      const statusCode = error.message === 'Issuer profile not found' || 
                        error.message === 'Offering not found' ? 404 : 500;
      
      res.status(statusCode).json({ 
        message: error.message || 'Failed to update offering',
        error: error.message 
      });
    }
  }

  /**
   * Upload a document for an offering
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async uploadDocument(req, res) {
    try {
      const { offeringId } = req.params;
      const document = await issuerService.uploadDocument(req.user.id, offeringId, req.body);
      res.json(document);
    } catch (error) {
      console.error('Error uploading document:', error);
      
      const statusCode = error.message === 'Issuer profile not found' || 
                        error.message === 'Offering not found' ? 404 : 500;
      
      res.status(statusCode).json({ 
        message: error.message || 'Failed to upload document',
        error: error.message 
      });
    }
  }
}

module.exports = new IssuerController(); 