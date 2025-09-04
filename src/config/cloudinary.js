// // In d:\backendhrtaxi\src\config\cloudinary.js

// const cloudinary = require('cloudinary').v2;
// const { promisify } = require('util');
// const fs = require('fs');
// const unlinkFile = promisify(fs.unlink);

// // Configure Cloudinary
// if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
//   console.error('Missing Cloudinary configuration. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
//   process.exit(1);
// }

// try {
//   cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET,
//     secure: true
//   });
//   console.log('Cloudinary configuration successful');
// } catch (configError) {
//   console.error('Error configuring Cloudinary:', configError);
//   process.exit(1);
// }

// /**
//  * Upload a file to Cloudinary
//  * @param {string} filePath - Path to the file to upload
//  * @returns {Promise<Object>} - The Cloudinary upload result
//  */
// const uploadToCloudinary = async (filePath) => {
//   try {
//     if (!filePath || !fs.existsSync(filePath)) {
//       throw new Error('File does not exist: ' + filePath);
//     }

//     console.log('Starting Cloudinary upload for file:', filePath);
    
//     const result = await cloudinary.uploader.upload(filePath, {
//       folder: 'tour-packages',
//       resource_type: 'auto',
//       use_filename: true,
//       unique_filename: true,
//       overwrite: true,
//       chunk_size: 6000000, // 6MB chunks for large files
//       timeout: 60000 // 60 seconds timeout
//     });

//     console.log('Successfully uploaded to Cloudinary:', result.secure_url);
//     return result;
//   } catch (error) {
//     console.error('Error uploading to Cloudinary:', error);
//     throw error;
//   } finally {
//     // Clean up the temporary file
//     if (filePath && fs.existsSync(filePath)) {
//       try {
//         await unlinkFile(filePath);
//         console.log('Temporary file cleaned up:', filePath);
//       } catch (cleanupError) {
//         console.error('Error cleaning up temp file:', cleanupError);
//       }
//     }
//   }
// };

// /**
//  * Delete a file from Cloudinary
//  * @param {string} publicId - The public ID of the file to delete
//  * @returns {Promise<Object>} - The Cloudinary deletion result
//  */
// const deleteFromCloudinary = async (publicId) => {
//   try {
//     if (!publicId) {
//       throw new Error('No public ID provided');
//     }
    
//     console.log('Deleting file from Cloudinary:', publicId);
//     const result = await cloudinary.uploader.destroy(publicId);
//     console.log('File deleted from Cloudinary:', publicId);
//     return result;
//   } catch (error) {
//     console.error('Error deleting from Cloudinary:', error);
//     throw error;
//   }
// };

// module.exports = {
//   cloudinary,
//   uploadToCloudinary,
//   deleteFromCloudinary
// };
// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { promisify } = require('util');
const fs = require('fs');
const unlinkFile = promisify(fs.unlink);

// Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Upload file
const uploadToCloudinary = async (filePath) => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'tour-packages',
    resource_type: 'auto'
  });
  await unlinkFile(filePath); // remove tmp file
  return result;
};

// Delete file
const deleteFromCloudinary = async (publicId) => {
  return await cloudinary.uploader.destroy(publicId);
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };
