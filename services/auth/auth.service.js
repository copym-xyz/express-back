const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Base authentication service with common authentication functions
 */
class AuthService {
  /**
   * Generate JWT token for a user
   * @param {object} user - User object from database
   * @returns {string} JWT token
   */
  generateToken(user, role) {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        roles: user.userrole.map(r => r.role),
        [`is${role}`]: true
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
  }

  /**
   * Format user data for response
   * @param {object} user - User object from database
   * @returns {object} Formatted user data
   */
  formatUserResponse(user) {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      roles: user.userrole.map(r => r.role),
    };
  }

  /**
   * Validate user credentials and role
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} role - Required role
   * @returns {object|null} User object if valid, null otherwise
   */
  async validateCredentials(email, password, role) {
    const user = await prisma.users.findUnique({
      where: { email },
      include: {
        userrole: true,
        [role.toLowerCase()]: true,
      },
    });

    if (!user) {
      console.log('User not found:', email);
      return null;
    }

    // Check if the user has the correct role
    if (!user.userrole || !user.userrole.some(r => r.role === role)) {
      console.log(`User does not have ${role} role:`, email);
      return null;
    }

    if (!user.password) {
      console.log('Password missing for user:', email);
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return null;
    }

    return user;
  }
}

module.exports = new AuthService(); 