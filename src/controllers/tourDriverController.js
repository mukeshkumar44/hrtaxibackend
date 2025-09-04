const TourBooking = require('../models/TourBooking');
const User = require('../models/User');
const { getIO } = require('../services/socketService');

// @desc    Assign nearest available driver to a tour booking
// @route   POST /api/tour-bookings/:id/assign-driver
// @access  Private (Admin/System)
exports.assignDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    const booking = await TourBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Tour booking not found'
      });
    }

    // Check if booking already has a driver
    if (booking.driver) {
      return res.status(400).json({
        success: false,
        message: 'Driver already assigned to this booking'
      });
    }

    const driver = await User.findOne({ 
      _id: driverId, 
      role: 'driver',
      isAvailable: true 
    });

    if (!driver) {
      return res.status(400).json({
        success: false,
        message: 'Driver not available or not found'
      });
    }

    // Update booking with driver info
    booking.driver = driver._id;
    booking.status = 'driver_assigned';
    await booking.save();

    // Update driver's status
    driver.isAvailable = false;
    await driver.save();

    // Notify driver and user via WebSocket
    const io = getIO();
    io.to(`driver_${driver._id}`).emit('tour_assigned', {
      bookingId: booking._id,
      pickupLocation: booking.pickupLocation,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone
    });

    io.to(`user_${booking.user}`).emit('driver_assigned', {
      bookingId: booking._id,
      driver: {
        name: driver.name,
        phone: driver.phone,
        vehicle: driver.vehicleDetails
      },
      status: booking.status
    });

    res.status(200).json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Assign driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update tour booking status
// @route   PUT /api/tour-bookings/:id/status
// @access  Private
exports.updateTourStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, location } = req.body;
    const userId = req.user.id;

    const booking = await TourBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Tour booking not found'
      });
    }

    // Check permissions
    const isDriver = req.user.role === 'driver' && booking.driver.toString() === userId;
    const isUser = req.user.role === 'user' && booking.user.toString() === userId;
    
    if (!isDriver && !isUser && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this booking'
      });
    }

    // Validate status transition
    const validTransitions = {
      pending: ['driver_assigned'],
      driver_assigned: ['driver_arrived', 'cancelled'],
      driver_arrived: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled']
    };

    if (!validTransitions[booking.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${booking.status} to ${status}`
      });
    }

    // Update booking status
    booking.status = status;
    
    // Update driver location if provided
    if (location && req.user.role === 'driver') {
      booking.driverLocation = {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      };
    }

    // Handle status-specific logic
    if (status === 'completed' || status === 'cancelled') {
      // Free up the driver
      if (booking.driver) {
        await User.findByIdAndUpdate(booking.driver, { isAvailable: true });
      }
    }

    await booking.save();

    // Notify relevant parties via WebSocket
    const io = getIO();
    io.to(`user_${booking.user}`).emit('tour_status_updated', {
      bookingId: booking._id,
      status: booking.status,
      statusText: booking.statusText,
      driverLocation: booking.driverLocation,
      updatedAt: booking.updatedAt
    });

    if (booking.driver) {
      io.to(`driver_${booking.driver}`).emit('tour_status_updated', {
        bookingId: booking._id,
        status: booking.status,
        statusText: booking.statusText
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Update tour status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get nearby available drivers for a tour booking
// @route   GET /api/tour-bookings/:id/nearby-drivers
// @access  Private
exports.getNearbyDrivers = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, maxDistance = 50000 } = req.query; // Default 50km

    const booking = await TourBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Tour booking not found'
      });
    }

    // Find available drivers within maxDistance
    const drivers = await User.find({
      role: 'driver',
      isAvailable: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [
              parseFloat(longitude || booking.pickupLocation.coordinates[0]),
              parseFloat(latitude || booking.pickupLocation.coordinates[1])
            ]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    }).select('name phone vehicleDetails location');

    res.status(200).json({
      success: true,
      count: drivers.length,
      data: drivers
    });

  } catch (error) {
    console.error('Get nearby drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
