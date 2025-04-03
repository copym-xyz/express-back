const express = require('express');
const router = express.Router();
const passport = require('passport');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware to check if user is authenticated and is an admin
const isAdmin = [
  passport.authenticate('jwt', { session: false }),
  (req, res, next) => {
    const isAdminRole = req.user.roles.some(role => role.role === 'ADMIN');
    if (!isAdminRole) {
      return res.status(403).json({ message: 'Forbidden - Admin access required' });
    }
    next();
  }
];

// Get all users with their roles and verification status
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        roles: true,
        issuer: true,
        investor: true,
        admin: true
      }
    });

    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      email_verified: user.email_verified,
      roles: user.roles.map(role => role.role),
      verification_status: user.issuer ? 
        user.issuer.verification_status : 
        user.investor ? 
          (user.investor.kyc_verified && user.investor.aml_verified) : 
          null,
      created_at: user.created_at
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Get dashboard statistics
router.get('/stats', isAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      pendingVerifications,
      activeUsers,
      totalIssuers,
      totalInvestors
    ] = await Promise.all([
      prisma.user.count(),
      prisma.issuer.count({
        where: { verification_status: false }
      }),
      prisma.user.count({
        where: { email_verified: true }
      }),
      prisma.issuer.count(),
      prisma.investor.count()
    ]);

    res.json({
      total_users: totalUsers,
      pending_verifications: pendingVerifications,
      active_users: activeUsers,
      total_issuers: totalIssuers,
      total_investors: totalInvestors
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
});

module.exports = router; 