const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Generate OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Send OTP via email
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your OTP for HRTaxi Account Verification',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">HRTaxi.com Account Verification</h2>
        <p style="color: #666; font-size: 16px;">Thank you for registering with HRTaxi.com. Please use the following OTP to verify your account:</p>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <h1 style="color: #ffc107; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p style="color: #666; font-size: 14px;">This OTP is valid for 10 minutes. If you didn't request this verification, please ignore this email.</p>
        <div style="text-align: center; margin-top: 30px; color: #888; font-size: 12px;">
          <p> ${new Date().getFullYear()} HRTaxi.com. All rights reserved.</p>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

// Register a new user
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Generate OTP
    const otp = generateOTP();
    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10); // OTP expires in 10 minutes
    
    // Create new user
    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      otp: {
        code: otp,
        expiresAt: otpExpiresAt
      }
    });
    
    await user.save();
    
    // Send OTP email
    await sendOTPEmail(email, otp);
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify your email.',
      requiresOTP: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }
    
    // Find user with password explicitly selected
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role || 'user' }, 
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    // Remove password from response
    user.password = undefined;
    
    // Ensure user has a role, default to 'user' if not set
    const userRole = user.role || 'user';
    
    res.status(200).json({
      success: true,
      token, // Make sure to include the JWT token
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles || [user.role || 'user']
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -otp');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Ensure backward compatibility with legacy role field
    const userObj = user.toObject();
    if (!userObj.roles || !Array.isArray(userObj.roles)) {
      userObj.roles = [user.role || 'user'];
    }
    
    res.status(200).json({
      success: true,
      data: userObj
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Send OTP
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Generate new OTP
    const otp = generateOTP();
    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10); // OTP expires in 10 minutes
    
    // Update user with new OTP
    user.otp = {
      code: otp,
      expiresAt: otpExpiresAt
    };
    
    await user.save();
    
    // Send OTP email
    await sendOTPEmail(email, otp);
    
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if OTP exists and is valid
    if (!user.otp || !user.otp.code) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new one.'
      });
    }
    
    // Check if OTP is expired
    if (user.otp.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }
    
    // Check if OTP matches
    if (user.otp.code !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }
    
    // Mark user as verified
    user.isVerified = true;
    user.otp = undefined; // Clear OTP after successful verification
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};