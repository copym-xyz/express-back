const passport = require('passport');

/**
 * Base authentication controller with common methods
 */
class AuthController {
  /**
   * Store role hint in session
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @param {function} next - Express next function
   */
  storeRoleHint(req, res, next) {
    const { role } = req.query;
    
    if (role) {
      req.session.intendedRole = role.toUpperCase();
      console.log(`Stored intended role in session: ${role.toUpperCase()}`);
    }
    
    next();
  }

  /**
   * Handle OAuth authentication success
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  handleOAuthSuccess(req, res) {
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
    
    if (req.user && req.user.token) {
      // Redirect to client app with token
      return res.redirect(`${CLIENT_URL}/auth/callback?token=${req.user.token}`);
    } else {
      // Redirect to login page if authentication failed
      return res.redirect(`${CLIENT_URL}/login?error=authentication_failed`);
    }
  }
}

module.exports = new AuthController(); 