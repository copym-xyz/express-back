const express = require('express');
const router = express.Router();
const sumsubController = require('../controllers/sumsub/sumsub.controller');
const { authenticateJWT } = require('../middleware/auth');

// Route to get access token - no authentication required for testing
router.get('/token', sumsubController.getAccessToken);

// Route to create an applicant - requires authentication
router.post('/applicant', authenticateJWT, sumsubController.createApplicant);

// Route to get applicant status - requires authentication
router.get('/applicant/:applicantId/status', authenticateJWT, sumsubController.getApplicantStatus);

// Route for testing
router.get('/test', (req, res) => {
  res.json({ message: 'Sumsub routes are working!' });
});

module.exports = router; 