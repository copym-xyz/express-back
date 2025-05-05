const express = require('express');
const router = express.Router();
const webhooksController = require('../../controllers/webhooks/webhooks.controller');

// Set up body parser to access raw body for signature verification
router.post('/crossmint', express.json({ verify: (req, res, buf) => {
  req.rawBody = buf.toString();
}}), webhooksController.handleCrossmintWebhook);

module.exports = router; 