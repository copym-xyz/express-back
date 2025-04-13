require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

// Initialize Express app
const app = express();
const prisma = new PrismaClient();

// CORS configuration
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
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