const authService = require('./auth.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Service for admin authentication operations
 */
class AdminService {
  /**
   * Authenticate admin user
   * @param {string} email - Admin email
   * @param {string} password - Admin password
   * @returns {object} Object containing token and user data
   */
  async login(email, password) {
    console.log(`Admin login attempt:`, email);
    
    const user = await authService.validateCredentials(email, password, 'ADMIN');
    
    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }
    
    // Generate JWT token
    const token = authService.generateToken(user, 'ADMIN');
    
    return {
      success: true,
      token,
      user: authService.formatUserResponse(user)
    };
  }
}

module.exports = new AdminService(); 