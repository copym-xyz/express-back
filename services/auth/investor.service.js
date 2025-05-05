const authService = require('./auth.service');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * Service for investor authentication operations
 */
class InvestorService {
  /**
   * Authenticate investor user
   * @param {string} email - Investor email
   * @param {string} password - Investor password
   * @returns {object} Object containing token and user data
   */
  async login(email, password) {
    console.log(`Investor login attempt:`, email);
    
    const user = await authService.validateCredentials(email, password, 'INVESTOR');
    
    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }
    
    // Generate JWT token
    const token = authService.generateToken(user, 'INVESTOR');
    
    return {
      success: true,
      token,
      user: authService.formatUserResponse(user)
    };
  }

  /**
   * Register a new investor
   * @param {object} investorData - Registration data
   * @returns {object} Registration result
   */
  async register(investorData) {
    const { email, password, firstName, lastName, investor_type } = investorData;

    if (!email || !password || !firstName || !lastName) {
      return { 
        success: false, 
        message: 'Required fields missing',
        missing: Object.entries({email, password, firstName, lastName})
                    .filter(([_,v]) => !v).map(([k]) => k)
      };
    }

    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, message: 'User already exists' };
    }

    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const user = await prisma.users.create({
        data: {
          email,
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          created_at: new Date(),
          updated_at: new Date(),
          userrole: {
            create: {
              role: 'INVESTOR',
            },
          },
          investor: {
            create: {
              investor_type: investor_type || 'INDIVIDUAL',
              accreditation_status: 'PENDING',
              kyc_verified: false,
              aml_verified: false,
            },
          },
        },
        include: {
          userrole: true,
          investor: true,
        },
      });

      // Generate JWT token
      const token = authService.generateToken(user, 'INVESTOR');

      return {
        success: true,
        token,
        user: authService.formatUserResponse(user)
      };
    } catch (error) {
      console.error('Investor registration error:', error);
      return { success: false, message: 'Server error' };
    }
  }

  /**
   * Handle OAuth authentication callback
   * @param {object} profile - OAuth profile
   * @param {string} role - User role
   * @returns {object} User data
   */
  async handleOAuthCallback(profile, role = 'INVESTOR') {
    try {
      // Extract data from OAuth profile
      const { id: oauthId, emails, displayName, provider } = profile;
      
      if (!emails || emails.length === 0) {
        throw new Error('No email found in OAuth profile');
      }
      
      const email = emails[0].value;
      let user = null;
      
      // Check if user already exists
      user = await prisma.users.findFirst({
        where: {
          OR: [
            { email },
            { oauthId: `${provider}:${oauthId}` }
          ]
        },
        include: {
          userrole: true,
          investor: true
        }
      });
      
      if (user) {
        // Update OAuth ID if not present
        if (!user.oauthId) {
          await prisma.users.update({
            where: { id: user.id },
            data: { oauthId: `${provider}:${oauthId}` }
          });
        }
      } else {
        // Create new user
        // Split displayName into first and last name
        let firstName = displayName;
        let lastName = '';
        
        if (displayName && displayName.includes(' ')) {
          const names = displayName.split(' ');
          firstName = names[0];
          lastName = names.slice(1).join(' ');
        }
        
        user = await prisma.users.create({
          data: {
            email,
            oauthId: `${provider}:${oauthId}`,
            first_name: firstName,
            last_name: lastName,
            created_at: new Date(),
            updated_at: new Date(),
            userrole: {
              create: {
                role
              }
            },
            investor: role === 'INVESTOR' ? {
              create: {
                investor_type: 'INDIVIDUAL',
                accreditation_status: 'PENDING',
                kyc_verified: false,
                aml_verified: false
              }
            } : undefined
          },
          include: {
            userrole: true,
            investor: true
          }
        });
      }
      
      return {
        success: true,
        user: user,
        token: authService.generateToken(user, role)
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return { success: false, message: 'Authentication failed' };
    }
  }
}

module.exports = new InvestorService(); 