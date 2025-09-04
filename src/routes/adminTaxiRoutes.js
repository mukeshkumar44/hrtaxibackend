const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const {
  getTaxis,
  getTaxi,
  updateTaxiStatus
} = require('../controllers/adminController');
const Taxi = require('../models/TaxiNew'); // Import the correct model

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

// Apply auth middleware to all routes
router.use(protect);
router.use(admin);

// @route   GET /api/admin/taxis
// @desc    Get all taxis with optional status filter
// @access  Private/Admin
router.get('/', getTaxis);

// @route   GET /api/admin/taxis/:id
// @desc    Get single taxi by ID
// @access  Private/Admin
router.get('/:id', getTaxi);

// @route   PATCH /api/admin/taxis/:id/status
// @desc    Update taxi status (approve/reject)
// @access  Private/Admin
router.patch('/:id/status', updateTaxiStatus);

// @route   DELETE /api/admin/taxis/:id
// @desc    Delete a taxi (admin only)
// @access  Private/Admin
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid taxi ID format'
      });
    }

    const taxi = await Taxi.findByIdAndDelete(req.params.id);

    if (!taxi) {
      return res.status(404).json({
        success: false,
        message: 'Taxi not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    logError(error, 'admin delete taxi');
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
