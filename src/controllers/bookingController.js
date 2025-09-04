const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const Taxi = require('../models/TaxiNew');
const { getIO, getOnlineDrivers, getUserSocket } = require('../services/socketService');

// Create a new booking and notify nearby drivers
exports.createBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('Received booking request:', JSON.stringify(req.body, null, 2));
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Check for existing pending bookings for this user
    const existingBooking = await Booking.findOne({
      user: userId,
      status: { $in: ['pending', 'driver_assigned'] },
      createdAt: { $gt: new Date(Date.now() - 30 * 60 * 1000) } // Last 30 minutes
    }).session(session);

    if (existingBooking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'You already have an active booking',
        data: existingBooking
      });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Create booking data
    const bookingData = {
      ...req.body,
      user: userId,
      status: 'pending',
      requestedAt: new Date(),
      estimatedDuration: req.body.estimatedDuration || 15,
      distance: req.body.distance || 5,
    };

    // Check for available drivers with detailed logging
    const availableDriver = await User.findOne({
      $and: [
        {
          $or: [
            { isDriver: true },
            { role: 'driver' },
            { roles: 'driver' },
            { roles: { $in: ['driver'] } }
          ]
        },
        { isOnline: true },
        { $or: [
          { isAvailable: { $exists: false } }, // Include if isAvailable doesn't exist
          { isAvailable: true } // Or if it exists and is true
        ]}
      ]
    })
    .sort({ lastOnline: -1 })
    .session(session);

    console.log('Available driver query result:', availableDriver ? 'Found driver' : 'No driver found');
    
    if (!availableDriver) {
      console.log('No available drivers found. Online drivers:', 
        await User.countDocuments({ 
          $or: [
            { isDriver: true },
            { role: 'driver' },
            { roles: 'driver' }
          ],
          isOnline: true
        })
      );
      return next(new ErrorResponse('No drivers are currently available. Please try again later.', 400));
    }

    // If we reach here, we have an available driver
    console.log('Driver details:', {
      _id: availableDriver._id,
      name: availableDriver.name,
      isOnline: availableDriver.isOnline,
      isAvailable: availableDriver.isAvailable,
      lastOnline: availableDriver.lastOnline
    });
      
    // Mark driver as unavailable
    availableDriver.isAvailable = false;
    availableDriver.lastOnline = new Date();
    await availableDriver.save({ session });
      
    // Assign driver to booking
    bookingData.driver = availableDriver._id;
    bookingData.status = 'driver_assigned';
    bookingData.assignedAt = new Date();

    // Create and save booking
    const booking = new Booking(bookingData);
    await booking.save({ session });

    // Populate data for response using modern Mongoose syntax
    await booking.populate([
      { path: 'user', select: 'name phone' },
      { path: 'driver', select: 'name phone vehicleDetails' }
    ]);

    // Notify driver if assigned
    if (booking.driver) {
      const io = getIO();
      io.to(`driver_${booking.driver._id}`).emit('newRideRequest', {
        bookingId: booking._id,
        ...booking.toObject()
      });
    }

    await session.commitTransaction();
    session.endSession();

    console.log('Booking created successfully:', booking._id);
    res.status(201).json({
      success: true,
      message: booking.driver ? 'Booking created and driver assigned' : 'Booking created. Searching for available drivers...',
      data: booking
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Accept a ride request
exports.acceptRideRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const driverId = req.user._id;
    const { driverLocation } = req.body;

    if (!driverLocation || !driverLocation.lat || !driverLocation.lng) {
      return res.status(400).json({ 
        success: false, 
        message: 'Driver location is required' 
      });
    }

    const booking = await Booking.findById(id).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: 'This ride is no longer available' 
      });
    }

    // Update booking
    booking.driver = driverId;
    booking.status = 'driver_assigned';
    booking.acceptedAt = new Date();
    booking.driverLocation = driverLocation;
    
    await booking.save({ session });

    // Update driver's current booking
    await User.findByIdAndUpdate(
      driverId,
      { 
        $set: { 
          'driverProfile.currentBooking': booking._id,
          'driverProfile.status': 'on_ride'
        } 
      },
      { session }
    );

    // Populate driver and user data for socket notification
    await booking.populate([
      { path: 'driver', select: 'name phone vehicleDetails' },
      { path: 'user', select: 'name phone' }
    ]).execPopulate();

    // Emit event to notify user
    const io = getIO();
    io.to(`user_${booking.user._id}`).emit('rideStatusUpdate', {
      bookingId: booking._id,
      status: 'driver_assigned',
      driver: booking.driver,
      driverLocation: booking.driverLocation
    });

    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Ride accepted successfully',
      data: booking
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error accepting ride:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to accept ride',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
};

