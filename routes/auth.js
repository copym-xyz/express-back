const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateToken } = require('../config/jwt');
const crossmintService = require('../services/crossmint');

// Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userrole: true,
        admin: true,
      },
    });

    if (!user || !user.userrole.some(r => r.role === 'ADMIN')) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        roles: user.userrole.map(r => r.role),
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Issuer Login
router.post('/issuer/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userrole: true,
        issuer: true,
      },
    });

    if (!user || !user.userrole.some(r => r.role === 'ISSUER')) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        roles: user.userrole.map(r => r.role),
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Investor Login
router.post('/investor/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userrole: true,
        investor: true,
      },
    });

    if (!user || !user.userrole.some(r => r.role === 'INVESTOR')) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        roles: user.userrole.map(r => r.role),
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Issuer Registration
router.post('/issuer/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, company_name, company_registration_number, jurisdiction } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user and issuer in a transaction
    const result = await prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          email,
          password_hash,
          first_name,
          last_name,
          userrole: {
            create: {
              role: 'ISSUER',
            },
          },
          issuer: {
            create: {
              company_name,
              company_registration_number,
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

      // Create Solana wallet for the issuer
      const walletResponse = await crossmintService.createIssuerWallet(user.id);
      
      // Update issuer with wallet information
      await prisma.issuer.update({
        where: { user_id: user.id },
        data: {
          wallet_address: walletResponse.address,
          wallet_created_at: new Date(),
        },
      });

      return user;
    });

    const token = generateToken(result);
    return res.json({
      token,
      user: {
        id: result.id,
        email: result.email,
        roles: result.userrole.map(r => r.role),
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Investor Registration
router.post('/investor/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, investor_type } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        first_name,
        last_name,
        userrole: {
          create: {
            role: 'INVESTOR',
          },
        },
        investor: {
          create: {
            investor_type,
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

    const token = generateToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        roles: user.userrole.map(r => r.role),
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check Authentication Status
router.get('/check', passport.authenticate('jwt', { session: false }), (req, res) => {
  return res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      roles: req.user.userrole.map(r => r.role),
    }
  });
});

// Get current user
router.get('/me', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json(req.user);
});

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  }
);

module.exports = router; 