const crossmintWebhooksService = require('../../services/crossmint/crossmint-webhooks.service');

/**
 * Crossmint Webhooks Controller - Handles Crossmint webhook HTTP requests
 */
class CrossmintWebhooksController {
  /**
   * Handle a Crossmint webhook request
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async handleWebhook(req, res) {
    try {
      console.log(`Crossmint webhook request received: ${req.method} ${req.originalUrl}`);
      
      // Extract signature from headers
      const signature = req.headers['x-webhook-signature'];
      const payload = req.rawBody;

      // Process the webhook
      const result = await crossmintWebhooksService.processWebhook(
        req.body,
        signature,
        payload
      );

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('Error handling Crossmint webhook:', error);
      
      // Always return 200 for webhooks, even on error
      // This prevents unnecessary retries from the webhook provider
      res.status(200).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

module.exports = new CrossmintWebhooksController(); 