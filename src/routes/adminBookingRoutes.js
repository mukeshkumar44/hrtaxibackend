const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Booking = require('../models/Booking');

// Helper function to log detailed errors
const logError = (error, context = '') => {
  console.error(`\n--- Error in ${context} ---`);
  console.error('Error:', error.message);
  console.error('Name:', error.name);
  if (error.code) console.error('Error Code:', error.code);
  if (error.errors) console.error('Validation Errors:', error.errors);
  console.error('Stack:', error.stack);
  console.error('--- End Error ---\n');
};

// Get all bookings (admin only)
router.get('/', authMiddleware.protect, async (req, res) => {
  try {
    console.log('Attempting to fetch all bookings...');
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log('Access denied: User is not an admin');
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Admins only.' 
      });
    }

    console.log('User is admin, proceeding to fetch bookings...');
    
    // First, check if the Booking model is properly imported
    if (!Booking || typeof Booking.find !== 'function') {
      const error = new Error('Booking model is not properly initialized');
      logError(error, 'Booking Model Check');
      throw error;
    }

    // Fetch bookings with minimal population first
    const bookings = await Booking.find({}).lean();
    console.log(`Found ${bookings.length} bookings`);

    // If we got this far, the query was successful
    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
    
  } catch (error) {
    logError(error, 'GET /api/admin/bookings');
    
    // Handle specific error types
    let statusCode = 500;
    let errorMessage = 'Error fetching bookings';
    
    if (error.name === 'CastError') {
      statusCode = 400;
      errorMessage = 'Invalid ID format';
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = 'Validation Error';
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        name: error.name,
        ...(error.code && { code: error.code }),
        ...(error.errors && { errors: error.errors })
      } : undefined
    });
  }
});

// Get single booking (admin only)
router.get('/:id', authMiddleware.protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Admins only.' 
      });
    }

    const booking = await Booking.findById(req.params.id).lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    logError(error, `GET /api/admin/bookings/${req.params.id}`);
    
    let statusCode = 500;
    let errorMessage = 'Error fetching booking';
    
    if (error.name === 'CastError') {
      statusCode = 400;
      errorMessage = 'Invalid ID format';
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
