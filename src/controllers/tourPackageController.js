// const TourPackage = require('../models/TourPackage');
// const { uploadTourImage, deleteImage, cloudinary } = require('../config/cloudinary');
// const path = require('path');
// const fs = require('fs');
// const { promisify } = require('util');
// const { v4: uuidv4 } = require('uuid');
// const upload = promisify(cloudinary.uploader.upload);

// // Helper function to handle file upload
// const handleFileUpload = async (file) => {
//   try {
//     if (!file) return null;
    
//     // Create uploads directory if it doesn't exist
//     const uploadDir = path.join(__dirname, '../public/uploads');
//     if (!fs.existsSync(uploadDir)) {
//       fs.mkdirSync(uploadDir, { recursive: true });
//     }
    
//     // Generate unique filename
//     const fileExt = path.extname(file.name);
//     const fileName = `${uuidv4()}${fileExt}`;
//     const filePath = path.join(uploadDir, fileName);
    
//     // Move file to uploads directory
//     await file.mv(filePath);
    
//     // Return the public URL
//     return `/uploads/${fileName}`;
//   } catch (error) {
//     console.error('Error handling file upload:', error);
//     throw error;
//   }
// };

// // Get all tour packages
// exports.getTourPackages = async (req, res) => {
//   try {
//     const tourPackages = await TourPackage.find({}).sort({ createdAt: -1 });
//     res.status(200).json({
//       success: true,
//       count: tourPackages.length,
//       data: tourPackages
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Server Error',
//       error: error.message
//     });
//   }
// };

// // Get single tour package
// exports.getTourPackageById = async (req, res) => {
//   try {
//     const tourPackage = await TourPackage.findById(req.params.id);
    
//     if (!tourPackage) {
//       return res.status(404).json({
//         success: false,
//         message: 'Tour package not found'
//       });
//     }
    
//     res.status(200).json({
//       success: true,
//       data: tourPackage
//     });
//   } catch (error) {
//     if (error.kind === 'ObjectId') {
//       return res.status(404).json({
//         success: false,
//         message: 'Tour package not found'
//       });
//     }
//     res.status(500).json({
//       success: false,
//       message: 'Server Error',
//       error: error.message
//     });
//   }
// };

// // Create new tour package
// exports.createTourPackage = async (req, res) => {
//   try {
//     console.log('Request body:', req.body);
//     console.log('Uploaded file:', req.file ? req.file.filename : 'No file');
    
//     const { title, description, price, duration, location, category, isFeatured, features } = req.body;

//     // Validate required fields
//     if (!title || !description || !price || !duration || !location || !category) {
//       // Clean up uploaded file if validation fails
//       if (req.file?.path) {
//         try {
//           await fs.promises.unlink(req.file.path);
//           console.log('Cleaned up temp file after validation error');
//         } catch (cleanupError) {
//           console.error('Error cleaning up temp file after validation error:', cleanupError);
//         }
//       }
      
//       return res.status(400).json({
//         success: false,
//         message: 'Please provide all required fields: title, description, price, duration, location, category'
//       });
//     }

//     try {
//       let imageUrl = '';
//       let imagePublicId = '';

//       // Process file upload if present
//       if (req.file) {
//         console.log('Uploading file to Cloudinary...');
//         const result = await uploadToCloudinary(req.file.path);
//         console.log('File uploaded to Cloudinary:', result.secure_url);
        
//         imageUrl = result.secure_url;
//         imagePublicId = result.public_id;
//       }
      
//       // Create new tour package
//       const newPackage = new TourPackage({
//         title,
//         description,
//         price: Number(price),
//         duration,
//         location,
//         category,
//         isFeatured: isFeatured === 'true',
//         features: Array.isArray(features) ? features : [],
//         image: imageUrl,
//         imagePublicId
//       });

//       console.log('Saving tour package to database...');
//       const savedPackage = await newPackage.save();
//       console.log('Tour package saved successfully');

//       // Clean up temp file after successful upload
//       if (req.file?.path) {
//         try {
//           await fs.promises.unlink(req.file.path);
//           console.log('Cleaned up temp file after successful upload');
//         } catch (cleanupError) {
//           console.error('Error cleaning up temp file:', cleanupError);
//         }
//       }

//       res.status(201).json({
//         success: true,
//         data: savedPackage
//       });
      
//     } catch (uploadError) {
//       console.error('Error in file upload:', uploadError);
      
//       // Clean up temp file if it exists
//       if (req.file?.path && fs.existsSync(req.file.path)) {
//         try {
//           await fs.promises.unlink(req.file.path);
//           console.log('Cleaned up temp file after upload error');
//         } catch (cleanupError) {
//           console.error('Error cleaning up temp file after upload error:', cleanupError);
//         }
//       }
      
//       return res.status(500).json({
//         success: false,
//         message: 'Error uploading image',
//         error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
//       });
//     }
    
//   } catch (error) {
//     console.error('Error creating tour package:', error);
    
//     // Clean up temp file if it exists
//     if (req.file?.path && fs.existsSync(req.file.path)) {
//       try {
//         await fs.promises.unlink(req.file.path);
//         console.log('Cleaned up temp file after error');
//       } catch (cleanupError) {
//         console.error('Error cleaning up temp file after error:', cleanupError);
//       }
//     }
    
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };

// // Update tour package
// exports.updateTourPackage = async (req, res) => {
//   try {
//     let tourPackage = await TourPackage.findById(req.params.id);
    
