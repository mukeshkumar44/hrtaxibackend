const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fileUpload = require('express-fileupload');
const helmet = require('helmet');
const morgan = require('morgan');
const { app, server } = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// MongoDB Atlas connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://mk8701952:PlnKXynqQHZewAT7@cluster0.e6mpcfg.mongodb.net/hrtaxi?retryWrites=true&w=majority";

console.log('Attempting to connect to MongoDB Atlas...');

// Connection events
mongoose.connection.on('connecting', () => {
  console.log('Connecting to MongoDB...');
});

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
  // Create indexes after connection is established
  mongoose.connection.db.collection('bookings').createIndex({ 'pickupLocation.coordinates': '2dsphere' });
  mongoose.connection.db.collection('bookings').createIndex({ status: 1 });
  mongoose.connection.db.collection('bookings').createIndex({ user: 1 });
  mongoose.connection.db.collection('bookings').createIndex({ driver: 1 });
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  if (err.name === 'MongoNetworkError') {
    console.error('Network error connecting to MongoDB. Please check your connection.');
  } else if (err.name === 'MongooseServerSelectionError') {
    console.error('Server selection error. Please check if MongoDB is running and accessible.');
  }
});

mongoose.connection.on('disconnected', () => {
  console.log('Disconnected from MongoDB');
});

// Configure Mongoose
mongoose.set('debug', process.env.NODE_ENV === 'development');
mongoose.set('strictQuery', false);

// Connect to MongoDB with retry logic
const connectWithRetry = () => {
  console.log('Attempting MongoDB connection...');
  return mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    maxPoolSize: 10, // Maintain up to 10 socket connections
    retryWrites: true,
    w: 'majority'
  });
};

// Initial connection
connectWithRetry().catch(err => {
  console.error('Failed to connect to MongoDB on startup - retrying in 5 sec', err);
  setTimeout(connectWithRetry, 5000);
});

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// File uploads
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Create tmp directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('./tmp')) {
  fs.mkdirSync('./tmp');
}

const path = require('path');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory at:', uploadsDir);
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Import routes
const bookingRoutes = require('./routes/bookingRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const taxiRoutes = require('./routes/taxiRoutes');
const tourPackageRoutes = require('./routes/tourPackageRoutes');
const tourBookingRoutes = require('./routes/tourBookingRoutes');
const tourDriverRoutes = require('./routes/tourDriverRoutes');
const driverRoutes = require('./routes/driverRoutes');

// Routes
app.get('/', (req, res) => {
  res.send('Taxi Booking API is running');
});

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', req.headers);
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    console.log('Body:', req.body);
  }
  next();
});

// API Routes
app.use('/api/gallery', galleryRoutes);
// Remove the duplicate tour-packages route - it's already mounted in app.js
app.use('/api/taxis', taxiRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/tour-packages', tourPackageRoutes);
app.use('/api/tour-bookings', tourBookingRoutes);
app.use('/api/tour-drivers', tourDriverRoutes);
console.log("Mounting driver routes at /api/driver");

app.use('/api/driver', driverRoutes);
// Contact Form API Route
app.post('/api/contact', (req, res) => {
  console.log('Contact form data received:', req.body);
  res.status(201).json({ 
    success: true, 
    message: 'Message received successfully!',
    data: req.body
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection! Shutting down...');
  console.error(err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception! Shutting down...');
  console.error(err);
  process.exit(1);
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});