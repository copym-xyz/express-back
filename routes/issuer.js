const express = require('express');
const router = express.Router();
const passport = require('passport');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crossmintService = require('../services/crossmint');

// Middleware to check if user is authenticated and is an issuer
const isIssuer = [
  passport.authenticate('jwt', { session: false }),
  (req, res, next) => {
    if (!req.user || !req.user.userrole) {
      return res.status(403).json({ message: 'Forbidden - User not found' });
    }
    const isIssuerRole = req.user.userrole.some(role => role.role === 'ISSUER');
    if (!isIssuerRole) {
      return res.status(403).json({ message: 'Forbidden - Issuer access required' });
    }
    next();
  }
];

// Get issuer dashboard data
router.get('/dashboard', isIssuer, async (req, res) => {
  try {
    const issuerData = await prisma.issuer.findUnique({
      where: {
        user_id: req.user.id
      },
      include: {
        user: {
          select: {
            email: true,
            first_name: true,
            last_name: true,
            userrole: true
          }
        }
      }
    });

    if (!issuerData) {
      return res.status(404).json({ message: 'Issuer profile not found' });
    }

    // Get wallet balance if wallet exists
    let walletData = null;
    if (issuerData.wallet_address) {
      try {
        walletData = await crossmintService.getWalletBalance(issuerData.wallet_address);
      } catch (error) {
        console.error('Error fetching wallet balance:', error);
        walletData = { error: 'Failed to fetch wallet balance' };
      }
    }

    // Format the response data
    const dashboardData = {
      company_name: issuerData.company_name,
      company_registration_number: issuerData.company_registration_number,
      jurisdiction: issuerData.jurisdiction,
      verification_status: issuerData.verification_status,
      email: issuerData.user.email,
      first_name: issuerData.user.first_name,
      last_name: issuerData.user.last_name,
      roles: issuerData.user.userrole.map(role => role.role),
      wallet: issuerData.wallet_address ? {
        address: issuerData.wallet_address,
        created_at: issuerData.wallet_created_at,
        balance: walletData
      } : null
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching issuer data:', error);
    res.status(500).json({ 
      message: 'Failed to fetch issuer data',
      error: error.message
    });
  }
});

// Create wallet for issuer
router.post('/wallet', isIssuer, async (req, res) => {
  try {
    // Check if issuer already has a wallet
    const issuer = await prisma.issuer.findUnique({
      where: {
        user_id: req.user.id
      }
    });

    if (!issuer) {
      return res.status(404).json({ message: 'Issuer profile not found' });
    }

    if (issuer.wallet_address) {
      return res.status(400).json({ message: 'Issuer already has a wallet' });
    }

    // Create wallet using Crossmint service
    const walletResponse = await crossmintService.createIssuerWallet(req.user.id);
    
    // Update issuer with wallet information
    const updatedIssuer = await prisma.issuer.update({
      where: {
        user_id: req.user.id
      },
      data: {
        wallet_address: walletResponse.address,
        wallet_created_at: new Date()
      }
    });

    res.json({
      message: 'Wallet created successfully',
      wallet: {
        address: updatedIssuer.wallet_address,
        created_at: updatedIssuer.wallet_created_at
      }
    });
  } catch (error) {
    console.error('Error creating wallet:', error);
    res.status(500).json({ 
      message: 'Failed to create wallet',
      error: error.message
    });
  }
});

module.exports = router; 