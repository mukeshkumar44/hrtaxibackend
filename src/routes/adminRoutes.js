const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Taxi = require('../models/TaxiNew');
const TourPackage = require('../models/TourPackage');

// Admin Dashboard Statistics
router.get('/dashboard', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Admins only.' 
      });
    }
    
    // Test with a simple response first
    return res.status(200).json({
      success: true,
      data: {
        totalUsers: 10,
        totalBookings: 5,
        totalTaxis: 3,
        totalPackages: 2,
        pendingBookings: 1,
        pendingTaxiApprovals: 1,
        totalRevenue: 5000,
        recentBookings: [],
        recentUsers: [],
        completedBookings: 4,
        activeDrivers: 2,
        upcomingTours: 1
      }
    });
    
  } catch (error) {
    console.error('Error in dashboard route:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        name: error.name,
        stack: error.stack,
        ...(error.code && { code: error.code })
      } : undefined
    });
  }
});

// Add more admin routes here as needed

module.exports = router;
