const mongoose = require('mongoose');

const tourPackageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  duration: {
    type: String,
    required: [true, 'Duration is required']
  },
  location: {
    type: String,
    required: [true, 'Location is required']
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  features: [{
    type: String,
    trim: true
  }],
  image: {
    url: {
      type: String,
      required: [true, 'Image URL is required']
    },
    public_id: {
      type: String,
      required: [true, 'Image public ID is required']
    }
  },
  highlights: [{
    type: String,
    trim: true
  }],
  included: [{
    type: String,
    trim: true
  }],
  notIncluded: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add text index for search functionality
tourPackageSchema.index({
  title: 'text',
  description: 'text',
  location: 'text'
});

module.exports = mongoose.model('TourPackage', tourPackageSchema);
