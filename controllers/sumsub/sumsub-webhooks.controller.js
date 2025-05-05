const sumsubWebhooksService = require('../../services/sumsub/sumsub-webhooks.service');

/**
 * Sumsub Webhooks Controller - Handles Sumsub webhook HTTP requests
 */
class SumsubWebhooksController {
  /**
   * Handle Sumsub webhook
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async handleWebhook(req, res) {
    try {
      // Get request data
      const type = req.body.type || 'unknown';
      const payload = req.body;
      
      // Process webhook
      const result = await sumsubWebhooksService.processWebhook(type, payload);
      
      // Return success response
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error('Error processing Sumsub webhook:', error);
      
      // Always return 200 response for webhooks to prevent retries
      return res.status(200).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

module.exports = new SumsubWebhooksController(); 