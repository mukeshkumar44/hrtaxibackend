const Booking = require('../models/Booking');
const Taxi = require('../models/TaxiNew'); // Updated import
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');



// Get driver's profile
exports.getProfile = async (req, res) => {
  try {
    const driver = await User.findById(req.user.id)
      .select('-password')
      .populate('taxi', 'vehicleNumber vehicleModel vehicleType isApproved status');

    if (!driver) {
      throw new NotFoundError('Driver not found');
    }

    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    next(error);
  }
};

// Update driver's profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;
    
    const driver = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, address },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    next(error);
  }
};


// Get driver's bookings
exports.getMyBookings = async (req, res, next) => {
  try {
    const { status } = req.query;
    
    const query = { driver: req.user.id };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('user', 'name phone email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    next(error);
  }
};

// Get booking details
exports.getBookingDetails = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      driver: req.user.id
    })
    .populate('user', 'name phone email')
    .populate('tourPackage', 'name duration description');

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['accepted', 'rejected', 'in_progress', 'completed', 'cancelled'];

    if (!allowedStatuses.includes(status)) {
      throw new BadRequestError('Invalid status');
    }

    const booking = await Booking.findOneAndUpdate(
      { 
        _id: req.params.id, 
        driver: req.user.id 
      },
      { status },
      { new: true, runValidators: true }
    );

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Emit real-time update
    req.io.emit('bookingStatusUpdated', {
      bookingId: booking._id,
      status,
      driverId: req.user.id
    });

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

// Update driver's current location
exports.updateLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    
    if (!lat || !lng) {
      throw new BadRequestError('Latitude and longitude are required');
    }

    // Update driver's location
    await User.findByIdAndUpdate(
      req.user.id,
      { 
        'location.coordinates': [lng, lat],
        'location.updatedAt': Date.now()
      },
      { new: true }
    );

    // Broadcast location to relevant users
    req.io.emit('driverLocationUpdated', {
      driverId: req.user.id,
      location: { lat, lng },
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Toggle driver's online status
exports.toggleOnlineStatus = async (req, res, next) => {
  try {
    const { isOnline } = req.body;
    
    const driver = await User.findByIdAndUpdate(
      req.user.id,
      { isOnline },
      { new: true }
    );

    // Notify about status change
    req.io.emit('driverStatusChanged', {
      driverId: req.user.id,
      isOnline,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: { isOnline: driver.isOnline }
    });
  } catch (error) {
    next(error);
  }
};

// Get today's earnings
exports.getTodayEarnings = async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const result = await Booking.aggregate([
      {
        $match: {
          driver: req.user._id,
          status: 'completed',
          updatedAt: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$fare' },
          totalRides: { $sum: 1 }
        }
      }
    ]);

    const stats = result[0] || { totalEarnings: 0, totalRides: 0 };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// Get driver's performance stats
exports.getPerformanceStats = async (req, res, next) => {
  try {
    const { period = 'week' } = req.query;
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    const stats = await Booking.aggregate([
      {
        $match: {
          driver: req.user._id,
          status: 'completed',
          updatedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
          earnings: { $sum: '$fare' },
          rides: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// Get current active ride for driver
exports.getCurrentRide = async (req, res, next) => {
  try {
    const driverId = req.user.id;
    
    // Find active booking for driver (status: 'accepted' or 'ongoing')
    const currentRide = await Booking.findOne({
      driver: driverId,
      status: { $in: ['accepted', 'ongoing', 'picked_up'] },
      bookingType: 'taxi'
    })
    .sort({ createdAt: -1 })
    .populate('user', 'name phone')
    .populate('vehicle', 'vehicleNumber vehicleModel');

    if (!currentRide) {
      return res.status(404).json({
        success: false,
        message: 'No active ride found'
      });
    }

    res.json({
      success: true,
      data: currentRide
    });
  } catch (error) {
    next(error);
  }
};

// Get current active tour booking for driver
exports.getCurrentTourBooking = async (req, res, next) => {
  try {
    const driverId = req.user.id;
    
    // Find active tour booking for driver
    const currentBooking = await Booking.findOne({
      driver: driverId,
      status: { $in: ['confirmed', 'ongoing'] },
      bookingType: 'tour'
    })
    .sort({ createdAt: -1 })
    .populate('user', 'name phone')
    .populate('tour', 'title duration');

    if (!currentBooking) {
      return res.status(404).json({
        success: false,
        message: 'No active tour booking found'
      });
    }

    res.json({
      success: true,
      data: currentBooking
    });
  } catch (error) {
    next(error);
  }
};

exports.goOnline = async (req, res, next) => {
  try {
    console.log('goOnline called for user:', req.user.id);
    
    const updateData = { 
      isOnline: true,
      isAvailable: true,
      lastOnline: new Date()
    };
    
    console.log('Updating driver with data:', updateData);
    
    const driver = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!driver) {
      console.error('Driver not found:', req.user.id);
      return next(new ErrorResponse('Driver not found', 404));
    }

    console.log('Driver updated successfully:', {
      _id: driver._id,
      name: driver.name,
      isOnline: driver.isOnline,
      isAvailable: driver.isAvailable,
      lastOnline: driver.lastOnline
    });

    res.status(200).json({
      success: true,
      data: driver
    });
  } catch (err) {
    console.error('Error in goOnline:', err);
    next(err);
  }
};

exports.goOffline = async (req, res, next) => {
  try {
    const driver = await User.findByIdAndUpdate(
      req.user.id,
      { 
        isOnline: false,
        isAvailable: false, // Set driver as unavailable when going offline
        lastOnline: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!driver) {
      return next(new ErrorResponse('Driver not found', 404));
    }

    res.status(200).json({
      success: true,
      data: driver
    });
  } catch (err) {
    next(err);
  }
};

exports.getOnlineDrivers = async (req, res, next) => {
  try {
    const drivers = await User.find({ 
      isDriver: true, 
      isOnline: true 
    }).select('name email phone isOnline');

    res.status(200).json({
      success: true,
      count: drivers.length,
      data: drivers
    });
  } catch (err) {
    next(err);
  }
};
// Get tour bookings of driver
exports.getMyTourBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({
      driver: req.user.id,
      bookingType: "tour"
    })
      .populate("user", "name phone email")
      .populate("tour", "title duration")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    next(error);
  }
};

// Update tour booking status
exports.updateTourBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ["confirmed", "in_progress", "completed", "cancelled"];

    if (!allowedStatuses.includes(status)) {
      return next(new ErrorResponse("Invalid status", 400));
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, driver: req.user.id, bookingType: "tour" },
      { status },
      { new: true, runValidators: true }
    );

    if (!booking) {
      return next(new ErrorResponse("Tour booking not found", 404));
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};
