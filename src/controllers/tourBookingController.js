const TourBooking = require('../models/TourBooking');
const TourPackage = require('../models/TourPackage');
const User = require('../models/User');

// @desc    Create a new tour booking
// @route   POST /api/bookings/tour
// @access  Private
exports.createTourBooking = async (req, res) => {
  try {
    console.log('=== Received Booking Request ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    const { 
      tourId, 
      tourTitle,
      tourPrice,
      name,
      email,
      phone,
      travelDate,
      numberOfPeople,
      specialRequests,
      pickupLocation
    } = req.body;

    // Log the authenticated user
    console.log('Authenticated User ID:', req.user?.id);

    // Validate required fields
    const requiredFields = ['tourId', 'name', 'email', 'phone', 'travelDate', 'numberOfPeople'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Clean and validate phone number
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number (at least 10 digits)'
      });
    }

    // Check if tour package exists
    const tourPackage = await TourPackage.findById(tourId);
    if (!tourPackage) {
      console.error('Tour package not found:', tourId);
      return res.status(404).json({
        success: false,
        message: 'Tour package not found'
      });
    }

    // Calculate total amount
    const calculatedPrice = tourPrice || tourPackage.price;
    const calculatedTotal = calculatedPrice * numberOfPeople;

    // Create booking
    const booking = new TourBooking({
      user: req.user.id,
      tour: tourId,
      tourTitle: tourTitle || tourPackage.title,
      tourPrice: calculatedPrice,
      customerName: name,
      customerEmail: email.toLowerCase(),
      customerPhone: cleanPhone,
      travelDate: new Date(travelDate),
      numberOfPeople: parseInt(numberOfPeople, 10),
      specialRequests: specialRequests || '',
      totalAmount: calculatedTotal,
      pickupLocation: pickupLocation || '',
      status: 'pending',
      paymentStatus: 'pending'
    });

    // Save booking to database
    await booking.save();

    // Populate tour details for response
    await booking.populate('tour', 'title image location duration');

    res.status(201).json({
      success: true,
      message: 'Tour booked successfully',
      data: booking
    });

  } catch (error) {
    console.error('Tour booking error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Handle duplicate key errors
    if (error.name === 'MongoError' && error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A booking with these details already exists.'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    // Handle other errors
    res.status(500).json({
      success: false,
      message: 'Server error while creating booking',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Get all tour bookings for a user
// @route   GET /api/bookings/tour/my-bookings
// @access  Private
exports.getMyTourBookings = async (req, res) => {
  try {
    const bookings = await TourBooking.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('tour', 'title image location duration');

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Get tour bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get tour booking by ID
// @route   GET /api/bookings/tour/:id
// @access  Private
exports.getTourBooking = async (req, res) => {
  try {
    const booking = await TourBooking.findById(req.params.id)
      .populate('tour', 'title image location duration');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Make sure user owns the booking
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to view this booking'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get tour booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Cancel a tour booking
// @route   PUT /api/bookings/tour/:id/cancel
// @access  Private
exports.cancelTourBooking = async (req, res) => {
  try {
    const booking = await TourBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Make sure user owns the booking
    if (booking.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    booking.status = 'cancelled';
    await booking.save();

    console.log('Booking cancelled successfully:', booking._id);
    
    // TODO: Send cancellation email

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Cancel tour booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
