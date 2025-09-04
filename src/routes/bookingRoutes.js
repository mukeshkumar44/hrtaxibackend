const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middleware/auth');
console.log("✅ bookingRoutes loaded");

// Create a new booking (protected route)
router.post('/', authMiddleware.protect, bookingController.createBooking);

// Get booking status (public)
router.get('/status/:bookingId', bookingController.getBookingStatus);

// Get user's bookings (protected)
router.get('/my-bookings', authMiddleware.protect, bookingController.getUserBookings);

// Driver accepts a ride request (protected, driver only)
router.post('/:bookingId/accept', authMiddleware.protect, authMiddleware.driver, bookingController.acceptRideRequest);

// Driver rejects a ride request (protected, driver only)
router.post('/:bookingId/reject', authMiddleware.protect, authMiddleware.driver, bookingController.rejectRideRequest);

// Get driver's bookings (protected, driver only)
router.get('/driver/bookings', authMiddleware.protect, authMiddleware.driver, bookingController.getDriverBookings);

// Admin routes
router.get('/all', authMiddleware.protect, authMiddleware.admin, bookingController.getDriverBookings);
router.patch('/:bookingId/status', authMiddleware.protect, authMiddleware.admin, bookingController.updateBookingStatus);
router.delete('/:bookingId', authMiddleware.protect, authMiddleware.admin, bookingController.deleteBooking);

module.exports = router;