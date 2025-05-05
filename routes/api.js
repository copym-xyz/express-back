const express = require('express');
const router = express.Router();

// Import routes
const sumsubRoutes = require('./sumsub.routes');
const authRoutes = require('./auth/auth.routes');
const issuerRoutes = require('./issuer');
const investorRoutes = require('./investor');
const walletRoutes = require('./wallet');
const adminRoutes = require('./admin/admin.routes');
const issuerVcRoutes = require('./issuer-vc');

// Register routes
router.use('/sumsub', sumsubRoutes);
router.use('/auth', authRoutes);
router.use('/issuer', issuerRoutes);
router.use('/investor', investorRoutes);
router.use('/wallet', walletRoutes);
router.use('/admin', adminRoutes);
router.use('/issuer-vc', issuerVcRoutes);

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'API is working properly!' });
});

module.exports = router; 