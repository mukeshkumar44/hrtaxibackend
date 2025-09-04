const mongoose = require('mongoose');

const tourBookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tour: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TourPackage',
    required: true
  },
  tourTitle: {
    type: String,
    required: true
  },
  tourPrice: {
    type: Number,
    required: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{10,15}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  travelDate: {
    type: Date,
    required: true
  },
  numberOfPeople: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  specialRequests: {
    type: String,
    trim: true,
    default: ''
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  pickupLocation: {
    type: String,
    trim: true,
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  bookingDate: {
    type: Date,
    default: Date.now
  },
  // Additional fields for future use
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'netbanking', 'wallet', null],
    default: null
  },
  transactionId: {
    type: String,
    default: ''
  },
  cancellationReason: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
tourBookingSchema.index({ user: 1 });
tourBookingSchema.index({ tour: 1 });
tourBookingSchema.index({ status: 1 });
tourBookingSchema.index({ travelDate: 1 });

// Virtual for formatted booking date
tourBookingSchema.virtual('formattedBookingDate').get(function() {
  return this.bookingDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
});

// Virtual for formatted travel date
tourBookingSchema.virtual('formattedTravelDate').get(function() {
  return this.travelDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    weekday: 'short'
  });
});

// Pre-save hook to update related data if needed
tourBookingSchema.pre('save', async function(next) {
  // You can add any pre-save logic here
  next();
});

// Static method to get booking stats
tourBookingSchema.statics.getBookingStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        count: 1,
        totalAmount: 1
      }
    },
    { $sort: { count: -1 } }
  ]);

  return stats;
};

const TourBooking = mongoose.model('TourBooking', tourBookingSchema);

module.exports = TourBooking;
