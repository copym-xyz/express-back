const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware to check if user is authenticated and is an issuer
const isIssuer = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const isIssuerRole = req.user.roles.some(role => role.role === 'ISSUER');
  if (!isIssuerRole) {
    return res.status(403).json({ message: 'Forbidden - Issuer access required' });
  }
  
  next();
};

// Get issuer profile data
router.get('/profile', isIssuer, async (req, res) => {
  try {
    console.log('Fetching profile for issuer:', req.user.id);
    
    const issuerProfile = await prisma.issuer.findUnique({
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

    if (!issuerProfile) {
      return res.status(404).json({ message: 'Issuer profile not found' });
    }

    // Format the response data
    const profileData = {
      email: issuerProfile.user.email,
      first_name: issuerProfile.user.first_name,
      last_name: issuerProfile.user.last_name,
      profile: {
        company_name: issuerProfile.company_name,
        company_registration_number: issuerProfile.company_registration_number,
        registration_number: issuerProfile.company_registration_number, // For compatibility
        jurisdiction: issuerProfile.jurisdiction,
        verification_status: issuerProfile.verification_status,
        address: issuerProfile.address || 'Not provided'
      }
    };

    res.json(profileData);
  } catch (error) {
    console.error('Error fetching issuer profile:', error);
    res.status(500).json({ message: 'Failed to fetch issuer profile' });
  }
});

// Get issuer dashboard data
router.get('/dashboard', isIssuer, async (req, res) => {
  try {
    const issuerProfile = await prisma.issuer.findUnique({
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

    if (!issuerProfile) {
      return res.status(404).json({ message: 'Issuer profile not found' });
    }

    // Format the response data
    const dashboardData = {
      company_name: issuerProfile.company_name,
      company_registration_number: issuerProfile.company_registration_number,
      jurisdiction: issuerProfile.jurisdiction,
      verification_status: issuerProfile.verification_status,
      email: issuerProfile.user.email,
      first_name: issuerProfile.user.first_name,
      last_name: issuerProfile.user.last_name
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching issuer data:', error);
    res.status(500).json({ message: 'Failed to fetch issuer data' });
  }
});

module.exports = router; 