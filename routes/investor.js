const express = require('express');
const router = express.Router();
const passport = require('passport');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware to check if user is authenticated and is an investor
const isInvestor = [
  passport.authenticate('jwt', { session: false }),
  (req, res, next) => {
    const isInvestorRole = req.user.roles.some(role => role.role === 'INVESTOR');
    if (!isInvestorRole) {
      return res.status(403).json({ message: 'Forbidden - Investor access required' });
    }
    next();
  }
];

// Get investor profile
router.get('/profile', isInvestor, async (req, res) => {
  try {
    console.log('User ID:', req.user?.id);
    console.log('User roles:', req.user?.roles);

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

    console.log('Investor profile:', investorProfile);

    if (!investorProfile) {
      return res.status(404).json({ message: 'Investor profile not found' });
    }

    // Format the response data
    const profileData = {
      investor_type: investorProfile.investor_type,
      accreditation_status: investorProfile.accreditation_status,
      kyc_verified: investorProfile.kyc_verified,
      aml_verified: investorProfile.aml_verified,
      email: investorProfile.user.email,
      first_name: investorProfile.user.first_name,
      last_name: investorProfile.user.last_name
    };

    res.json(profileData);
  } catch (error) {
    console.error('Error fetching investor profile:', error);
    res.status(500).json({ message: 'Failed to fetch investor profile' });
  }
});

// Get available offerings for investor
router.get('/offerings', isInvestor, async (req, res) => {
  try {
    // For now, return all offerings (you might want to add filtering logic later)
    const offerings = await prisma.offering.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        issuer: true
      }
    });

    // If no offerings exist yet, return an empty array
    if (!offerings || offerings.length === 0) {
      return res.json([]);
    }

    const formattedOfferings = offerings.map(offering => ({
      id: offering.id,
      name: offering.name,
      issuer_name: offering.issuer.company_name,
      target_amount: offering.target_amount,
      status: offering.status,
      minimum_investment: offering.minimum_investment,
      end_date: offering.end_date
    }));

    res.json(formattedOfferings);
  } catch (error) {
    console.error('Error fetching offerings:', error);
    res.status(500).json({ 
      message: 'Failed to fetch offerings',
      error: error.message 
    });
  }
});

module.exports = router; 