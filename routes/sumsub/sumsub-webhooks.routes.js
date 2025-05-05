const express = require('express');
const router = express.Router();
const sumsubWebhooksController = require('../../controllers/sumsub/sumsub-webhooks.controller');

// Handle raw body for Sumsub webhooks
router.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store the raw body for signature verification
    req.rawBody = buf;
  }
}));

// Handle Sumsub webhook
router.post('/', sumsubWebhooksController.handleWebhook);

module.exports = router; 