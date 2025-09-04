const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { protect, driver } = require("../middleware/auth");

// Apply auth middleware to all routes
router.use(protect);

router.use(driver);

// Driver profile
router.route('/me')
  .get(driverController.getProfile)
  .put(driverController.updateProfile);

// Current active ride/booking
router.get('/bookings/current', driverController.getCurrentRide);
router.get('/tour-bookings/current', driverController.getCurrentTourBooking);

// Driver bookings
router.route('/bookings')
  .get(driverController.getMyBookings);

router.route('/bookings/:id')
  .get(driverController.getBookingDetails);

router.route('/bookings/:id/status')
  .patch(driverController.updateBookingStatus);

// Tour bookings
router.route('/tour-bookings')
  .get(driverController.getMyTourBookings);

router.route('/tour-bookings/:id/status')
  .patch(driverController.updateTourBookingStatus);

// Driver location
router.route('/location')
  .post(driverController.updateLocation);

// Driver status (online/offline)
router.route('/status')
  .put(driverController.toggleOnlineStatus);

// Online/Offline endpoints
router.post('/online', driverController.goOnline);
router.post('/offline', driverController.goOffline);
router.get('/online-drivers', driverController.getOnlineDrivers);

// Driver earnings and stats
router.get('/earnings/today', driverController.getTodayEarnings);
router.get('/stats', driverController.getPerformanceStats);

module.exports = router;
