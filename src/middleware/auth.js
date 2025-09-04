const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;
  console.log('Auth headers:', req.headers.authorization);

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
    console.log('Token found in Authorization header');
  } else {
    console.log('No Bearer token found in headers');
    return next(new ErrorResponse('Not authorized to access this route - No token provided', 401));
  }

  try {
    console.log('Verifying token...');
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified. Decoded:', decoded);
    
    // Find user and ensure we're only selecting necessary fields
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('User not found for token');
      return next(new ErrorResponse('User not found', 404));
    }

    // Add user to request object
    req.user = {
      _id: user._id,           // Ensure _id is available
      id: user._id.toString(), // Also include id as string for consistency
      email: user.email,
      name: user.name,
      role: user.role || 'user'
    };
    
    console.log('User authenticated:', req.user);
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (error.name === 'JsonWebTokenError') {
      return next(new ErrorResponse('Invalid token', 401));
    } else if (error.name === 'TokenExpiredError') {
      return next(new ErrorResponse('Token expired', 401));
    }
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

// Alias for authorize('admin')
exports.admin = (req, res, next) => {
  return exports.authorize('admin')(req, res, next);
};

// Alias for authorize('driver')
exports.driver = (req, res, next) => {
  return exports.authorize('driver')(req, res, next);
};
