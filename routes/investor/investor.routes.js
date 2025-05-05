const express = require('express');
const router = express.Router();
const { isInvestor } = require('../../middleware/auth');
const investorController = require('../../controllers/investor/investor.controller');

// Profile routes
router.get('/profile', isInvestor, investorController.getProfile);
router.put('/profile', isInvestor, investorController.updateProfile);

// Investment opportunity routes
router.get('/offerings', isInvestor, investorController.getAvailableInvestments);
router.get('/offerings/:offeringId', isInvestor, investorController.getOfferingDetails);

// Investment management routes
router.get('/investments', isInvestor, investorController.getMyInvestments);
router.post('/investments', isInvestor, investorController.createInvestment);
router.get('/investments/:investmentId', isInvestor, investorController.getInvestmentDetails);

module.exports = router; 