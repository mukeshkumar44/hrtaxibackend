const Gallery = require('../models/Gallery');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

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
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file'
      });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        req.file.path,
        {
          folder: 'gallery',
          resource_type: 'image',
          transformation: [
            { width: 1200, crop: 'limit' },
            { quality: 'auto:good' }
          ]
        },
        (error, result) => {
          if (error) {
            return reject(new Error('Failed to upload image to Cloudinary'));
          }
          resolve(result);
        }
      );
    });

    // Parse form data
    const { title = '', description = '', category = 'tours', isFeatured = 'false' } = req.body;

    // Create gallery entry
    const galleryImage = await Gallery.create({
      title,
      description,
      category,
      isFeatured: isFeatured === 'true',
      image: result.secure_url,
      imagePublicId: result.public_id
    });

    // Clean up the temporary file
    fs.unlink(req.file.path, (err) => {
      if (err) {}
    });

    res.status(201).json({
      success: true,
      data: galleryImage
    });

  } catch (error) {
    // Clean up the temporary file if it exists
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    res.status(500).json({
      success: false,
      message: 'Server error during image upload',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete gallery image
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
exports.deleteGalleryImage = async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Delete from Cloudinary if public ID exists
    if (image.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(image.imagePublicId);
      } catch (cloudinaryError) {
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Delete from database
    await Gallery.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting image',
      error: error.message
    });
  }
};