//     if (!tourPackage) {
//       return res.status(404).json({
//         success: false,
//         message: 'Tour package not found'
//       });
//     }
    
//     const { title, description, price, duration, location, isPopular, features } = req.body;
    
//     // Update fields
//     tourPackage.title = title || tourPackage.title;
//     tourPackage.description = description || tourPackage.description;
//     tourPackage.price = price || tourPackage.price;
//     tourPackage.duration = duration || tourPackage.duration;
//     tourPackage.location = location || tourPackage.location;
//     tourPackage.isPopular = isPopular ? isPopular === 'true' : tourPackage.isPopular;
//     tourPackage.features = features ? features.split(',').map(f => f.trim()) : tourPackage.features;

//     // Check if a new image was uploaded
//     if (req.file) {
//       // Delete the old image from Cloudinary if it exists
//       if (tourPackage.image && tourPackage.image.public_id) {
//         await deleteImage(tourPackage.image.public_id);
//       }

//       // Upload new image to Cloudinary
//       const result = await cloudinary.uploader.upload(req.file.path, {
//         folder: 'tour-packages',
//         width: 1200,
//         height: 800,
//         crop: 'limit'
//       });

//       tourPackage.image = {
//         url: result.secure_url,
//         public_id: result.public_id
//       };
//     }

//     await tourPackage.save();

//     res.status(200).json({
//       success: true,
//       data: tourPackage
//     });
//   } catch (error) {
//     console.error('Error updating tour package:', error);
    
//     // If there was an error and a new file was uploaded, delete it
//     if (req.file?.filename) {
//       await cloudinary.uploader.destroy(req.file.filename);
//     }
    
//     res.status(500).json({
//       success: false,
//       message: 'Error updating tour package',
//       error: error.message
//     });
//   }
// };

// // Delete a tour package
// exports.deleteTourPackage = async (req, res) => {
//   try {
//     const package = await TourPackage.findById(req.params.id);
    
//     if (!package) {
//       return res.status(404).json({
//         success: false,
//         message: 'Tour package not found'
//       });
//     }

//     // Delete image from Cloudinary if it exists
//     if (package.image?.public_id) {
//       try {
//         await cloudinary.uploader.destroy(package.image.public_id);
//       } catch (error) {
//         console.error('Error deleting image from Cloudinary:', error);
//         // Continue with deletion even if image deletion fails
//       }
//     }

//     await package.remove();

//     res.status(200).json({
//       success: true,
//       message: 'Tour package deleted successfully'
//     });
//   } catch (error) {
//     console.error('Error in deleteTourPackage:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error deleting tour package',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };

// // Get featured tour packages
// exports.getFeaturedTourPackages = async (req, res) => {
//   try {
//     const featuredPackages = await TourPackage.find({ isFeatured: true }).limit(3);
//     res.status(200).json({
//       success: true,
//       count: featuredPackages.length,
//       data: featuredPackages
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// };

// // Get tour packages by category
// exports.getTourPackagesByCategory = async (req, res) => {
//   try {
//     const { category } = req.params;
//     const packages = await TourPackage.find({ category });
    
//     res.status(200).json({
//       success: true,
//       count: packages.length,
//       data: packages
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// };
const TourPackage = require('../models/TourPackage');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// Get all tour packages
exports.getTourPackages = async (req, res) => {
  try {
    const packages = await TourPackage.find().sort({ createdAt: -1 });
    res.json({ success: true, data: packages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get featured packages
exports.getFeaturedTourPackages = async (req, res) => {
  try {
    const featured = await TourPackage.find({ isPopular: true });
    res.json({ success: true, data: featured });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get packages by category
exports.getTourPackagesByCategory = async (req, res) => {
  try {
    const packages = await TourPackage.find({ category: req.params.category });
    res.json({ success: true, data: packages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get single package
exports.getTourPackageById = async (req, res) => {
  try {
    const pkg = await TourPackage.findById(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }
    res.json({ success: true, data: pkg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create new package
exports.createTourPackage = async (req, res) => {
  try {
    let imageData = null;
    if (req.file && req.file.path) {
      const uploadRes = await uploadToCloudinary(req.file.path);
      imageData = { url: uploadRes.secure_url, public_id: uploadRes.public_id };
    }

    const newPackage = new TourPackage({
      ...req.body,
      image: imageData
    });

    await newPackage.save();
    res.status(201).json({ success: true, data: newPackage });
  } catch (err) {
    console.error('Error creating tour package:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.updateTourPackage = async (req, res) => {
  try {
    const pkg = await TourPackage.findById(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    // Agar nayi image aayi hai to purani delete karke new upload
    if (req.file && req.file.path) {
      if (pkg.image && pkg.image.public_id) {
        await deleteFromCloudinary(pkg.image.public_id);
      }
      const uploadRes = await uploadToCloudinary(req.file.path);
      req.body.image = {
        url: uploadRes.secure_url,
        public_id: uploadRes.public_id,
      };
    }

    const updated = await TourPackage.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating tour package:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🟢 Delete tour package
exports.deleteTourPackage = async (req, res) => {
  try {
    const pkg = await TourPackage.findById(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    // Purani image Cloudinary se delete karo
    if (pkg.image && pkg.image.public_id) {
      await deleteFromCloudinary(pkg.image.public_id);
    }

    await pkg.deleteOne();

    res.json({ success: true, message: 'Package deleted successfully' });
  } catch (err) {
    console.error('Error deleting tour package:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
