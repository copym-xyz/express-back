const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware to check if user is authenticated and is an admin
const isAdmin = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const isAdminRole = req.user.roles.some(role => role.role === 'ADMIN');
  if (!isAdminRole) {
    return res.status(403).json({ message: 'Forbidden - Admin access required' });
  }
  
  next();
};

// Get all users for admin dashboard
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        roles: true,
        admin: true,
        issuer: true,
        investor: true
      }
    });
    
    // Format the response data to include necessary information
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      email_verified: user.email_verified,
      created_at: user.created_at,
      roles: user.roles,
      // Add verification status based on role
      verification_status: user.roles.some(role => role.role === 'ISSUER') && user.issuer 
        ? (user.issuer.verification_status ? 'VERIFIED' : 'PENDING')
        : (user.roles.some(role => role.role === 'INVESTOR') && user.investor 
          ? user.investor.accreditation_status
          : 'NA')
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

module.exports = router; 