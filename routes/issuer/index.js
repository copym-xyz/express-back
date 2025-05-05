const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../../middleware/auth');
const issuerController = require('../../controllers/issuer/issuer.controller');

// Middleware to check if user is authenticated and is an issuer
const isIssuer = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  // Check if userrole exists and then check if the user has the ISSUER role
  const userRoles = req.user.userrole || [];
  
  const isIssuerRole = userRoles.some(role => role.role === 'ISSUER');
  if (!isIssuerRole) {
    return res.status(403).json({ message: 'Forbidden - Issuer access required' });
  }
  
  next();
};

// Basic profile routes
router.get('/me', authenticateJWT, issuerController.getProfile);
router.get('/profile', isIssuer, issuerController.getProfile);
router.get('/dashboard', isIssuer, issuerController.getProfile);
router.put('/profile', isIssuer, issuerController.updateProfile);

// KYC related routes
router.get('/kyc-status', authenticateJWT, issuerController.getKycStatus);
router.get('/kyc-verification-url', isIssuer, issuerController.getKycVerificationUrl);

// Offering related routes
router.get('/offerings', isIssuer, issuerController.getOfferings);
router.post('/offerings', isIssuer, issuerController.createOffering);
router.get('/offerings/:offeringId', isIssuer, issuerController.getOfferingDetails);
router.put('/offerings/:offeringId', isIssuer, issuerController.updateOffering);
router.post('/offerings/:offeringId/documents', isIssuer, issuerController.uploadDocument);

module.exports = router; 