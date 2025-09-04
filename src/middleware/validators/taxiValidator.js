const { body, query, param } = require('express-validator');
const Taxi = require('../../models/TaxiNew');

// Validation for taxi registration
const validateTaxiRegistration = [
  // Basic information
  body('driverName')
    .trim()
    .notEmpty().withMessage('Driver name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
  body('vehicleNumber')
    .trim()
    .notEmpty().withMessage('Vehicle number is required')
    .matches(/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{1,4}$/i)
    .withMessage('Please enter a valid vehicle number (e.g., MH12AB1234)')
    .custom(async (value) => {
      const taxi = await Taxi.findOne({ vehicleNumber: value.toUpperCase() });
      if (taxi) {
        throw new Error('Vehicle number is already registered');
      }
      return true;
    }),
    
  body('vehicleModel')
    .trim()
    .notEmpty().withMessage('Vehicle model is required'),
    
  body('licenseNumber')
    .trim()
    .notEmpty().withMessage('License number is required')
    .custom(async (value) => {
      const taxi = await Taxi.findOne({ licenseNumber: value });
      if (taxi) {
        throw new Error('License number is already registered');
      }
      return true;
    }),
    
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[6-9]\d{9}$/).withMessage('Please enter a valid 10-digit phone number'),
    
  body('address')
    .trim()
    .notEmpty().withMessage('Address is required')
    .isLength({ min: 10 }).withMessage('Address must be at least 10 characters long'),
    
  body('vehicleType')
    .optional()
    .isIn(['hatchback', 'sedan', 'suv', 'luxury', 'xl'])
    .withMessage('Invalid vehicle type')
];

// Validation for updating taxi status
const validateUpdateStatus = [
  param('id')
    .isMongoId().withMessage('Invalid taxi ID'),
    
  body('status')
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Status must be one of: pending, approved, rejected'),
    
  body('rejectionReason')
    .if(body('status').equals('rejected'))
    .trim()
    .notEmpty().withMessage('Rejection reason is required when status is rejected')
    .isLength({ min: 10 }).withMessage('Rejection reason must be at least 10 characters')
];

// Validation for document uploads
const validateDocuments = (req, res, next) => {
  const requiredDocs = ['rcBook', 'insurance', 'permit', 'driverLicense', 'vehiclePhoto'];
  
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files were uploaded'
    });
  }
  
  const missingDocs = [];
  const invalidFiles = [];
  
  // Check for required documents
  requiredDocs.forEach(doc => {
    if (!req.files[doc]) {
      missingDocs.push(doc);
    } else {
      const file = req.files[doc][0];
      // Check file type (allow images and PDFs)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.mimetype)) {
        invalidFiles.push(`${doc}: Invalid file type (${file.mimetype}). Only JPG, PNG, and PDF are allowed.`);
      }
      // Check file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        invalidFiles.push(`${doc}: File too large. Maximum size is 5MB.`);
      }
    }
  });
  
  if (missingDocs.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Missing required documents',
      missing: missingDocs
    });
  }
  
  if (invalidFiles.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid files detected',
      errors: invalidFiles
    });
  }
  
  next();
};

module.exports = {
  validateTaxiRegistration,
  validateUpdateStatus,
  validateDocuments
};
