const express = require('express');
const router = express.Router();
const { isIssuer } = require('../../middleware/auth');
const issuerController = require('../../controllers/issuer/issuer.controller');

// Profile routes
router.get('/profile', isIssuer, issuerController.getProfile);
router.put('/profile', isIssuer, issuerController.updateProfile);

// KYC verification routes
router.get('/kyc/status', isIssuer, issuerController.getKycStatus);
router.get('/kyc/verification-url', isIssuer, issuerController.getKycVerificationUrl);

// Offering routes
router.get('/offerings', isIssuer, issuerController.getOfferings);
router.post('/offerings', isIssuer, issuerController.createOffering);
router.get('/offerings/:offeringId', isIssuer, issuerController.getOfferingDetails);
router.put('/offerings/:offeringId', isIssuer, issuerController.updateOffering);
router.post('/offerings/:offeringId/documents', isIssuer, issuerController.uploadDocument);

module.exports = router; 