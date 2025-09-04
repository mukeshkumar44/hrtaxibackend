const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Debug route to list all drivers
router.get('/debug/drivers', async (req, res) => {
  try {
    const drivers = await User.find({
      $or: [
        { isDriver: true },
        { role: 'driver' },
        { roles: 'driver' }
      ]
    }).select('name email role roles isOnline isDriver');

    res.json({
      success: true,
      count: drivers.length,
      online: drivers.filter(d => d.isOnline).length,
      drivers
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug route to set a driver as online
router.post('/debug/drivers/:id/online', async (req, res) => {
  try {
    const driver = await User.findByIdAndUpdate(
      req.params.id,
      { isOnline: true },
      { new: true }
    );
    
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    
    res.json({ success: true, driver });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
