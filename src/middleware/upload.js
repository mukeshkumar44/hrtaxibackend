// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// // Configure storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const dir = path.join(process.cwd(), 'tmp');
//     if (!fs.existsSync(dir)) {
//       fs.mkdirSync(dir, { recursive: true });
//     }
//     cb(null, dir);
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// // File filter
// const fileFilter = (req, file, cb) => {
//   const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
//   if (allowedTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
//   }
// };

// // Create multer instance
// const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB
//     files: 1
//   }
// });

// // Middleware to handle file upload
// const handleFileUpload = (req, res, next) => {
//   // Use multer upload middleware
//   upload.single('image')(req, res, function(err) {
//     if (err) {
//       console.error('File upload error:', err);
      
//       if (err.code === 'LIMIT_FILE_SIZE') {
//         return res.status(400).json({
//           success: false,
//           message: 'File too large. Maximum size is 10MB.'
//         });
//       }
      
//       if (err.code === 'LIMIT_UNEXPECTED_FILE') {
//         return res.status(400).json({
//           success: false,
//           message: 'Unexpected file field. Only "image" field is allowed.'
//         });
//       }
      
//       return res.status(400).json({
//         success: false,
//         message: err.message || 'Error uploading file.'
//       });
//     }
    
//     next();
//   });
// };

// module.exports = handleFileUpload;
// middleware/upload.js
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// // Configure storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const dir = path.join(process.cwd(), 'tmp');
//     if (!fs.existsSync(dir)) {
//       fs.mkdirSync(dir, { recursive: true });
//     }
//     cb(null, dir);
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// // File filter
// const fileFilter = (req, file, cb) => {
//   const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
//   if (allowedTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
//   }
// };

// // Create multer instance
// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 10 * 1024 * 1024, files: 1 }
// });

// module.exports = upload.single('image'); // single file upload field = "image"

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "img-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });
module.exports = upload; // 👈 हमेशा instance export करो
