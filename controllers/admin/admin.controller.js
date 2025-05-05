const adminService = require('../../services/admin/admin.service');

/**
 * Admin Controller - Handles admin-related HTTP requests
 */
class AdminController {
  /**
   * Get Sumsub applicants
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getSumsubApplicants(req, res) {
    try {
      // Get parameters from query string
      const { status, offset, limit } = req.query;
      
      const applicantsData = await adminService.getSumsubApplicants({
        status,
        offset: offset ? parseInt(offset) : undefined,
        limit: limit ? parseInt(limit) : undefined
      });
      
      res.json(applicantsData);
    } catch (error) {
      console.error('Error fetching applicants from Sumsub:', error.message);
      res.status(500).json({ 
        message: 'Failed to fetch applicants from Sumsub',
        error: error.message
      });
    }
  }

  /**
   * Get all users for admin dashboard
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getAllUsers(req, res) {
    try {
      const users = await adminService.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  }

  /**
   * Get KYC verifications
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getKycVerifications(req, res) {
    try {
      const { userId } = req.query;
      
      const verifications = await adminService.getKycVerifications({ userId });
      res.json(verifications);
    } catch (error) {
      console.error('Error fetching KYC verifications:', error);
      res.status(500).json({ 
        message: 'Failed to fetch KYC verifications',
        error: error.message 
      });
    }
  }

  /**
   * Get details for a specific KYC verification
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getKycVerificationDetails(req, res) {
    try {
      const { id } = req.params;
      
      const verification = await adminService.getKycVerificationDetails(parseInt(id));
      res.json(verification);
    } catch (error) {
      console.error('Error fetching KYC verification details:', error);
      const statusCode = error.message === 'KYC verification not found' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch KYC verification details',
        error: error.message 
      });
    }
  }

  /**
   * Get all wallets
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getAllWallets(req, res) {
    try {
      const wallets = await adminService.getAllWallets();
      res.json(wallets);
    } catch (error) {
      console.error('Error fetching wallets:', error);
      res.status(500).json({ message: 'Failed to fetch wallets' });
    }
  }

  /**
   * Get wallet details
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getWalletDetails(req, res) {
    try {
      const { walletId } = req.params;
      
      const wallet = await adminService.getWalletDetails(walletId);
      res.json(wallet);
    } catch (error) {
      console.error('Error fetching wallet details:', error);
      const statusCode = error.message === 'Wallet not found' ? 404 : 500;
      res.status(statusCode).json({ message: error.message || 'Failed to fetch wallet details' });
    }
  }

  /**
   * Get wallet balance
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getWalletBalance(req, res) {
    try {
      const { walletId } = req.params;
      
      const balance = await adminService.getWalletBalance(walletId);
      res.json(balance);
    } catch (error) {
      console.error('Error fetching wallet balance:', error.response?.data || error.message);
      const statusCode = error.message === 'Wallet not found' ? 404 : 500;
      res.status(statusCode).json({ message: error.message || 'Failed to fetch wallet balance', error: error.message });
    }
  }

  /**
   * Get wallet transactions
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getWalletTransactions(req, res) {
    try {
      const { walletId } = req.params;
      
      const transactions = await adminService.getWalletTransactions(walletId);
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error.response?.data || error.message);
      const statusCode = error.message === 'Wallet not found' ? 404 : 500;
      res.status(statusCode).json({ message: error.message || 'Failed to fetch transactions', error: error.message });
    }
  }

  /**
   * Get applicant data from Sumsub
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getSumsubApplicant(req, res) {
    try {
      const { applicantId } = req.params;
      
      const applicant = await adminService.getSumsubApplicant(applicantId);
      res.json(applicant);
    } catch (error) {
      console.error('Error fetching applicant from Sumsub:', error.message);
      res.status(500).json({ 
        message: 'Failed to fetch applicant data from Sumsub',
        error: error.message
      });
    }
  }

  /**
   * Get applicant document images
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getSumsubApplicantDocuments(req, res) {
    try {
      const { applicantId } = req.params;
      
      const documents = await adminService.getSumsubApplicantDocuments(applicantId);
      res.json(documents);
    } catch (error) {
      console.error('Error fetching applicant documents from Sumsub:', error.message);
      res.status(500).json({ 
        message: 'Failed to fetch applicant documents from Sumsub',
        error: error.message
      });
    }
  }

  /**
   * Get personal info for an applicant
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getKycPersonalInfo(req, res) {
    try {
      const { applicantId } = req.params;
      
      const personalInfo = await adminService.getKycPersonalInfo(applicantId);
      res.json(personalInfo);
    } catch (error) {
      console.error('Error fetching personal information:', error);
      const statusCode = error.message === 'Personal information not found' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch personal information',
        error: error.message 
      });
    }
  }

  /**
   * Fix unassociated KYC verifications
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async fixKycAssociations(req, res) {
    try {
      const result = await adminService.fixKycAssociations();
      res.json(result);
    } catch (error) {
      console.error('Error fixing KYC associations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fix KYC associations',
        error: error.message
      });
    }
  }

  /**
   * Generate DID for a verified issuer
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async generateDIDForIssuer(req, res) {
    try {
      const { issuerId } = req.params;
      
      const result = await adminService.generateDIDForIssuer(issuerId);
      res.json(result);
    } catch (error) {
      console.error('Error generating DID for issuer:', error);
      const statusCode = error.message.includes('not found') ? 404 : 
                        error.message.includes('not verified') ? 400 : 500;
      
      res.status(statusCode).json({ 
        success: false, 
        message: error.message || 'Error generating DID', 
        error: error.message 
      });
    }
  }

  /**
   * Generate DIDs for all verified issuers without DIDs
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async generateAllDIDs(req, res) {
    try {
      const result = await adminService.generateAllDIDs();
      res.json(result);
    } catch (error) {
      console.error('Error in batch DID generation:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error generating DIDs in batch', 
        error: error.message 
      });
    }
  }
}

module.exports = new AdminController(); 