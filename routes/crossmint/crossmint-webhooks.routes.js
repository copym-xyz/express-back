const express = require('express');
const router = express.Router();
const crossmintWebhooksController = require('../../controllers/crossmint/crossmint-webhooks.controller');

// Add logging middleware
router.use((req, res, next) => {
  console.log(`Crossmint webhook request received: ${req.method} ${req.originalUrl}`);
  next();
});

// Set up body parser to access raw body for signature verification
router.post('/', express.json({ verify: (req, res, buf) => {
  req.rawBody = buf.toString();
}}), crossmintWebhooksController.handleWebhook);

module.exports = router; 