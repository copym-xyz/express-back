const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../../middleware/auth');
const issuerVcController = require('../../controllers/issuer-vc/issuer-vc.controller');

// Test route
router.get('/test', issuerVcController.test);

// Issue credential routes
router.post('/', authenticateJWT, issuerVcController.issueCredential);

// For backward compatibility, add a route for the endpoint the frontend is calling
router.post('/issue-vc', authenticateJWT, issuerVcController.issueCredential);

module.exports = router; 