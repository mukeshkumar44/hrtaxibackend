// // routes/tourPackageRoutes.js
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const tourPackageController = require('../controllers/tourPackageController');

// Public routes
router.get('/', tourPackageController.getTourPackages);
router.get('/featured', tourPackageController.getFeaturedTourPackages);
router.get('/category/:category', tourPackageController.getTourPackagesByCategory);
router.get('/:id', tourPackageController.getTourPackageById);

// Admin protected routes
router.post('/', protect, admin, upload.single("image"),
   tourPackageController.createTourPackage);
router.put('/:id', protect, admin, upload.single("image"), tourPackageController.updateTourPackage);
router.delete('/:id', protect, admin, tourPackageController.deleteTourPackage);

module.exports = router;
