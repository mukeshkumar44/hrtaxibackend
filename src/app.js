// backend/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
;
require('dotenv').config();
const { initSocket } = require('./services/socketService');

// Import routes
const bookingRoutes = require('./routes/bookingRoutes');
const contactRoutes = require('./routes/contactRoutes');
const userRoutes = require('./routes/userRoutes');
const tourPackageRoutes = require('./routes/tourPackageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminBookingRoutes = require('./routes/adminBookingRoutes');
const adminTaxiRoutes = require('./routes/adminTaxiRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const taxiRoutes = require('./routes/taxiRoutes');
const tourBookingRoutes = require('./routes/tourBookingRoutes');
const tourDriverRoutes = require('./routes/tourDriverRoutes');
const driverRoutes = require('./routes/driverRoutes');
const debugRoutes = require('./routes/debugRoutes');

const app = express();
const server = http.createServer(app);
const fs = require('fs');

// Initialize WebSocket
const io = initSocket(server);
app.set('io', io);

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000',
    
    'https://hr-taxi-frontend.vercel.app',
    'https://hrtaxifrontend.onrender.com',  
      
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Pragma', 'Expires'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Configure file upload middleware

// Add cache control headers to API responses
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Middlewares
app.use(helmet());
app.use(cors(corsOptions));

// Configure body parser first
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files with cache control
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), {
  etag: true,
  lastModified: true,
  maxAge: '1d', // Cache for 1 day
  setHeaders: (res, path) => {
    if (path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.jpeg')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    }
  }
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Create tmp directory if it doesn't exist
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Make uploads folder static
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Routes
// Specific routes first
app.use('/api/bookings/tour', tourBookingRoutes);
app.use('/api/tour-bookings', tourDriverRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tour-packages', tourPackageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);
app.use('/api/admin/taxis', adminTaxiRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/taxis', taxiRoutes);
// General routes last
app.use('/api/bookings', bookingRoutes);


app.use('/api', debugRoutes);


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

module.exports = { app, server };
