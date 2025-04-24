const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

/**
 * Middleware to check if user is authenticated
 * For now just passes through as a placeholder
 * In production, this should verify JWT token or session
 */
const isAuthenticated = (req, res, next) => {
  // Get token from header, query or cookie
  // const token = req.headers.authorization?.split(' ')[1] || req.query.token || req.cookies.token;
  
  // For development purposes, we'll allow requests to pass through
  // In production, this should properly validate the token
  console.log('Authentication middleware: Allowing request (development mode)');
  console.log('Request path:', req.path);
  console.log('Request method:', req.method);
  
  // Add user ID to request if available from query or header
  req.userId = req.query.userId || req.headers['x-user-id'] || null;
  
  // Continue to the next middleware/route handler
  next();
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