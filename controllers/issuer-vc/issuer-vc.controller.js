const issuerVcService = require('../../services/issuer-vc/issuer-vc.service');

/**
 * Issuer VC Controller - Handles issuer verifiable credential HTTP requests
 */
class IssuerVcController {
  /**
   * Test endpoint
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  test(req, res) {
    res.json({ message: 'Issuer VC routes are working' });
  }

  /**
   * Issue/mint a verifiable credential for the issuer
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async issueCredential(req, res) {
    try {
      const result = await issuerVcService.issueCredential(req.user.id, req.body);
      res.json(result);
    } catch (error) {
      console.error('Error issuing credential:', error);
      
      const statusCode = 
        error.message === 'Issuer profile not found for this user' ? 404 : 
        error.message === 'Wallet not found for this issuer' ? 404 : 
        error.message === 'Issuer must complete verification before issuing credentials' ? 403 : 500;
      
      res.status(statusCode).json({
        success: false, 
        message: error.message || 'Failed to issue credential',
        error: process.env.NODE_ENV === 'production' ? 
          'Internal server error' : error.message
      });
    }
  }
}

module.exports = new IssuerVcController(); 