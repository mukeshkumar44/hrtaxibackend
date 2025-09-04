const User = require('../models/User');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Middleware to check if the user is an approved driver
 */
exports.driver = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Find user with taxi details
    const user = await User.findById(req.user.id).populate('taxi');
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Check if user is a driver
    if (user.role !== 'driver') {
      throw new ForbiddenError('Access denied. Driver role required.');
    }

    // Check if driver has an approved taxi
    if (!user.taxi || user.taxi.status !== 'approved') {
      throw new ForbiddenError('Access denied. Your taxi is not approved yet.');
    }

    // Attach driver and taxi details to request
    req.driver = user;
    req.taxi = user.taxi;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if driver is online
 */
exports.checkOnlineStatus = async (req, res, next) => {
  try {
    const driver = await User.findById(req.user.id);
    
    if (!driver.isOnline) {
      return res.status(400).json({
        success: false,
        message: 'You must be online to perform this action'
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};
