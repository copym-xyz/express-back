require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const { PrismaClient } = require('@prisma/client');

// Initialize Express app
const app = express();
const prisma = new PrismaClient();

// CORS configuration
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
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

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: true }
    });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/issuer', require('./routes/issuer'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/investor', require('./routes/investor'));
app.use('/api/wallet', require('./routes/wallet'));

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