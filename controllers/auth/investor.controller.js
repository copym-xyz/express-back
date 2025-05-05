const investorService = require('../../services/auth/investor.service');
const passport = require('passport');

/**
 * Controller for investor authentication
 */
class InvestorController {
  /**
   * Handle investor login
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      const result = await investorService.login(email, password);
      
      if (!result.success) {
        return res.status(401).json({ message: result.message });
      }
      
      return res.json({
        token: result.token,
        user: result.user
      });
    } catch (error) {
      console.error('Investor login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Handle investor registration
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async register(req, res) {
    try {
      const investorData = {
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        investor_type: req.body.investor_type
      };
      
      const result = await investorService.register(investorData);
      
      if (!result.success) {
        const statusCode = result.message === 'User already exists' ? 400 : 500;
        return res.status(statusCode).json({ message: result.message, missing: result.missing });
      }
      
      return res.json({
        token: result.token,
        user: result.user
      });
    } catch (error) {
      console.error('Investor registration error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Handle OAuth callback
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next function
   */
  async handleOAuthCallback(req, res, next) {
    try {
      // This function is called after the passport middleware has authenticated the user
      console.log('OAuth callback for investor');
      
      // Get the profile from the request
      const profile = req.user;
      
      // Get the intended role from the session (default to INVESTOR)
      const role = req.session.intendedRole || 'INVESTOR';
      console.log('Using role from session:', role);
      
      // Process the OAuth authentication
      const result = await investorService.handleOAuthCallback(profile, role);
      
      if (!result.success) {
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
      }
      
      // Set the user object with token in the request for the auth controller to handle redirection
      req.user = {
        ...result.user,
        token: result.token
      };
      
      // Continue to the next handler that will redirect
      next();
    } catch (error) {
      console.error('OAuth callback error:', error);
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
    }
  }
}

module.exports = new InvestorController(); 