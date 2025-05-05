const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../middleware/auth');
const adminController = require('../../controllers/admin/admin.controller');

// Sumsub related routes
router.get('/sumsub/applicants', isAdmin, adminController.getSumsubApplicants);
router.get('/sumsub/applicants/:applicantId', isAdmin, adminController.getSumsubApplicant);
router.get('/sumsub/applicants/:applicantId/documents', isAdmin, adminController.getSumsubApplicantDocuments);

// User management routes
router.get('/users', isAdmin, adminController.getAllUsers);

// KYC verification routes
router.get('/kyc-verifications', isAdmin, adminController.getKycVerifications);
router.get('/kyc-verifications/:id', isAdmin, adminController.getKycVerificationDetails);
router.get('/kyc-personal-info/:applicantId', isAdmin, adminController.getKycPersonalInfo);
router.post('/fix-kyc-associations', isAdmin, adminController.fixKycAssociations);

// Wallet management routes
router.get('/wallets', isAdmin, adminController.getAllWallets);
router.get('/wallets/:walletId', isAdmin, adminController.getWalletDetails);
router.get('/wallets/:walletId/balance', isAdmin, adminController.getWalletBalance);
router.get('/wallets/:walletId/transactions', isAdmin, adminController.getWalletTransactions);

// DID generation routes
router.post('/generate-did/:issuerId', isAdmin, adminController.generateDIDForIssuer);
router.post('/generate-all-dids', isAdmin, adminController.generateAllDIDs);

module.exports = router; 