const express = require('express');
const router = express.Router();
const tourBookingController = require('../controllers/tourBookingController');
const authMiddleware = require('../middleware/auth');

// Log all incoming requests
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Create a new tour booking (protected route)
router.post('/', 
  authMiddleware.protect, 
  (req, res, next) => {
    console.log('Tour Booking Request Body:', req.body);
    next();
  },
  tourBookingController.createTourBooking
);

// Get user's tour bookings (protected)
router.get('/my-bookings', 
  authMiddleware.protect, 
  tourBookingController.getMyTourBookings
);

// Get tour booking by ID (protected)
router.get('/:id', 
  authMiddleware.protect, 
  tourBookingController.getTourBooking
);

// Cancel a tour booking (protected)
router.put('/:id/cancel', 
  authMiddleware.protect, 
  tourBookingController.cancelTourBooking
);

// Error handling middleware for this router
router.use((err, req, res, next) => {
  console.error('Tour Booking Route Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : {},
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = router;
