const express = require('express');
const router = express.Router();
const passport = require('passport');

// Import controllers
const authController = require('../../controllers/auth/auth.controller');
const adminController = require('../../controllers/auth/admin.controller');
const issuerController = require('../../controllers/auth/issuer.controller');
const investorController = require('../../controllers/auth/investor.controller');

// Admin routes
router.post('/admin/login', adminController.login);

// Issuer routes
router.post('/issuer/login', issuerController.login);
router.post('/issuer/register', issuerController.register);

// Investor routes
router.post('/investor/login', investorController.login);
router.post('/investor/register', investorController.register);

// OAuth routes
router.get('/google', 
  authController.storeRoleHint,
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  investorController.handleOAuthCallback,
  authController.handleOAuthSuccess
);

module.exports = router; 