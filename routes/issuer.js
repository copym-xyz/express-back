const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware to check if user is authenticated and is an issuer
const isIssuer = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  // Log user for debugging
  console.log('User in isIssuer middleware:', req.user);
  
  // Check if userrole exists and then check if the user has the ISSUER role
  const userRoles = req.user.userrole || [];
  console.log('User roles in middleware:', userRoles);
  
  const isIssuerRole = userRoles.some(role => role.role === 'ISSUER');
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
        users: {
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
      email: issuerProfile.users.email,
      first_name: issuerProfile.users.first_name,
      last_name: issuerProfile.users.last_name,
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
        users: {
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
      email: issuerProfile.users.email,
      first_name: issuerProfile.users.first_name,
      last_name: issuerProfile.users.last_name
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching issuer data:', error);
    res.status(500).json({ message: 'Failed to fetch issuer data' });
  }
});

// Add KYC status endpoint
router.get('/kyc-status', async (req, res) => {
  try {
    // Check if user exists from JWT middleware
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = req.user.id;
    
    // Find the issuer record to get the applicant ID
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId }
    });
    
    if (!issuer || !issuer.sumsub_applicant_id) {
      return res.status(404).json({ message: 'No KYC verification found' });
    }
    
    // Get the latest KYC verification record
    const latestVerification = await prisma.kycVerification.findFirst({
      where: { 
        applicant_id: issuer.sumsub_applicant_id 
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    
    if (!latestVerification) {
      return res.json(null);
    }
    
    return res.json(latestVerification);
  } catch (error) {
    console.error('Error fetching KYC status:', error);
    return res.status(500).json({ message: 'Failed to fetch KYC status', error: error.message });
  }
});

// Get issuer DID information
router.get('/did', isIssuer, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find the issuer profile
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: userId },
      include: {
        users: {
          include: {
            wallet: true
          }
        }
      }
    });
    
    if (!issuer) {
      return res.status(404).json({ success: false, message: 'Issuer profile not found' });
    }
    
    // Check if user has a wallet
    if (!issuer.users.wallet) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet not found. A wallet is required to have a DID.' 
      });
    }
    
    // Check if verification is done
    if (!issuer.verification_status) {
      return res.status(400).json({
        success: false,
        message: 'Your account is not verified yet. Verification is required to have a DID.',
        verificationStatus: false
      });
    }
    
    // Return DID info
    if (issuer.did) {
      return res.json({
        success: true,
        did: issuer.did,
        verificationStatus: true,
        wallet: {
          address: issuer.users.wallet.address,
          type: issuer.users.wallet.type,
          chain: issuer.users.wallet.chain
        }
      });
    } else {
      return res.json({
        success: false,
        did: null,
        message: 'DID not yet generated. It will be generated automatically after verification.',
        verificationStatus: true,
        wallet: {
          address: issuer.users.wallet.address,
          type: issuer.users.wallet.type,
          chain: issuer.users.wallet.chain
        }
      });
    }
  } catch (error) {
    console.error('Error fetching issuer DID information:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch DID information', error: error.message });
  }
});

// Add this endpoint after the '/me' endpoint
/**
 * @route GET /api/issuer/personal-info
 * @desc Get personal information for the authenticated issuer
 * @access Private
 */
router.get('/personal-info', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    // Find issuer by user ID
    const issuer = await prisma.issuer.findFirst({
      where: { user_id: req.user.id }
    });
    
    if (!issuer) {
      return res.status(404).json({ success: false, message: 'Issuer not found' });
    }
    
    // Find personal info by applicant ID if available
    let personalInfo = null;
    
    if (issuer.sumsub_applicant_id) {
      personalInfo = await prisma.kyc_personal_info.findFirst({
        where: { applicant_id: issuer.sumsub_applicant_id }
      });
    }
    
    // If not found by applicant ID, try by user ID
    if (!personalInfo) {
      personalInfo = await prisma.kyc_personal_info.findFirst({
        where: { user_id: req.user.id }
      });
    }
    
    if (!personalInfo) {
      return res.status(404).json({ 
        success: false, 
        message: 'Personal information not found',
        issuer: {
          id: issuer.id,
          applicantId: issuer.sumsub_applicant_id || null
        }
      });
    }
    
    // Return the personal information
    res.json({
      success: true,
      personalInfo: {
        id: personalInfo.id,
        full_name: personalInfo.full_name,
        first_name: personalInfo.first_name,
        last_name: personalInfo.last_name,
        date_of_birth: personalInfo.date_of_birth,
        country: personalInfo.country,
        nationality: personalInfo.nationality,
        email: personalInfo.email,
        phone: personalInfo.phone,
        id_number: personalInfo.id_number,
        updatedAt: personalInfo.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching personal info:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router; 