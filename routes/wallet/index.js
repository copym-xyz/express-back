const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../../middleware/auth');
const walletController = require('../../controllers/wallet/wallet.controller');

// Middleware to check if user is an issuer
const checkIssuerRole = (req, res, next) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) 
      return res.status(401).json({ message: 'Unauthorized' });
    
    if (!req.user.userrole || !Array.isArray(req.user.userrole) || 
        !req.user.userrole.some(role => role.role === 'ISSUER'))
      return res.status(403).json({ message: 'Forbidden - Issuer access required' });
    
    next();
  } catch (error) {
    console.error('Error in isIssuer middleware:', error);
    return res.status(500).json({ message: 'Authentication error', error: error.message });
  }
};

// Wallet management routes
router.get('/', checkIssuerRole, walletController.getUserWallet);
router.post('/create', checkIssuerRole, walletController.createWallet);
router.get('/balance', checkIssuerRole, walletController.getWalletBalance);
router.get('/nfts', checkIssuerRole, walletController.getWalletNFTs);
router.get('/transactions', checkIssuerRole, walletController.getWalletTransactions);

module.exports = router; 