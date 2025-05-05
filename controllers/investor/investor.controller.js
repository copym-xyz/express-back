const investorService = require('../../services/investor/investor.service');

/**
 * Investor Controller - Handles investor-related HTTP requests
 */
class InvestorController {
  /**
   * Get profile information for the current investor
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getProfile(req, res) {
    try {
      const profile = await investorService.getProfile(req.user.id);
      res.json(profile);
    } catch (error) {
      console.error('Error fetching investor profile:', error);
      const statusCode = error.message === 'Investor profile not found' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch investor profile',
        error: error.message 
      });
    }
  }

  /**
   * Update the investor's profile
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async updateProfile(req, res) {
    try {
      const updatedProfile = await investorService.updateProfile(req.user.id, req.body);
      res.json(updatedProfile);
    } catch (error) {
      console.error('Error updating investor profile:', error);
      const statusCode = error.message === 'Investor profile not found' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to update investor profile',
        error: error.message 
      });
    }
  }

  /**
   * Get available investments for the investor
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getAvailableInvestments(req, res) {
    try {
      const investments = await investorService.getAvailableInvestments();
      res.json(investments);
    } catch (error) {
      console.error('Error fetching available investments:', error);
      res.status(500).json({ 
        message: 'Failed to fetch available investments',
        error: error.message 
      });
    }
  }

  /**
   * Get details for a specific investment opportunity
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getOfferingDetails(req, res) {
    try {
      const { offeringId } = req.params;
      const offering = await investorService.getInvestmentDetails(offeringId);
      res.json(offering);
    } catch (error) {
      console.error('Error fetching investment opportunity details:', error);
      const statusCode = error.message === 'Investment opportunity not found' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch investment opportunity details',
        error: error.message 
      });
    }
  }

  /**
   * Get the investor's investments
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getMyInvestments(req, res) {
    try {
      const investments = await investorService.getMyInvestments(req.user.id);
      res.json(investments);
    } catch (error) {
      console.error('Error fetching investor investments:', error);
      const statusCode = error.message === 'Investor profile not found' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch investor investments',
        error: error.message 
      });
    }
  }

  /**
   * Create a new investment
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async createInvestment(req, res) {
    try {
      const investment = await investorService.createInvestment(req.user.id, req.body);
      res.status(201).json(investment);
    } catch (error) {
      console.error('Error creating investment:', error);
      
      const statusCode = 
        error.message === 'Investor profile not found' || 
        error.message === 'Investment opportunity not found or not active' ? 404 : 
        error.message.includes('Investment amount must be at least') ? 400 : 500;
      
      res.status(statusCode).json({ 
        message: error.message || 'Failed to create investment',
        error: error.message 
      });
    }
  }

  /**
   * Get details for a specific investment
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getInvestmentDetails(req, res) {
    try {
      const { investmentId } = req.params;
      const investment = await investorService.getInvestmentDetails(req.user.id, investmentId);
      res.json(investment);
    } catch (error) {
      console.error('Error fetching investment details:', error);
      
      const statusCode = 
        error.message === 'Investor profile not found' || 
        error.message === 'Investment not found' ? 404 : 500;
      
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch investment details',
        error: error.message 
      });
    }
  }
}

module.exports = new InvestorController(); 