const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

/**
 * Investor Service - Contains business logic for investor-related operations
 */
class InvestorService {
  /**
   * Get profile information for the current investor
   * @param {number} userId - User ID
   * @returns {Promise<object>} Investor profile data
   */
  async getProfile(userId) {
    const investor = await prisma.investor.findFirst({
      where: { user_id: userId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            created_at: true,
            is_verified: true
          }
        }
      }
    });
    
    if (!investor) {
      throw new Error('Investor profile not found');
    }
    
    // Format the investor profile data
    return {
      id: investor.id,
      userId: investor.user_id,
      email: investor.users.email,
      firstName: investor.users.first_name,
      lastName: investor.users.last_name,
      accreditationStatus: investor.accreditation_status,
      created: investor.users.created_at,
      wallet: null // Will be populated if needed
    };
  }

  /**
   * Update the investor's profile
   * @param {number} userId - User ID
   * @param {object} profileData - Updated profile data
   * @returns {Promise<object>} Updated investor profile
   */
  async updateProfile(userId, profileData) {
    const { firstName, lastName, ...otherFields } = profileData;
    
    // Find the investor
    const investor = await prisma.investor.findFirst({
      where: { user_id: userId }
    });
    
    if (!investor) {
      throw new Error('Investor profile not found');
    }
    
    // Update investor record if there are investor-specific fields
    if (Object.keys(otherFields).length > 0) {
      await prisma.investor.update({
        where: { id: investor.id },
        data: {
          // Map snake_case db fields from camelCase input
          accreditation_status: otherFields.accreditationStatus,
          // Add other fields as needed
        }
      });
    }
    
    // Update user record
    await prisma.users.update({
      where: { id: userId },
      data: {
        first_name: firstName,
        last_name: lastName
      }
    });
    
    // Return updated profile
    return this.getProfile(userId);
  }

  /**
   * Get available investments for the investor
   * @returns {Promise<Array>} List of available investments
   */
  async getAvailableInvestments() {
    const offerings = await prisma.offering.findMany({
      where: {
        is_active: true,
        end_date: {
          gte: new Date()
        }
      },
      include: {
        issuer: {
          include: {
            users: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        },
        asset: true
      }
    });
    
    // Format the offerings data
    return offerings.map(offering => ({
      id: offering.id,
      name: offering.name,
      description: offering.description,
      symbol: offering.symbol,
      minimumInvestment: offering.minimum_investment,
      targetRaise: offering.target_raise,
      price: offering.price,
      startDate: offering.start_date,
      endDate: offering.end_date,
      issuer: {
        id: offering.issuer.id,
        name: offering.issuer.company_name,
        contactName: `${offering.issuer.users.first_name} ${offering.issuer.users.last_name}`
      },
      asset: offering.asset ? {
        id: offering.asset.id,
        type: offering.asset.type,
        contractAddress: offering.asset.contract_address,
        tokenId: offering.asset.token_id,
        chain: offering.asset.chain
      } : null
    }));
  }

  /**
   * Get details for a specific investment opportunity
   * @param {number} offeringId - Offering ID
   * @returns {Promise<object>} Offering details
   */
  async getInvestmentDetails(offeringId) {
    const offering = await prisma.offering.findUnique({
      where: { id: parseInt(offeringId) },
      include: {
        issuer: {
          include: {
            users: {
              select: {
                first_name: true,
                last_name: true,
                email: true
              }
            }
          }
        },
        asset: true,
        offeringDocument: true
      }
    });
    
    if (!offering) {
      throw new Error('Investment opportunity not found');
    }
    
    // Format the offering data
    return {
      id: offering.id,
      name: offering.name,
      description: offering.description,
      symbol: offering.symbol,
      minimumInvestment: offering.minimum_investment,
      targetRaise: offering.target_raise,
      price: offering.price,
      startDate: offering.start_date,
      endDate: offering.end_date,
      terms: offering.terms,
      issuer: {
        id: offering.issuer.id,
        name: offering.issuer.company_name,
        contactName: `${offering.issuer.users.first_name} ${offering.issuer.users.last_name}`,
        email: offering.issuer.users.email
      },
      asset: offering.asset ? {
        id: offering.asset.id,
        type: offering.asset.type,
        contractAddress: offering.asset.contract_address,
        tokenId: offering.asset.token_id,
        chain: offering.asset.chain
      } : null,
      documents: offering.offeringDocument ? [
        {
          id: offering.offeringDocument.id,
          name: offering.offeringDocument.name,
          type: offering.offeringDocument.type,
          url: offering.offeringDocument.url
        }
      ] : []
    };
  }

  /**
   * Get the investor's investments
   * @param {number} userId - User ID
   * @returns {Promise<Array>} List of investor's investments
   */
  async getMyInvestments(userId) {
    // Find the investor
    const investor = await prisma.investor.findFirst({
      where: { user_id: userId }
    });
    
    if (!investor) {
      throw new Error('Investor profile not found');
    }
    
    // Get all investments for this investor
    const investments = await prisma.investment.findMany({
      where: { investor_id: investor.id },
      include: {
        offering: {
          include: {
            issuer: true,
            asset: true
          }
        }
      }
    });
    
    // Format the investments data
    return investments.map(investment => ({
      id: investment.id,
      amount: investment.amount,
      status: investment.status,
      createdAt: investment.created_at,
      offering: {
        id: investment.offering.id,
        name: investment.offering.name,
        symbol: investment.offering.symbol,
        price: investment.offering.price,
        issuer: {
          id: investment.offering.issuer.id,
          name: investment.offering.issuer.company_name
        },
        asset: investment.offering.asset ? {
          type: investment.offering.asset.type,
          contractAddress: investment.offering.asset.contract_address,
          tokenId: investment.offering.asset.token_id,
          chain: investment.offering.asset.chain
        } : null
      }
    }));
  }

  /**
   * Create a new investment
   * @param {number} userId - User ID
   * @param {object} investmentData - Investment data
   * @returns {Promise<object>} Created investment
   */
  async createInvestment(userId, investmentData) {
    const { offeringId, amount } = investmentData;
    
    // Find the investor
    const investor = await prisma.investor.findFirst({
      where: { user_id: userId }
    });
    
    if (!investor) {
      throw new Error('Investor profile not found');
    }
    
    // Check if the offering exists and is active
    const offering = await prisma.offering.findUnique({
      where: {
        id: parseInt(offeringId),
        is_active: true,
        end_date: {
          gte: new Date()
        }
      }
    });
    
    if (!offering) {
      throw new Error('Investment opportunity not found or not active');
    }
    
    // Validate minimum investment
    if (amount < offering.minimum_investment) {
      throw new Error(`Investment amount must be at least ${offering.minimum_investment}`);
    }
    
    // Create the investment
    const investment = await prisma.investment.create({
      data: {
        investor_id: investor.id,
        offering_id: parseInt(offeringId),
        amount: parseFloat(amount),
        status: 'PENDING'
      },
      include: {
        offering: {
          include: {
            issuer: true
          }
        }
      }
    });
    
    // Format the investment data
    return {
      id: investment.id,
      amount: investment.amount,
      status: investment.status,
      createdAt: investment.created_at,
      offering: {
        id: investment.offering.id,
        name: investment.offering.name,
        issuer: {
          id: investment.offering.issuer.id,
          name: investment.offering.issuer.company_name
        }
      }
    };
  }

  /**
   * Get details for a specific investment
   * @param {number} userId - User ID
   * @param {number} investmentId - Investment ID
   * @returns {Promise<object>} Investment details
   */
  async getInvestmentDetails(userId, investmentId) {
    // Find the investor
    const investor = await prisma.investor.findFirst({
      where: { user_id: userId }
    });
    
    if (!investor) {
      throw new Error('Investor profile not found');
    }
    
    // Get the investment
    const investment = await prisma.investment.findFirst({
      where: {
        id: parseInt(investmentId),
        investor_id: investor.id
      },
      include: {
        offering: {
          include: {
            issuer: true,
            asset: true,
            offeringDocument: true
          }
        }
      }
    });
    
    if (!investment) {
      throw new Error('Investment not found');
    }
    
    // Format the investment data
    return {
      id: investment.id,
      amount: investment.amount,
      status: investment.status,
      createdAt: investment.created_at,
      offering: {
        id: investment.offering.id,
        name: investment.offering.name,
        symbol: investment.offering.symbol,
        price: investment.offering.price,
        issuer: {
          id: investment.offering.issuer.id,
          name: investment.offering.issuer.company_name
        },
        asset: investment.offering.asset ? {
          type: investment.offering.asset.type,
          contractAddress: investment.offering.asset.contract_address,
          tokenId: investment.offering.asset.token_id,
          chain: investment.offering.asset.chain
        } : null,
        documents: investment.offering.offeringDocument ? [
          {
            id: investment.offering.offeringDocument.id,
            name: investment.offering.offeringDocument.name,
            type: investment.offering.offeringDocument.type,
            url: investment.offering.offeringDocument.url
          }
        ] : []
      }
    };
  }
}

module.exports = new InvestorService(); 