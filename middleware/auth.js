const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  // Check if authorization header exists
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'No authorization token provided' });
  }
  
  // Get the token from the authorization header (Bearer token)
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Invalid token format' });
  }
  
  try {
    // Verify the token using the JWT_SECRET from env
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Middleware to check if user is authenticated and is an admin
const isAdmin = (req, res, next) => {
  // First check if user is authenticated
  isAuthenticated(req, res, (err) => {
    if (err) return next(err);
    
    // Then check if user has admin role
    if (!req.user || !req.user.roles || !req.user.roles.some(role => role.role === 'ADMIN')) {
      return res.status(403).json({ message: 'Forbidden - Admin access required' });
    }
    
    next();
  });
};

// For testing purposes, this middleware is a placeholder
// that allows all requests through without actual authentication
const isAdminMock = (req, res, next) => {
  // Mock user data for testing
  req.user = {
    id: 1,
    email: 'admin@example.com',
    roles: [{ role: 'ADMIN' }]
  };
  next();
};

// Use the mock version for now to allow testing without authentication
module.exports = {
  isAuthenticated,
  isAdmin: isAdminMock, // Switch to real isAdmin when authentication is implemented
  isAdminReal: isAdmin
}; 