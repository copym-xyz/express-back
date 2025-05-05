const issuerService = require('../../services/auth/issuer.service');

/**
 * Controller for issuer authentication
 */
class IssuerController {
  /**
   * Handle issuer login
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      const result = await issuerService.login(email, password);
      
      if (!result.success) {
        return res.status(401).json({ message: result.message });
      }
      
      return res.json({
        token: result.token,
        user: result.user
      });
    } catch (error) {
      console.error('Issuer login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Handle issuer registration
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async register(req, res) {
    try {
      console.log('Issuer registration endpoint hit');
      
      const issuerData = {
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        company_name: req.body.company_name,
        company_registration_number: req.body.company_registration_number,
        jurisdiction: req.body.jurisdiction
      };
      
      const result = await issuerService.register(issuerData);
      
      if (!result.success) {
        const statusCode = result.message === 'User already exists' ? 400 : 500;
        return res.status(statusCode).json({ message: result.message, missing: result.missing });
      }
      
      return res.json({
        token: result.token,
        user: result.user
      });
    } catch (error) {
      console.error('Issuer registration error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

module.exports = new IssuerController(); 