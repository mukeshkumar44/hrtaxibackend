const Gallery = require('../models/Gallery');
const cloudinary = require('cloudinary').v2;

// @desc    Get all gallery images
// @route   GET /api/gallery
// @access  Public
exports.getGalleryImages = async (req, res) => {
  try {
    const { category, search, featured } = req.query;
    
    const query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    if (featured === 'true') {
      query.isFeatured = true;
    }
    
    const images = await Gallery.find(query).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: images.length,
      data: images
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Upload gallery image
// @route   POST /api/gallery
// @access  Private/Admin
exports.uploadGalleryImage = async (req, res) => {
  console.log('=== UPLOAD REQUEST RECEIVED ===');
  console.log('Request body:', req.body);
  console.log('Request files:', req.files);
  
  let result;
  
  try {
    if (!req.files || !req.files.image) {
      console.error('No image file found in request');
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file',
        receivedFiles: req.files ? Object.keys(req.files) : 'No files received'
      });
    }

    const file = req.files.image;
    console.log('Processing file:', {
      name: file.name,
      size: file.size,
      mimetype: file.mimetype,
      tempFilePath: file.tempFilePath ? 'exists' : 'missing',
      truncated: file.truncated
    });

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPG, PNG, and GIF are allowed.'
      });
    }
    
    // Check if temp file exists
    const fs = require('fs');
    if (!file.tempFilePath || !fs.existsSync(file.tempFilePath)) {
      console.error('Temporary file not found at:', file.tempFilePath);
      return res.status(400).json({
        success: false,
        message: 'Temporary file not found. Please try again.'
      });
    }
    
    // Upload to Cloudinary using temporary file path
    result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        file.tempFilePath,
        {
          folder: 'gallery',
          allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
          transformation: [{ width: 1200, height: 800, crop: 'limit' }]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }
          resolve(result);
        }
      );
    });

    // Parse form data
    const { title = '', description = '', category = 'tours', isFeatured = 'false' } = req.body;
    
    console.log('Creating gallery entry with:', {
      title,
      description,
      category,
      isFeatured,
      imageUrl: result.secure_url
    });
    
    const galleryImage = await Gallery.create({
      title,
      description,
      category: category,
      isFeatured: isFeatured === 'true',
      image: result.secure_url,
      imagePublicId: result.public_id
    });

    res.status(201).json({
      success: true,
      data: galleryImage
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    
    // Clean up uploaded file if there was an error
    if (result?.public_id) {
      try {
        await cloudinary.uploader.destroy(result.public_id);
      } catch (err) {
        console.error('Error cleaning up image from Cloudinary:', err);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Delete gallery image
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
exports.deleteGalleryImage = async (req, res) => {
  try {
    const galleryImage = await Gallery.findById(req.params.id);
    
    if (!galleryImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }
    
    // Delete image from Cloudinary
    if (galleryImage.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(galleryImage.imagePublicId);
      } catch (err) {
        console.error('Error deleting image from Cloudinary:', err);
        // Continue with deletion even if image deletion fails
      }
    }
    
    await Gallery.deleteOne({ _id: galleryImage._id });
    // OR use findByIdAndDelete
    // await Gallery.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting gallery image:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};
