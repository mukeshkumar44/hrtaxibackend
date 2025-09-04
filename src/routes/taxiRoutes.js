const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { 
  registerTaxi, 
  getAllTaxis, 
  getTaxiById, 
  updateTaxiStatus,
  getMyRegistrationStatus,
  getMyRegistration
} = require('../controllers/taxiController');
const upload = require("../middleware/upload");
const { body } = require('express-validator');

// Validation middleware
const validateTaxiRegistration = [
  body('driverName', 'Driver name is required').notEmpty(),
  body('vehicleNumber', 'Vehicle number is required').notEmpty(),
  body('vehicleModel', 'Vehicle model is required').notEmpty(),
  body('licenseNumber', 'License number is required').notEmpty(),
  body('phoneNumber', 'Valid phone number is required').isMobilePhone(),
  body('email', 'Please include a valid email').isEmail(),
  body('address', 'Address is required').notEmpty(),
  body('vehicleType', 'Valid vehicle type is required').isIn(['sedan', 'suv', 'hatchback', 'luxury'])
  
];

// Apply protect middleware to all routes
router.use(protect);

// Get current user's taxi registration status
router.get('/status', getMyRegistrationStatus);

// Get current user's full taxi registration details
router.get('/my-registration', getMyRegistration);

// Register a new taxi
router.post(
  "/register",
  upload.single("vehiclePhoto")
  , // file field name
  validateTaxiRegistration,
  registerTaxi
);
// Admin routes (require admin role)
router.use(authorize('admin'));

// Get all taxis
router.get('/', getAllTaxis);

// Get single taxi by ID
router.get('/:id', getTaxiById);

// Update taxi status (approve/reject)
router.put('/:id/status', 
  [
    body('status', 'Status is required')
      .isIn(['approved', 'rejected']),
    body('rejectionReason')
      .if((value, { req }) => req.body.status === 'rejected')
      .notEmpty()
      .withMessage('Rejection reason is required when rejecting a taxi')
  ],
  updateTaxiStatus
);

module.exports = router;
