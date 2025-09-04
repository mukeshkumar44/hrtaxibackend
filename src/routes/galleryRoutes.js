const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { 
  getGalleryImages, 
  uploadGalleryImage, 
  deleteGalleryImage 
} = require('../controllers/galleryController');

// Public routes
router.get('/', getGalleryImages);

// Protected routes (Admin only) - Temporarily disabled auth for testing
router.post(
  '/', 
  // protect, 
  // authorize('admin'), 
  uploadGalleryImage
);

router.delete(
  '/:id', 
  protect, 
  authorize('admin'), 
  deleteGalleryImage
);

module.exports = router;
