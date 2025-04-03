const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
        admin: true,
      },
    });

    if (!user || !user.roles.some(r => r.role === 'ADMIN')) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error logging in' });
      }
      return res.json({
        id: user.id,
        email: user.email,
        roles: user.roles.map(r => r.role),
      });
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
        roles: true,
        issuer: true,
      },
    });

    if (!user || !user.roles.some(r => r.role === 'ISSUER')) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error logging in' });
      }
      return res.json({
        id: user.id,
        email: user.email,
        roles: user.roles.map(r => r.role),
      });
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
        roles: true,
        investor: true,
      },
    });

    if (!user || !user.roles.some(r => r.role === 'INVESTOR')) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error logging in' });
      }
      return res.json({
        id: user.id,
        email: user.email,
        roles: user.roles.map(r => r.role),
      });
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

    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        first_name,
        last_name,
        roles: {
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
        roles: true,
        issuer: true,
      },
    });

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error logging in' });
      }
      return res.json({
        id: user.id,
        email: user.email,
        roles: user.roles.map(r => r.role),
      });
    });
  } catch (error) {
    console.error(error);
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
        roles: {
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
        roles: true,
        investor: true,
      },
    });

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error logging in' });
      }
      return res.json({
        id: user.id,
        email: user.email,
        roles: user.roles.map(r => r.role),
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check Authentication Status
router.get('/check', (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
      },
      roles: req.user.roles.map(r => r.role),
    });
  }
  res.json({ authenticated: false });
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
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
    res.redirect(process.env.CLIENT_URL);
  }
);

// Get current user
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json(req.user);
});

module.exports = router; 