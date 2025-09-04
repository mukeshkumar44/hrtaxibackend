const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - Verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists'
      });
    }
    
    // Set user in request object
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Restrict to specific roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to perform this action'
      });
    }
    next();
  };
};

// Check if user is admin
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Admin access required'
  });
};

// Check if user is online
// Skip check for certain routes or user roles
exports.checkOnlineStatus = (req, res, next) => {
  // Skip online check for taxi registration
  if (req.originalUrl.includes('/api/taxis/register')) {
    return next();
  }
  
  // Allow admins to bypass online status check
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  // For other users, check online status
  if (!req.user || !req.user.isOnline) {
    return res.status(403).json({ 
      success: false, 
      message: 'User must be online to perform this action' 
    });
  }
  
  next();
};
