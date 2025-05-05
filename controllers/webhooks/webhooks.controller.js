const webhooksService = require('../../services/webhooks/webhooks.service');

/**
 * Webhooks Controller - Handles webhook HTTP requests
 */
class WebhooksController {
  /**
   * Handle Crossmint webhook
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async handleCrossmintWebhook(req, res) {
    try {
      // Get signature from headers
      const signature = req.headers['x-webhook-signature'];
      const rawBody = req.rawBody;
      
      const result = await webhooksService.processCrossmintWebhook(
        req.body, 
        signature, 
        rawBody
      );
      
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('Error processing Crossmint webhook:', error);
      // Return 200 even on error to prevent retries
      return res.status(200).json({ success: false, error: error.message });
    }
  }
}

module.exports = new WebhooksController(); 