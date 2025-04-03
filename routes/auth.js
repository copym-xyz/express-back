const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

// Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    console.log('Admin login attempt:', req.body.email);
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
        admin: true,
      },
    });

    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.roles.some(r => r.role === 'ADMIN')) {
      console.log('User does not have ADMIN role:', email);
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, roles: user.roles.map(r => r.role) },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    req.login(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Error logging in' });
      }
      
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles.map(r => r.role),
        }
      });
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Issuer Login
router.post('/issuer/login', async (req, res) => {
  try {
    console.log('Issuer login attempt:', req.body.email);
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
        issuer: true,
      },
    });

    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.roles.some(r => r.role === 'ISSUER')) {
      console.log('User does not have ISSUER role:', email);
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, roles: user.roles.map(r => r.role) },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    req.login(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Error logging in' });
      }
      
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles.map(r => r.role),
        }
      });
    });
  } catch (error) {
    console.error('Issuer login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Investor Login
router.post('/investor/login', async (req, res) => {
  try {
    console.log('Investor login attempt:', req.body.email);
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
        investor: true,
      },
    });

    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.roles.some(r => r.role === 'INVESTOR')) {
      console.log('User does not have INVESTOR role:', email);
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, roles: user.roles.map(r => r.role) },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    req.login(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Error logging in' });
      }
      
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles.map(r => r.role),
        }
      });
    });
  } catch (error) {
    console.error('Investor login error:', error);
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
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        roles: req.user.roles.map(r => r.role),
      },
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
  (req, res, next) => {
    // Store role hint in session if provided
    if (req.query.rolehint) {
      req.session.rolehint = req.query.rolehint;
      console.log('Role hint stored in session:', req.query.rolehint);
    }
    next();
  },
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Check if user object exists
    if (!req.user) {
      console.error('Google auth callback - User object missing');
      return res.redirect(`${process.env.CLIENT_URL}/login`);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email, roles: req.user.roles.map(r => r.role) },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    // Determine redirect based on user role
    let redirectUrl = `${process.env.CLIENT_URL}`;

    // If user has admin role, redirect to admin dashboard
    if (req.user.roles.some(r => r.role === 'ADMIN')) {
      redirectUrl += '/admin/dashboard';
    }
    // If user has issuer role, redirect to issuer dashboard
    else if (req.user.roles.some(r => r.role === 'ISSUER')) {
      redirectUrl += '/issuer/dashboard';
    }
    // If user has investor role, redirect to investor dashboard
    else if (req.user.roles.some(r => r.role === 'INVESTOR')) {
      redirectUrl += '/investor/dashboard';
    }

    // Append token as a query parameter
    redirectUrl += `?token=${token}`;
    
    // Redirect to the client with the token
    res.redirect(redirectUrl);
  }
);

// Twitter OAuth routes
router.get(
  '/twitter',
  (req, res, next) => {
    // Store role hint in session if provided
    if (req.query.rolehint) {
      req.session.rolehint = req.query.rolehint;
      console.log('Role hint stored in session:', req.query.rolehint);
    }
    next();
  },
  passport.authenticate('twitter')
);

router.get(
  '/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/login' }),
  (req, res) => {
    // Check if user object exists
    if (!req.user) {
      console.error('Twitter auth callback - User object missing');
      return res.redirect(`${process.env.CLIENT_URL}/login`);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email, roles: req.user.roles.map(r => r.role) },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    // Determine redirect based on user role
    let redirectUrl = `${process.env.CLIENT_URL}`;

    // If user has admin role, redirect to admin dashboard
    if (req.user.roles.some(r => r.role === 'ADMIN')) {
      redirectUrl += '/admin/dashboard';
    }
    // If user has issuer role, redirect to issuer dashboard
    else if (req.user.roles.some(r => r.role === 'ISSUER')) {
      redirectUrl += '/issuer/dashboard';
    }
    // If user has investor role, redirect to investor dashboard
    else if (req.user.roles.some(r => r.role === 'INVESTOR')) {
      redirectUrl += '/investor/dashboard';
    }

    // Append token as a query parameter
    redirectUrl += `?token=${token}`;
    
    // Redirect to the client with the token
    res.redirect(redirectUrl);
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