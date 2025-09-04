const express = require('express');
const router = express.Router();
const tourDriverController = require('../controllers/tourDriverController');
const authMiddleware = require('../middleware/auth');

// Assign driver to a tour booking (admin/system only)
router.post(
  '/:id/assign-driver',
  authMiddleware.protect,
  authMiddleware.admin,
  tourDriverController.assignDriver
);

// Update tour booking status (driver/user)
router.put(
  '/:id/status',
  authMiddleware.protect,
  tourDriverController.updateTourStatus
);

// Get nearby available drivers for a tour booking
router.get(
  '/:id/nearby-drivers',
  authMiddleware.protect,
  tourDriverController.getNearbyDrivers
);

module.exports = router;
