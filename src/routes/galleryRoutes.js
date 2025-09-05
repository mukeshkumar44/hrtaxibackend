const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');
const { 
  getGalleryImages, 
  uploadGalleryImage, 
  deleteGalleryImage 
} = require('../controllers/galleryController');

// Public routes
router.get('/', getGalleryImages);

// Protected routes (Admin only)
router.post(
  '/',
  // protect,
  // authorize('admin'),
  (req, res, next) => {
    console.log('Request headers:', req.headers);
    console.log('Content-Type:', req.get('Content-Type'));
    next();
  },
  upload.single('image'),
  (req, res, next) => {
    console.log('File after upload middleware:', req.file);
    console.log('Request body after upload:', req.body);
    if (!req.file) {
      console.error('No file was attached');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    next();
  },
  uploadGalleryImage
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteGalleryImage
);

module.exports = router;
