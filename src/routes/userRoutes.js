const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/send-otp', userController.sendOtp);
router.post('/verify-otp', userController.verifyOtp);

// Protected routes
router.get('/me', authMiddleware.protect, userController.getCurrentUser);
router.get('/profile', authMiddleware.protect, userController.getCurrentUser);

module.exports = router;