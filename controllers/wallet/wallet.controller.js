const walletService = require('../../services/wallet/wallet.service');

/**
 * Wallet Controller - Handles wallet-related HTTP requests
 */
class WalletController {
  /**
   * Get user's wallet
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getUserWallet(req, res) {
    try {
      const userId = req.user.id;
      const chain = req.query.chain || 'ethereum-sepolia';
      const isIssuer = req.user.userrole.some(role => role.role === 'ISSUER');
      
      const wallet = await walletService.getUserWallet(userId, isIssuer, chain);
      res.json(wallet);
    } catch (error) {
      console.error('Error getting wallet:', error);
      res.status(500).json({ 
        message: 'Error in wallet route', 
        error: error.message 
      });
    }
  }

  /**
   * Create a new wallet for a specific chain
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async createWallet(req, res) {
    try {
      const { chain } = req.body;
      if (!chain) {
        return res.status(400).json({
          error: 'Chain parameter is required',
          supportedChains: walletService.getSupportedChains()
        });
      }
      
      const isIssuer = req.user.userrole.some(role => role.role === 'ISSUER');
      const result = await walletService.createWallet(req.user.id, isIssuer, chain);
      
      res.json({
        success: true,
        wallet: result.wallet,
        chain: result.chain,
        did: result.did
      });
    } catch (error) {
      console.error('Error creating wallet:', error);
      res.status(500).json({ 
        message: 'Error creating wallet', 
        error: error.message 
      });
    }
  }

  /**
   * Get wallet balance
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getWalletBalance(req, res) {
    try {
      const balance = await walletService.getWalletBalance(req.user.id);
      res.json(balance);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      const statusCode = error.message === 'No wallet found for this user' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch wallet balance',
        error: error.message 
      });
    }
  }

  /**
   * Get NFTs owned by the wallet
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getWalletNFTs(req, res) {
    try {
      const nfts = await walletService.getWalletNFTs(req.user.id);
      res.json(nfts);
    } catch (error) {
      console.error('Error fetching wallet NFTs:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch wallet NFTs',
        error: error.message 
      });
    }
  }

  /**
   * Get wallet transactions
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async getWalletTransactions(req, res) {
    try {
      const transactions = await walletService.getWalletTransactions(req.user.id);
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching wallet transactions:', error);
      const statusCode = error.message === 'No wallet found for this user' ? 404 : 500;
      res.status(statusCode).json({ 
        message: error.message || 'Failed to fetch wallet transactions',
        error: error.message 
      });
    }
  }
}

module.exports = new WalletController(); 