const TaxiNew = require('../models/TaxiNew');
const User = require('../models/User');
const { validationResult } = require('express-validator');

/**
 * @route   POST /api/taxis/register
 * @desc    Register a new taxi
 * @access  Private (User, Driver)
 */
const registerTaxi = async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Authenticated user:', req.user); // Debug log
    
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      driverName,
      vehicleNumber,
      vehicleModel,
      licenseNumber,
      phoneNumber,
      email,
      address,
      vehicleType = 'sedan'
    } = req.body;

    // Check if user ID is available
    if (!req.user || !req.user.id) {
      console.error('User ID not found in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user already has a taxi registration
    const existingUserTaxi = await TaxiNew.findOne({ user: req.user.id });
    if (existingUserTaxi) {
      return res.status(400).json({
        success: false,
        message: 'You have already registered a taxi',
        data: {
          id: existingUserTaxi._id,
          status: existingUserTaxi.status
        } 
      });
    }

    // Check if taxi with same vehicle or license number exists
    const existingTaxi = await TaxiNew.findOne({
      $or: [
        { vehicleNumber: vehicleNumber.toUpperCase() },
        { licenseNumber: licenseNumber.toUpperCase() }
      ]
    });

    if (existingTaxi) {
      console.error('Taxi with same vehicle or license number already exists');
      return res.status(400).json({
        success: false,
        message: 'Taxi with this vehicle or license number already exists'
      });
    }

    try {
      // Create new taxi with status 'pending' and associate with user
      const newTaxi = new TaxiNew({
        driverName,
        vehicleNumber: vehicleNumber.toUpperCase(),
        vehicleModel,
        licenseNumber: licenseNumber.toUpperCase(),
        phoneNumber,
        email: email.toLowerCase(),
        address,
        vehicleType,
        status: 'pending',
        user: req.user.id,  // Associate with the logged-in user
        owner: req.user.id  // Also set the owner reference
      });

      await newTaxi.save();

      // Update user role to 'driver'
      await User.findByIdAndUpdate(
        req.user.id,
        { 
          $set: { 
            role: 'driver',
            isDriver: true,
          },
          $addToSet: { roles: 'driver' } // Add 'driver' to roles array if not already present
        },
        { new: true }
      );

      res.status(201).json({
        success: true,
        message: 'Taxi registration submitted for approval',
        data: {
          id: newTaxi._id,
          status: newTaxi.status
        }
      });
    } catch (saveError) {
      console.error('Error saving taxi:', saveError);
      throw saveError;
    }

  } catch (error) {
    console.error('Error in registerTaxi:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @route   GET /api/taxis
 * @desc    Get all taxis (for admin)
 * @access  Private (Admin)
 */
const getAllTaxis = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    
    if (status) {
      query.status = status;
    }

    const taxis = await TaxiNew.find(query)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: taxis.length,
      data: taxis
    });

  } catch (error) {
    console.error('Get all taxis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @route   GET /api/taxis/:id
 * @desc    Get single taxi by ID
 * @access  Private (Admin/Owner)
 */
const getTaxiById = async (req, res) => {
  try {
    const taxi = await TaxiNew.findById(req.params.id)
      .populate('owner', 'name email phone');

    if (!taxi) {
      return res.status(404).json({
        success: false,
        message: 'Taxi not found'
      });
    }

    // Check if user is admin or owner
    if (req.user.role !== 'admin' && taxi.owner._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this taxi'
      });
    }

    res.json({
      success: true,
      data: taxi
    });

  } catch (error) {
    console.error('Get taxi by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @route   PUT /api/taxis/:id/status
 * @desc    Update taxi status (approve/reject)
 * @access  Private (Admin)
 */
const updateTaxiStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const { id } = req.params;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be either approved or rejected'
      });
    }

    const taxi = await TaxiNew.findById(id);
    if (!taxi) {
      return res.status(404).json({
        success: false,
        message: 'Taxi not found'
      });
    }

    // Update taxi status
    taxi.status = status;
    if (status === 'rejected' && rejectionReason) {
      taxi.rejectionReason = rejectionReason;
    } else {
      taxi.rejectionReason = undefined;
    }

    await taxi.save();

    // If taxi is approved, update user's role to 'driver'
    if (status === 'approved') {
      try {
        // Find the user who registered this taxi
        const user = await User.findById(taxi.user);
        if (user) {
          user.role = 'driver';
          await user.save();
          console.log(`User ${user._id} role updated to 'driver'`);
        }
      } catch (userError) {
        console.error('Error updating user role:', userError);
        // Don't fail the request if role update fails, just log it
      }
    }

    res.status(200).json({
      success: true,
      message: `Taxi ${status} successfully`,
      data: {
        id: taxi._id,
        status: taxi.status,
        rejectionReason: taxi.rejectionReason
      }
    });
  } catch (error) {
    console.error('Error in updateTaxiStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/taxis/status
 * @desc    Get current user's taxi registration status
 * @access  Private
 */
const getMyRegistrationStatus = async (req, res) => {
  try {
    console.log('getMyRegistrationStatus - User ID:', req.user?.id);
    
    if (!req.user?.id) {
      console.error('No user ID found in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const taxi = await TaxiNew.findOne({$or: [
     
      { owner: req.user.id }
    ] })
      .select('_id vehicleNumber status rejectionReason createdAt')
      .lean();

    if (!taxi) {
      return res.status(404).json({
        success: false,
        message: 'No taxi registration found for this user'
      });
    }
   
    
    
    // If taxi is approved, ensure user has driver role
    if (taxi.status === 'approved') {
      const user = await User.findById(req.user.id);
      if (user) {
        let needsUpdate = false;
        
        // Initialize roles array if it doesn't exist
        if (!user.roles || !Array.isArray(user.roles)) {
          user.roles = ['user'];
          needsUpdate = true;
        }
        
        // Add driver role if not present
        if (!user.roles.includes('driver')) {
          user.roles = [...new Set([...user.roles, 'driver'])];
          needsUpdate = true;
        }
        
        // Update legacy role field for backward compatibility
        if (user.role !== 'driver' && !user.roles.includes('admin')) {
          user.role = 'driver';
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          console.log('Updating user roles:', { 
            userId: user._id, 
            oldRoles: user.roles, 
            newRoles: user.roles,
            oldRole: user.role,
            newRole: user.roles.includes('admin') ? 'admin' : 'driver'
          });
          await user.save();
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Taxi status retrieved successfully',
      data: {
        _id: taxi._id,
        vehicleNumber: taxi.vehicleNumber,
        status: taxi.status,
        rejectionReason: taxi.rejectionReason,
        createdAt: taxi.createdAt
      }
    });
  } catch (error) {
    console.error('Error in getMyRegistrationStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getMyRegistration = getMyRegistrationStatus;

module.exports = {
  registerTaxi,
  getAllTaxis,
  getTaxiById,
  updateTaxiStatus,
  getMyRegistrationStatus,
  getMyRegistration
};
