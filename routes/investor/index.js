const express = require('express');
const router = express.Router();
const investorController = require('../../controllers/investor/investor.controller');

// Middleware to check if user is an investor
const isInvestor = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const userRoles = req.user.userrole || [];
  if (!userRoles.some(role => role.role === 'INVESTOR')) {
    return res.status(403).json({ message: 'Forbidden - Investor access required' });
  }
  
  next();
};

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