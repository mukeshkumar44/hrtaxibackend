const mongoose = require('mongoose');
const Taxi = require('../models/TaxiNew');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all taxis with status filter
// @route   GET /api/admin/taxis
// @access  Private/Admin
exports.getTaxis = async (req, res, next) => {
  try {
    console.log('Fetching taxis with query:', req.query);
    const { status } = req.query;
    const query = {};
    
    if (status) {
      query.status = status;
    }

    console.log('Executing Taxi.find() with query:', JSON.stringify(query, null, 2));
    
    // First get taxis without populating user
    let taxis = await Taxi.find(query)
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${taxis.length} taxis`);
    
    // If you need user data, fetch it separately
    const userIds = [...new Set(taxis.filter(t => t.user).map(t => t.user))];
    let usersMap = {};
    
    if (userIds.length > 0) {
      const users = await User.find({ _id: { $in: userIds } })
        .select('_id name email phone')
        .lean();
      
      // Create a map of user data for quick lookup
      usersMap = users.reduce((acc, user) => ({
        ...acc,
        [user._id.toString()]: user
      }), {});
    }

    // Merge user data into taxis
    taxis = taxis.map(taxi => ({
      ...taxi,
      user: taxi.user ? usersMap[taxi.user.toString()] : null
    }));
    
    // Check if any taxi has invalid data
    taxis.forEach((taxi, index) => {
      if (!taxi.driverName || !taxi.vehicleNumber) {
        console.warn(`Taxi at index ${index} has missing required fields:`, taxi);
      }
    });
    
    res.status(200).json({
      success: true,
      count: taxis.length,
      data: taxis
    });
  } catch (error) {
    console.error('Detailed error in getTaxis:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      errors: error.errors,
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue
    });
    next(new ErrorResponse(`Failed to fetch taxis: ${error.message}`, 500));
  }
};

// @desc    Update taxi status (approve/reject)
// @route   PATCH /api/admin/taxis/:id/status
// @access  Private/Admin
exports.updateTaxiStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request params:', JSON.stringify(req.params, null, 2));
    
    const { status, rejectionReason } = req.body;
    const { id } = req.params;

    console.log(`Processing taxi status update. ID: ${id}, Status: ${status}`);

    // Validate status
    if (!status || typeof status !== 'string') {
      await session.abortTransaction();
      session.endSession();
      return next(new ErrorResponse('Status is required and must be a string', 400));
    }

    if (!['approved', 'rejected'].includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return next(new ErrorResponse('Invalid status. Must be either "approved" or "rejected"', 400));
    }

    // Validate ID format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return next(new ErrorResponse('Valid taxi ID is required', 400));
    }

    // Find the taxi with session
    const taxi = await Taxi.findById(id).session(session);
    
    if (!taxi) {
      const count = await Taxi.countDocuments();
      console.error(`Taxi not found. ID: ${id}, Total taxis in database: ${count}`);
      
      await session.abortTransaction();
      session.endSession();
      return next(new ErrorResponse(`Taxi not found. Please check the taxi ID.`, 404));
    }

    console.log('Found taxi:', {
      id: taxi._id,
      driverName: taxi.driverName,
      currentStatus: taxi.status,
      isApproved: taxi.isApproved,
      userId: taxi.user
    });

    // Update taxi status
    taxi.status = status;
    taxi.isApproved = status === 'approved';
    
    if (status === 'rejected') {
      taxi.rejectionReason = rejectionReason || 'No reason provided';
    } else {
      taxi.rejectionReason = undefined;
    }

    try {
      await taxi.save({ session });
      console.log('Taxi status updated successfully');
    } catch (saveError) {
      console.error('Error saving taxi:', saveError);
      throw saveError;
    }

    // Update user role to driver if approved
    if (status === 'approved' && taxi.user) {
      try {
        console.log(`Attempting to update user role for user ID: ${taxi.user}`);
        const user = await User.findById(taxi.user).session(session);
        
        if (!user) {
          console.error('User not found for ID:', taxi.user);
          throw new Error('Associated user not found');
        }

        console.log('Found user:', {
          id: user._id,
          email: user.email,
          currentRoles: user.roles || [],
          isDriver: user.isDriver
        });

        // Ensure roles is an array
        const roles = Array.isArray(user.roles) ? [...user.roles] : ['user'];
        if (!roles.includes('driver')) {
          roles.push('driver');
        }
        
        console.log('Updating user with new roles:', roles);
        
        const updatedUser = await User.findByIdAndUpdate(
          taxi.user,
          { 
            $addToSet: { roles: 'driver' },
            isDriver: true
          },
          { new: true, runValidators: true, session }
        );
        
        if (!updatedUser) {
          console.error('Failed to update user. User not found after update attempt.');
          throw new Error('Failed to update user role');
        }
        
        console.log('User role updated successfully:', {
          id: updatedUser._id,
          newRoles: updatedUser.roles,
          isDriver: updatedUser.isDriver
        });
      } catch (userError) {
        console.error('Error updating user role:', {
          message: userError.message,
          stack: userError.stack,
          userId: taxi.user,
          error: JSON.stringify(userError, Object.getOwnPropertyNames(userError))
        });
        throw userError; // This will be caught by the outer catch block
      }
    }

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
    console.log('Transaction committed successfully');

    // Emit socket event for real-time update
    if (req.io && taxi.user) {
      req.io.to(`user_${taxi.user}`).emit('taxiStatusUpdated', {
        taxiId: taxi._id,
        status: taxi.status,
        isApproved: taxi.isApproved,
        rejectionReason: taxi.rejectionReason
      });
    }

    res.status(200).json({
      success: true,
      message: `Taxi ${status} successfully`,
      data: taxi
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error in updateTaxiStatus:', {
      message: error.message,
      stack: error.stack,
      error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    next(new ErrorResponse('Failed to update taxi status: ' + error.message, 500));
  }
};

// @desc    Get taxi by ID
// @route   GET /api/admin/taxis/:id
// @access  Private/Admin
exports.getTaxi = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('Fetching taxi with ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ErrorResponse('Invalid taxi ID format', 400));
    }

    const taxi = await Taxi.findById(id)
      .populate('user', 'name email phone');

    if (!taxi) {
      console.error('Taxi not found with ID:', id);
      return next(new ErrorResponse('Taxi not found', 404));
    }

    console.log('Found taxi:', {
      id: taxi._id,
      driverName: taxi.driverName,
      status: taxi.status,
      isApproved: taxi.isApproved
    });

    res.status(200).json({
      success: true,
      data: taxi
    });
  } catch (error) {
    console.error('Error in getTaxi:', error);
    next(new ErrorResponse('Failed to fetch taxi details', 500));
  }
};
