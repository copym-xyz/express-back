const adminService = require('../../services/auth/admin.service');

/**
 * Controller for admin authentication
 */
class AdminController {
  /**
   * Handle admin login
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      const result = await adminService.login(email, password);
      
      if (!result.success) {
        return res.status(401).json({ message: result.message });
      }
      
      return res.json({
        token: result.token,
        user: result.user
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

module.exports = new AdminController(); 