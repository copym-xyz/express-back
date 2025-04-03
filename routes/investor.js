const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware to check if user is authenticated and is an investor
const isInvestor = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const isInvestorRole = req.user.roles.some(role => role.role === 'INVESTOR');
  if (!isInvestorRole) {
    return res.status(403).json({ message: 'Forbidden - Investor access required' });
  }
  
  next();
};

// Get investor profile
router.get('/profile', isInvestor, async (req, res) => {
  try {
    const investorProfile = await prisma.investor.findUnique({
      where: {
        user_id: req.user.id
      },
      include: {
        user: {
          select: {
            email: true,
            first_name: true,
            last_name: true,
          }
        }
      }
    });

    if (!investorProfile) {
      return res.status(404).json({ message: 'Investor profile not found' });
    }

    // For demo purposes, add some additional calculated fields
    const dashboardData = {
      first_name: investorProfile.user.first_name,
      last_name: investorProfile.user.last_name,
      email: investorProfile.user.email,
      investor_type: investorProfile.investor_type,
      accreditation_status: investorProfile.accreditation_status,
      kyc_verified: investorProfile.kyc_verified,
      aml_verified: investorProfile.aml_verified,
      // Mock data for dashboard
      investment_capacity: 500000,
      risk_profile: 'Moderate',
      total_investments: 250000,
      active_investments: 3,
      available_balance: 250000
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching investor data:', error);
    res.status(500).json({ message: 'Failed to fetch investor data' });
  }
});

// Get available offerings
router.get('/offerings', isInvestor, async (req, res) => {
  try {
    // Mock offering data for now
    // In a real application, this would come from the database
    const mockOfferings = [
      {
        id: 1,
        name: 'Green Energy Fund',
        issuer_name: 'EcoInvest LLC',
        target_amount: 1000000,
        status: 'ACTIVE',
        min_investment: 10000,
        industry: 'Renewable Energy'
      },
      {
        id: 2,
        name: 'Tech Startup Fund',
        issuer_name: 'Innovation Capital',
        target_amount: 5000000,
        status: 'ACTIVE',
        min_investment: 25000,
        industry: 'Technology'
      },
      {
        id: 3,
        name: 'Real Estate Development',
        issuer_name: 'Urban Builders Inc',
        target_amount: 3000000,
        status: 'COMING_SOON',
        min_investment: 50000,
        industry: 'Real Estate'
      }
    ];

    res.json(mockOfferings);
  } catch (error) {
    console.error('Error fetching offerings:', error);
    res.status(500).json({ message: 'Failed to fetch offerings' });
  }
});

module.exports = router; 