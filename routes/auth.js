const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const { importSPKI, exportJWK } = require('jose');

// Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    console.log('Admin login attempt:', req.body.email);
    const { email, password } = req.body;

    const user = await prisma.users.findUnique({
      where: { email },
      include: {
        userrole: true,
        admin: true,
      },
    });

    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Debug user roles
    console.log('User roles:', JSON.stringify(user.userrole));

    // Check if the user has ADMIN role
    if (!user.userrole || !user.userrole.some(r => r.role === 'ADMIN')) {
      console.log('User does not have ADMIN role:', email);
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    if (!user.password) {
      console.log('Password missing for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        roles: user.userrole.map(r => r.role),
        isAdmin: true
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        roles: user.userrole.map(r => r.role),
      }
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

    // Debug the full user object to see what's happening
    const fullUser = await prisma.users.findUnique({
      where: { email },
    });
    console.log('Full user object:', JSON.stringify(fullUser, null, 2));

    // Check if userroles exist for this user
    const userRoles = await prisma.userrole.findMany({
      where: { user_id: fullUser?.id }
    });
    console.log('User roles from direct query:', JSON.stringify(userRoles, null, 2));

    const user = await prisma.users.findUnique({
      where: { email },
      include: {
        userrole: true,
        issuer: true,
      },
    });

    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Debug user roles
    console.log('User roles from include:', JSON.stringify(user.userrole));

    // Check if the user has ISSUER role
    if (!user.userrole || !user.userrole.some(r => r.role === 'ISSUER')) {
      console.log('User does not have ISSUER role:', email);
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    if (!user.password) {
      console.log('Password missing for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        roles: user.userrole.map(r => r.role),
        isIssuer: true
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        roles: user.userrole.map(r => r.role),
      }
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

    const user = await prisma.users.findUnique({
      where: { email },
      include: {
        userrole: true,
        investor: true,
      },
    });

    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Debug user roles
    console.log('User roles:', JSON.stringify(user.userrole));

    // Check if the user has INVESTOR role
    if (!user.userrole || !user.userrole.some(r => r.role === 'INVESTOR')) {
      console.log('User does not have INVESTOR role:', email);
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    if (!user.password) {
      console.log('Password missing for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        roles: user.userrole.map(r => r.role),
        isInvestor: true
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        roles: user.userrole.map(r => r.role),
      }
    });
  } catch (error) {
    console.error('Investor login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Issuer Registration
router.post('/issuer/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, company_name, company_registration_number, jurisdiction } = req.body;

    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Use a default value for company_registration_number if not provided
    const registrationNumber = company_registration_number || 'Not provided';

    const user = await prisma.users.create({
      data: {
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

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        roles: user.userrole.map(r => r.role),
        isIssuer: true
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        roles: user.userrole.map(r => r.role),
      }
    });
  } catch (error) {
    console.error('Issuer registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Investor Registration
router.post('/investor/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, investor_type } = req.body;

    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        created_at: new Date(),
        updated_at: new Date(),
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

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        roles: user.userrole.map(r => r.role),
        isInvestor: true
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        roles: user.userrole.map(r => r.role),
      }
    });
  } catch (error) {
    console.error('Investor registration error:', error);
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
        roles: req.user.userrole ? req.user.userrole.map(r => r.role) : [],
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
      { 
        userId: req.user.id, 
        email: req.user.email, 
        roles: req.user.userrole ? req.user.userrole.map(r => r.role) : [] 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    // Determine redirect based on user role
    let redirectUrl = `${process.env.CLIENT_URL}`;

    // If user has admin role, redirect to admin dashboard
    if (req.user.userrole?.some(r => r.role === 'ADMIN')) {
      redirectUrl += '/admin/dashboard';
    }
    // If user has issuer role, redirect to issuer dashboard
    else if (req.user.userrole?.some(r => r.role === 'ISSUER')) {
      redirectUrl += '/issuer/dashboard';
    }
    // If user has investor role, redirect to investor dashboard
    else if (req.user.userrole?.some(r => r.role === 'INVESTOR')) {
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
      { 
        userId: req.user.id, 
        email: req.user.email, 
        roles: req.user.userrole ? req.user.userrole.map(r => r.role) : [] 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

    // Determine redirect based on user role
    let redirectUrl = `${process.env.CLIENT_URL}`;

    // If user has admin role, redirect to admin dashboard
    if (req.user.userrole?.some(r => r.role === 'ADMIN')) {
      redirectUrl += '/admin/dashboard';
    }
    // If user has issuer role, redirect to issuer dashboard
    else if (req.user.userrole?.some(r => r.role === 'ISSUER')) {
      redirectUrl += '/issuer/dashboard';
    }
    // If user has investor role, redirect to investor dashboard
    else if (req.user.userrole?.some(r => r.role === 'INVESTOR')) {
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

// Set initial password for accounts missing password hash
router.post('/set-initial-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.password) {
      return res.status(400).json({ message: 'User already has a password set' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.users.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return res.status(200).json({ message: 'Password set successfully' });
  } catch (error) {
    console.error('Error setting initial password:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// JWKS endpoint for Crossmint
router.get('/.well-known/jwks.json', async (req, res) => {
    try {
        if (!process.env.JWT_PUBLIC_KEY) {
            throw new Error('JWT_PUBLIC_KEY environment variable is not set');
        }

        // Decode and import the public key
        const publicKeyPEM = Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8');
        const publicKey = await importSPKI(publicKeyPEM, 'RS256');

        // Export as JWK
        const publicJwk = await exportJWK(publicKey);

        // Add required JWK parameters
        publicJwk.kid = process.env.CROSSMINT_PROJECT_ID;
        publicJwk.use = 'sig';
        publicJwk.alg = 'RS256';

        res.json({ keys: [publicJwk] });
    } catch (error) {
        console.error('Error creating JWKS:', error);
        res.status(500).json({ error: 'Failed to create JWKS' });
    }
});

module.exports = router; 