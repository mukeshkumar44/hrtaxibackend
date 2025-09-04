const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route - Create a new contact message
router.post('/', contactController.createContact);

// Protected routes - Require authentication
router.get('/', authMiddleware.protect, authMiddleware.restrictTo('admin'), contactController.getAllContacts);
router.delete('/:id', authMiddleware.protect, authMiddleware.restrictTo('admin'), contactController.deleteContact);

module.exports = router;