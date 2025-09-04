const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a title for the image'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  image: {
    type: String,
    required: [true, 'Please provide an image URL']
  },
  imagePublicId: {
    type: String,
    required: [true, 'Image public ID is required']
  },
  category: {
    type: String,
    enum: ['tours', 'destinations', 'events', 'hotels', 'transport'],
    default: 'tours'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add text index for search functionality
gallerySchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Gallery', gallerySchema);
