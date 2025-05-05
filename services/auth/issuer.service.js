const authService = require('./auth.service');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * Service for issuer authentication operations
 */
class IssuerService {
  /**
   * Authenticate issuer user
   * @param {string} email - Issuer email
   * @param {string} password - Issuer password
   * @returns {object} Object containing token and user data
   */
  async login(email, password) {
    console.log(`Issuer login attempt:`, email);
    
    const user = await authService.validateCredentials(email, password, 'ISSUER');
    
    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }
    
    // Generate JWT token
    const token = authService.generateToken(user, 'ISSUER');
    
    return {
      success: true,
      token,
      user: authService.formatUserResponse(user)
    };
  }

  /**
   * Register a new issuer
   * @param {object} issuerData - Registration data
   * @returns {object} Registration result
   */
  async register(issuerData) {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      company_name, 
      company_registration_number, 
      jurisdiction 
    } = issuerData;

    if (!email || !password || !firstName || !lastName || !company_name || !jurisdiction) {
      console.log('Missing required fields for issuer registration');
      return { 
        success: false,
        message: 'All fields are required', 
        missing: Object.entries({email, password, firstName, lastName, company_name, jurisdiction})
                    .filter(([_,v]) => !v).map(([k]) => k) 
      };
    }

    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, message: 'User already exists' };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Use a default value for company_registration_number if not provided
    const registrationNumber = company_registration_number || 'Not provided';

    // Get next issuer ID
    const nextIssuerId = await this.getNextIssuerId();
    
    try {
      // Create transaction to ensure ID consistency
      const user = await prisma.$transaction(async (prisma) => {
        // Create user with specific ID for issuers
        return await prisma.users.create({
          data: {
            id: nextIssuerId,  // Use the custom issuer ID sequence
            email,
            password: hashedPassword,
            first_name: firstName,
            last_name: lastName,
            created_at: new Date(),
            updated_at: new Date(),
            userrole: {
              create: {
                role: 'ISSUER',
              },
            },
            issuer: {
              create: {
                company_name,
                company_registration_number: registrationNumber,
                jurisdiction,
                verification_status: false,
              },
            },
          },
          include: {
            userrole: true,
            issuer: true,
          },
        });
      });

      // Generate JWT token
      const token = authService.generateToken(user, 'ISSUER');
      
      return {
        success: true,
        token,
        user: authService.formatUserResponse(user)
      };
    } catch (error) {
      console.error('Issuer registration error:', error);
      return { success: false, message: 'Server error' };
    }
  }

  /**
   * Gets the next available issuer ID starting from 100
   * @returns {number} Next available issuer ID
   */
  async getNextIssuerId() {
    // Find the highest user ID that starts with 1 (issuer ID range)
    const highestIssuer = await prisma.users.findFirst({
      where: {
        id: {
          gte: 100,  // Greater than or equal to 100
          lt: 1000   // Less than 1000 to set a reasonable upper bound
        },
        userrole: {
          some: {
            role: 'ISSUER'
          }
        }
      },
      orderBy: {
        id: 'desc'  // Get the highest ID
      }
    });

    // If no issuers exist yet, start from 100
    return highestIssuer ? highestIssuer.id + 1 : 100;
  }
}

module.exports = new IssuerService(); 