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

/**
 * Middleware to authenticate using JWT token
 * This is a real authentication middleware that verifies JWT tokens
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
    
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', async (err, decoded) => {
      if (err) {
        console.error('JWT verification error:', err);
        return res.status(403).json({ success: false, message: 'Token is invalid or expired' });
      }
      
      try {
        // Get the userId from the token - it could be in different fields based on how the token was created
        const userId = decoded.userId || decoded.id;
        
        if (!userId) {
          console.error('JWT missing userId field:', decoded);
          return res.status(403).json({ success: false, message: 'Invalid token format' });
        }
        
        // Fetch the user from the database to get the most current data
        const user = await prisma.users.findUnique({
          where: { id: userId },
          include: { userrole: true }
        });
        
        if (!user) {
          console.error('User not found for JWT token userId:', userId);
          return res.status(403).json({ success: false, message: 'User not found' });
        }
        
        // Attach the full user object to the request
        req.user = user;
        console.log(`authenticateJWT - Found user: ${user.email} (ID: ${user.id})`);
        
        next();
      } catch (error) {
        console.error('Error in authenticateJWT middleware:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
    });
  } else {
    return res.status(401).json({ success: false, message: 'Authorization header not provided' });
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

// Check if user is issuer
const isIssuer = (req, res, next) => {
  if (!req.user) {
    console.error('No user object found in request');
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  
  console.log('User in isIssuer middleware:', req.user);
  console.log('User roles in middleware:', req.user.roles || req.user.userrole);
  
  // Check if user has issuer role
  const roles = req.user.roles || 
                (req.user.userrole && Array.isArray(req.user.userrole) ? req.user.userrole.map(r => r.role) : []);
  
  if (!roles.includes('ISSUER')) {
    return res.status(403).json({ success: false, message: 'Forbidden - Issuer access required' });
  }
  
  console.log('Fetching profile for issuer:', req.user.userId || req.user.id);
  next();
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
  authenticateJWT,
  isAdmin: isAdminMock, // Switch to real isAdmin when authentication is implemented
  isAdminReal: isAdmin,
  isIssuer
}; 