// Reject a ride request
exports.rejectRideRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const driverId = req.user._id;

    const booking = await Booking.findById(id).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Add driver to rejectedBy array if not already there
    if (!booking.rejectedBy) {
      booking.rejectedBy = [];
    }
    
    if (!booking.rejectedBy.includes(driverId)) {
      booking.rejectedBy.push(driverId);
      await booking.save({ session });
    }

    // Emit event to notify user if this was the last available driver
    const availableDrivers = await User.countDocuments({
      isOnline: true,
      _id: { $nin: booking.rejectedBy },
      $or: [
        { isDriver: true },
        { role: 'driver' },
        { roles: 'driver' },
        { roles: { $in: ['driver'] } }
      ]
    });

    if (availableDrivers === 0) {
      booking.status = 'no_drivers_available';
      await booking.save({ session });
      
      const io = getIO();
      io.to(`user_${booking.user}`).emit('rideStatusUpdate', {
        bookingId: booking._id,
        status: 'no_drivers_available'
      });
    }

    await session.commitTransaction();
    
    res.json({
      success: true,
      message: 'Ride request rejected',
      data: { bookingId: booking._id }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error rejecting ride:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reject ride',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
};

// Get booking status
exports.getBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId)
      .populate('user', 'name phone')
      .populate('driver', 'name phone vehicleDetails');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Get booking status error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all bookings for a user
exports.getUserBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    const bookings = await Booking.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('driver', 'name phone vehicleDetails');

    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all bookings for a driver
exports.getDriverBookings = async (req, res) => {
  try {
    const driverId = req.user._id;
    const bookings = await Booking.find({ driver: driverId })
      .sort({ createdAt: -1 })
      .populate('user', 'name phone');

    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Get driver bookings error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update booking status (Admin only)
exports.updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['pending', 'driver_assigned', 'driver_arrived', 'in_progress', 'completed', 'cancelled', 'no_drivers'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Update status and timestamps
    const now = new Date();
    booking.status = status;
    
    switch (status) {
      case 'driver_assigned':
        booking.acceptedAt = now;
        break;
      case 'driver_arrived':
        booking.arrivedAt = now;
        break;
      case 'in_progress':
        booking.startedAt = now;
        break;
      case 'completed':
        booking.completedAt = now;
        break;
      case 'cancelled':
        booking.cancelledAt = now;
        break;
    }

    await booking.save();

    // Emit status update event
    const io = getIO();
    const userSocket = getUserSocket(booking.user.toString());
    if (userSocket) {
      io.to(userSocket.socketId).emit('ride_status_updated', {
        bookingId: booking._id,
        status,
        timestamp: now
      });
    }

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      data: booking
    });

  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
  }
};

// Delete a booking (Admin only)
exports.deleteBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findByIdAndDelete(bookingId);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Notify user if they're connected
    const io = getIO();
    const userSocket = getUserSocket(booking.user.toString());
    if (userSocket) {
      io.to(userSocket.socketId).emit('booking_cancelled', {
        bookingId: booking._id,
        message: 'Your booking has been cancelled by admin'
      });
    }

    res.json({
      success: true,
      message: 'Booking deleted successfully'
    });

  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete booking',
      error: error.message
    });
  }
};
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Helper function to calculate ETA based on distance
function calculateETA(pickupLocation, driverLocation) {
  // This is a simplified calculation
  // In a real app, you'd use a routing service like Google Maps or OSRM
  const R = 6371; // Earth's radius in km
  
  const lat1 = pickupLocation.coordinates.lat * Math.PI / 180;
  const lat2 = driverLocation.coordinates.lat * Math.PI / 180;
  const dLat = (driverLocation.coordinates.lat - pickupLocation.coordinates.lat) * Math.PI / 180;
  const dLng = (driverLocation.coordinates.lng - pickupLocation.coordinates.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1) * Math.cos(lat2) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  
  // Assuming average speed of 30 km/h in city traffic
  const averageSpeed = 30; // km/h
  const timeInHours = distance / averageSpeed;
  const timeInMinutes = Math.ceil(timeInHours * 60);
  
  return `${timeInMinutes} min`;
}