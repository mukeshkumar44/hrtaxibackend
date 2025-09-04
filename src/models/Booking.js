const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
    default: () => `BK-${uuidv4().substring(0, 8).toUpperCase()}`
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  pickupLocation: {
    address: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },
  dropLocation: {
    address: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    }
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  passengers: {
    type: Number,
    required: true
  },
  vehicleType: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true
  },
  message: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'driver_assigned', 'driver_arrived', 'in_progress', 'completed', 'cancelled', 'no_drivers'],
    default: 'pending'
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  fare: {
    type: Number,
    default: 0
  },
  distance: {
    type: Number,
    required: true
  },
  estimatedDuration: {
    type: Number,
    required: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: {
    type: Date
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String
  },
  // For tracking which drivers have rejected the ride
  rejectedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Remove any existing index on bookingId to prevent conflicts
bookingSchema.index({ bookingId: 1 }, { unique: true });

// Indexes for better query performance
bookingSchema.index({ 'pickupLocation.coordinates': '2dsphere' });
bookingSchema.index({ status: 1 });
bookingSchema.index({ user: 1 });
bookingSchema.index({ driver: 1 });

module.exports = mongoose.model('Booking', bookingSchema);