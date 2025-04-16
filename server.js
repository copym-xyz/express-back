require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Initialize Express app
const app = express();
const prisma = new PrismaClient();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://c470-103-175-88-11.ngrok-free.app', 'https://api.sumsub.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Session configuration
app.use(
  session({
    secret: process.env.JWT_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport config
require('./config/passport')(passport, prisma);

// JWT Authentication middleware
app.use(async (req, res, next) => {
  // Check for JWT token in Authorization header
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // If token is valid, fetch the user from the database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { roles: true }
      });
      
      if (user) {
        // Attach the user to the request object
        req.user = user;
        req.isAuthenticated = () => true;
      }
    } catch (error) {
      console.error('JWT Verification failed:', error);
      // Don't return an error, just proceed without authentication
    }
  }
  
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/issuer', require('./routes/issuer'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/investor', require('./routes/investor'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/sumsub', require('./routes/sumsub'));

// Sumsub webhook endpoint - direct route
app.post('/webhooks/sumsub', express.json({ 
  verify: (req, res, buf) => {
    // Store the raw body buffer for signature verification
    req.rawBody = buf.toString();
  }
}), async (req, res) => {
  try {
    console.log('Received webhook from Sumsub:', JSON.stringify(req.body, null, 2));
    
    // Get the signature from the headers
    const signature = req.headers['x-payload-digest'];
    const signatureAlg = req.headers['x-payload-digest-alg'] || 'HMAC_SHA1_HEX';
    
    // Verify the webhook signature
    const WEBHOOK_SECRET_KEY = 'Kjp1bbs4_rDiyQYl4feXceLqbkn';
    let signatureValid = false;
    
    if (signature && req.rawBody) {
      // For SHA1 (deprecated but required for backward compatibility)
      const calculatedSignature = crypto
        .createHmac('sha1', WEBHOOK_SECRET_KEY)
        .update(req.rawBody)
        .digest('hex');
      
      console.log('Received signature:', signature);
      console.log('Calculated signature:', calculatedSignature);
      
      signatureValid = calculatedSignature === signature;
      
      if (!signatureValid) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      }
      
      console.log('Webhook signature verified successfully');
    } else {
      console.warn('Missing signature or raw body for verification');
    }
    
    // Process the webhook
    const payload = req.body;
    
    if (!payload) {
      console.error('Empty webhook payload');
      return res.status(200).json({ success: true, message: 'Empty webhook payload, nothing to process' });
    }
    
    // If this is not an applicant-related webhook, just acknowledge it
    if (!payload.applicantId) {
      console.log('Non-applicant webhook received:', payload.type || 'unknown type');
      return res.status(200).json({ success: true, message: 'Non-applicant webhook received' });
    }
    
    // Sanitize the applicantId - some webhooks might include URL parameters
    // Remove everything after ? or & characters to get just the applicantId
    const cleanApplicantId = String(payload.applicantId).split(/[?&]/)[0].trim();
    
    console.log(`Processing webhook for applicant: ${cleanApplicantId}, type: ${payload.type}`);
    console.log(`Original applicantId: ${payload.applicantId}, Cleaned applicantId: ${cleanApplicantId}`);
    console.log(`Type of applicantId: ${typeof cleanApplicantId}`);
    
    // Add debug logging for known applicant IDs
    const knownApplicants = [
      '67fc1c3cda6a85c979a603a4',
      '67fbddcc012a2856878eda8e',
      '67fa543e55c3026f146ffaab',
      '67f9601839a6e981c2a840f7'
    ];
    
    console.log(`Looking for applicant with ID: ${cleanApplicantId}`);
    if (knownApplicants.includes(cleanApplicantId)) {
      console.log(`Found known applicant ID: ${cleanApplicantId}`);
    }
    
    // Find the issuer with this applicant ID - with error handling
    let issuer = null;
    try {
      issuer = await prisma.issuer.findFirst({
        where: {
          sumsub_applicant_id: cleanApplicantId
        },
        include: { user: true }
      });
      console.log(`Issuer found: ${issuer ? 'Yes' : 'No'}`);
    } catch (dbError) {
      console.error('Error finding issuer:', dbError);
      // Store the webhook anyway without issuer association
      try {
        await prisma.kycVerification.create({
          data: {
            applicantId: cleanApplicantId,
            externalUserId: payload.externalUserId || '',
            inspectionId: payload.inspectionId || '',
            correlationId: payload.correlationId || null,
            type: payload.type || 'unknown',
            reviewStatus: payload.reviewStatus || '',
            reviewResult: payload.reviewResult?.reviewAnswer || '',
            rawData: JSON.stringify(payload),
            signatureValid: signatureValid,
            webhookType: payload.type,
            eventTimestamp: new Date(payload.createdAtMs || Date.now())
          }
        });
        console.log('Webhook data stored without issuer association due to query error');
      } catch (kycError) {
        console.error('Error storing webhook data:', kycError);
      }
      
      return res.status(200).json({ 
        success: true, 
        message: `Webhook received but error finding issuer: ${dbError.message}` 
      });
    }
    
    if (!issuer) {
      console.warn(`No issuer found with applicantId: ${cleanApplicantId}. Storing webhook data anyway.`);
      
      // Store the verification event in the database without user association
      try {
        await prisma.kycVerification.create({
          data: {
            applicantId: cleanApplicantId,
            externalUserId: payload.externalUserId || '',
            inspectionId: payload.inspectionId || '',
            correlationId: payload.correlationId || null,
            type: payload.type || 'unknown',
            reviewStatus: payload.reviewStatus || '',
            reviewResult: payload.reviewResult?.reviewAnswer || '',
            rawData: JSON.stringify(payload),
            signatureValid: signatureValid,
            webhookType: payload.type,
            eventTimestamp: new Date(payload.createdAtMs || Date.now())
          }
        });
        console.log('Webhook data stored without user association');
      } catch (dbError) {
        console.error('Error storing webhook data:', dbError);
      }
      
      return res.status(200).json({ success: true, message: 'Webhook received but no matching user found' });
    }
    
    console.log(`Found issuer: ${issuer.id} for user: ${issuer.user.email}`);
    
    // Handle different webhook events
    if (payload.type === 'applicantReviewed') {
      const reviewResult = payload.reviewResult?.reviewAnswer;
      
      if (reviewResult === 'GREEN') {
        // Applicant was approved
        try {
          await prisma.issuer.update({
            where: { id: issuer.id },
            data: {
              verification_status: true,
              verification_date: new Date()
            }
          });
          console.log(`Issuer ${issuer.id} was verified successfully`);
        } catch (updateError) {
          console.error(`Error updating issuer status for ${issuer.id}:`, updateError);
        }
      } else if (reviewResult === 'RED') {
        // Applicant was rejected
        try {
          await prisma.issuer.update({
            where: { id: issuer.id },
            data: {
              verification_status: false,
              verification_date: new Date()
            }
          });
          console.log(`Issuer ${issuer.id} verification was rejected`);
        } catch (updateError) {
          console.error(`Error updating issuer status for ${issuer.id}:`, updateError);
        }
      }
    }
    
    // Store the verification event in the database in all cases
    try {
      await prisma.kycVerification.create({
        data: {
          applicantId: cleanApplicantId,
          externalUserId: payload.externalUserId || '',
          inspectionId: payload.inspectionId || '',
          correlationId: payload.correlationId || null,
          type: payload.type || 'unknown',
          reviewStatus: payload.reviewStatus || '',
          reviewResult: payload.reviewResult?.reviewAnswer || '',
          rawData: JSON.stringify(payload),
          userId: issuer.user_id,
          signatureValid: signatureValid,
          webhookType: payload.type,
          eventTimestamp: new Date(payload.createdAtMs || Date.now())
        }
      });
      console.log('KYC verification event stored in database');
    } catch (dbError) {
      console.error('Error storing KYC verification event:', dbError);
      return res.status(200).json({ 
        success: false, 
        message: `Database error: ${dbError.message}` 
      });
    }
    
    // Always respond with 200 to acknowledge receipt
    return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Still return 200 to prevent Sumsub from retrying
    return res.status(200).json({ 
      success: false, 
      message: `Error processing webhook: ${error.message}` 
    });
  }
});

// Test endpoint that always works
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ message: 'Backend server is running!' });
});

app.post('/api/test-token', (req, res) => {
  console.log('Test token endpoint hit');
  res.json({ token: 'test-token-123', success: true });
});

// Print out all registered routes
console.log('Registered routes:');
app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log(r.route.method ? r.route.method + ' ' : 'ALL ', r.route.path);
  }
});

// Home route
app.get('/', (req, res) => {
  res.send('COPYM API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 