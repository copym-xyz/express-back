require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const extractUserId = require('./utils/extractUserId');
const axios = require('axios');
const { generateDIDForIssuer } = require('./utils/didUtils');
const crossmintWebhooks = require('./routes/crossmint-webhooks');

// Initialize Express app
const app = express();
const prisma = new PrismaClient();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://62ad-152-58-201-208.ngrok-free.app', 'https://api.sumsub.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Payload-Digest']
}));

// Import routes
const sumsubWebhooksRouter = require('./routes/sumsub-webhooks');

// Sumsub webhooks must be handled before body parser
app.use('/webhooks/sumsub', sumsubWebhooksRouter);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      const user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        include: { userrole: true }
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

// Add the webhooks route
const webhooksRoutes = require('./routes/webhooks');
app.use('/webhooks', webhooksRoutes);

// Webhook routes
app.use('/webhooks/sumsub', sumsubWebhooksRouter);
app.use('/webhooks/crossmint', crossmintWebhooks);

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
  console.error('Global error handler:', err);
  
  // Handle specific error types
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid JSON payload' 
    });
  }
  
  // Handle other errors
  res.status(err.status || 500).json({ 
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

/**
 * Store applicant information from Sumsub
 * @param {string} applicantId - The Sumsub applicant ID
 * @param {number} userId - The user ID
 * @returns {Promise<Object>} - Result of the operation
 */
const storeApplicantInfo = async (applicantId, userId) => {
  try {
    // Validate input
    if (!applicantId) {
      console.error('Missing applicantId in storeApplicantInfo');
      return { success: false, error: 'Missing applicant ID' };
    }

    console.log(`Processing applicant info for ID: ${applicantId}`);
    
    // Build Sumsub API request for getting applicant data
    const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY || 'your-secret-key';
    const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN || 'your-app-token';
    const apiUrl = `/resources/applicants/${applicantId}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', SUMSUB_SECRET_KEY)
      .update(timestamp + 'GET' + apiUrl)
      .digest('hex');
    
    // Make API request to Sumsub
    console.log(`Fetching applicant data from Sumsub API for ID: ${applicantId}`);
    const response = await axios.get(`https://api.sumsub.com${apiUrl}`, {
      headers: {
        'Accept': 'application/json',
        'X-App-Token': SUMSUB_APP_TOKEN,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': timestamp
      }
    });
    
    if (!response.data || !response.data.info) {
      console.error(`No valid data returned for applicant ${applicantId}`);
      return { success: false, error: 'No valid applicant data returned' };
    }
    
    // Extract info from response
    const personalInfo = response.data.info;
    const idDoc = personalInfo.idDocs && personalInfo.idDocs.length > 0 
      ? personalInfo.idDocs[0] 
      : {};
    
    console.log(`Successfully fetched applicant data for ${applicantId}`);
    
    // Find user if not provided
    let userRecord = null;
    if (!userId) {
      // Try to find user by applicantId
      const issuer = await prisma.issuer.findFirst({
        where: { sumsub_applicant_id: applicantId },
        include: { users: true }
      });
      
      if (issuer?.users) {
        userRecord = issuer.users;
        userId = issuer.user_id;
        console.log(`Found user ${userRecord.email} via applicantId ${applicantId}`);
      } else {
        console.error(`No user found for applicant ${applicantId}`);
        return { success: false, error: 'User not found' };
      }
    } else {
      // Retrieve user record
      userRecord = await prisma.users.findUnique({
        where: { id: userId }
      });
    }
    
    if (!userRecord) {
      console.error(`User with ID ${userId} not found`);
      return { success: false, error: 'User not found' };
    }
    
    // Check for existing personal info record
    const existingPersonalInfo = await prisma.kyc_personal_info.findFirst({
      where: { applicant_id: applicantId }
    });
    
    // Prepare personal info data
    const personalInfoData = {
      applicant_id: applicantId,
      user_id: userId,
      first_name: personalInfo.firstName || personalInfo.firstNameEn || idDoc.firstName || null,
      last_name: personalInfo.lastName || personalInfo.lastNameEn || idDoc.lastName || null,
      middle_name: personalInfo.middleName || null,
      full_name: `${personalInfo.firstName || ''} ${personalInfo.lastName || ''}`.trim() || null,
      legal_name: personalInfo.legalName || null,
      gender: personalInfo.gender || null,
      date_of_birth: personalInfo.dob ? new Date(personalInfo.dob) : (idDoc.dob ? new Date(idDoc.dob) : null),
      place_of_birth: personalInfo.placeOfBirth || null,
      country_of_birth: personalInfo.countryOfBirth || personalInfo.country || idDoc.country || null,
      state_of_birth: personalInfo.stateOfBirth || null,
      nationality: personalInfo.nationality || null,
      phone: personalInfo.phone || null,
      email: personalInfo.email || response.data.email || null,
      country: personalInfo.country || idDoc.country || null,
      tax_residence_country: personalInfo.taxResidenceCountry || null,
      tax_identification_number: personalInfo.taxIdentificationNumber || idDoc.number || null,
      id_number: personalInfo.idNumber || idDoc.number || null,
      updated_at: new Date()
    };
    
    // Store data in database
    let personalInfoRecord;
    
    if (existingPersonalInfo) {
      // Update existing record
      personalInfoRecord = await prisma.kyc_personal_info.update({
        where: { id: existingPersonalInfo.id },
        data: personalInfoData
      });
      console.log(`Updated personal info id=${personalInfoRecord.id} for user ${userId}`);
    } else {
      // Create new record
      personalInfoRecord = await prisma.kyc_personal_info.create({
        data: {
          ...personalInfoData,
          created_at: new Date()
        }
      });
      console.log(`Created personal info id=${personalInfoRecord.id} for user ${userId}`);
    }
    
    return { 
      success: true, 
      personalInfo: personalInfoRecord 
    };
  } catch (error) {
    console.error(`Error in storeApplicantInfo: ${error.message}`);
    return { success: false, error: error.message };
  }
}; 