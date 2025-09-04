const socketIO = require('socket.io');
const User = require('../models/User');
const Booking = require('../models/Booking');

// Store active connections
const activeConnections = new Map();
let ioInstance = null;

// Initialize Socket.IO
const initSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000 // 25 seconds
  });

  ioInstance = io;

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    let currentUserId = null;

    // Handle authentication
    socket.on('authenticate', async ({ token, userId, userType }) => {
      try {
        // In a real app, verify the token here
        const user = await User.findById(userId);
        if (!user) {
          throw new Error('User not found');
        }

        // Store the connection
        activeConnections.set(userId, {
          socketId: socket.id,
          userId,
          userType: userType || 'user',
          isOnline: true,
          location: null
        });

        // Join user's private room
        socket.join(`user_${userId}`);
        
        // If driver, join driver-specific room
        if (user.role === 'driver') {
          socket.join('drivers');
          
          // Notify about driver going online
          io.emit('driver_online', { 
            driverId: user._id,
            name: user.name,
            timestamp: new Date()
          });
        }

        console.log(`User ${user.name} (${user._id}) connected`);

      } catch (error) {
        console.error('Authentication error:', error);
        socket.emit('authentication_error', { message: 'Authentication failed' });
      }
    });

    // Handle driver online/offline status
    socket.on('driver_online', async ({ driverId, isOnline }) => {
      try {
        const driver = await User.findById(driverId);
        if (!driver) {
          throw new Error('Driver not found');
        }

        currentUserId = driverId;
        
        // Update driver's online status
        if (isOnline) {
          activeConnections.set(driverId, {
            socketId: socket.id,
            userId: driverId,
            userType: 'driver',
            isOnline: true,
            lastSeen: new Date()
          });
          
          // Join driver-specific rooms
          socket.join(`driver_${driverId}`);
          socket.join('drivers');
          
          console.log(`Driver ${driver.name} (${driverId}) is now online`);
          
          // Notify other users that driver is online
          socket.broadcast.emit('driver_status_changed', {
            driverId,
            isOnline: true,
            name: driver.name,
            vehicle: driver.vehicleDetails,
            timestamp: new Date()
          });
        } else {
          // Mark as offline but keep the connection
          const existing = activeConnections.get(driverId);
          if (existing) {
            existing.isOnline = false;
            existing.lastSeen = new Date();
            activeConnections.set(driverId, existing);
            
            console.log(`Driver ${driver.name} (${driverId}) is now offline`);
            
            // Notify other users that driver is offline
            socket.broadcast.emit('driver_status_changed', {
              driverId,
              isOnline: false,
              name: driver.name,
              timestamp: new Date()
            });
          }
        }
      } catch (error) {
        console.error('Error updating driver status:', error);
        socket.emit('error', { message: 'Failed to update driver status' });
      }
    });

    // Handle driver location updates
    socket.on('update_location', async ({ userId, location }) => {
      try {
        const connection = activeConnections.get(userId);
        if (connection) {
          connection.location = location;
          connection.lastUpdated = new Date();
          activeConnections.set(userId, connection);
          
          // Notify that driver location was updated
          io.emit('driver_location_updated', {
            driverId: userId,
            location,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error updating location:', error);
      }
    });

    // Handle ride status updates
    socket.on('update_ride_status', async ({ bookingId, status, driverId }) => {
      try {
        const booking = await Booking.findById(bookingId).populate('user', 'name phone');
        if (!booking) {
          throw new Error('Booking not found');
        }

        // Update booking status
        booking.status = status;
        
        // Update timestamps based on status
        const now = new Date();
        if (status === 'accepted') {
          booking.acceptedAt = now;
        } else if (status === 'arrived') {
          booking.arrivedAt = now;
        } else if (status === 'started') {
          booking.startedAt = now;
        } else if (status === 'completed') {
          booking.completedAt = now;
        }

        await booking.save();

        // Notify relevant parties
        const bookingData = booking.toObject();
        
        // Notify user about status update
        io.to(`user_${booking.user._id}`).emit('ride_status_updated', {
          bookingId,
          status,
          booking: bookingData,
          timestamp: now
        });

        // If driver is involved, notify them as well
        if (driverId) {
          io.to(`user_${driverId}`).emit('ride_status_updated', {
            bookingId,
            status,
            booking: bookingData,
            timestamp: now
          });
        }

      } catch (error) {
        console.error('Error updating ride status:', error);
        socket.emit('error', { message: 'Failed to update ride status' });
      }
    });

    // Handle new ride requests to nearby drivers
    socket.on('find_nearby_drivers', async ({ bookingId, pickupLocation }) => {
      try {
        const booking = await Booking.findById(bookingId).populate('user', 'name phone');
        if (!booking) {
          throw new Error('Booking not found');
        }

        // Find all online drivers
        const onlineDrivers = Array.from(activeConnections.values())
          .filter(conn => conn.userType === 'driver' && conn.isOnline && conn.location);

        // In a real app, you'd filter by proximity here
        const nearbyDrivers = onlineDrivers;

        // Notify nearby drivers about the new ride request
        nearbyDrivers.forEach(driver => {
          io.to(driver.socketId).emit('new_ride_request', {
            bookingId: booking._id,
            customer: {
              id: booking.user._id,
              name: booking.user.name,
              phone: booking.user.phone
            },
            pickupLocation: booking.pickupLocation,
            dropoffLocation: booking.dropoffLocation,
            fare: booking.fare,
            distance: booking.distance,
            createdAt: booking.createdAt,
            expiresIn: 300 // 5 minutes to accept
          });
        });

      } catch (error) {
        console.error('Error finding nearby drivers:', error);
        socket.emit('error', { message: 'Failed to find nearby drivers' });
      }
    });

    // Handle driver response to ride request
    socket.on('driver_ride_response', async ({ bookingId, driverId, accepted }) => {
      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          throw new Error('Booking not found');
        }

        const driver = await User.findById(driverId);
        if (!driver) {
          throw new Error('Driver not found');
        }

        if (accepted) {
          // Check if ride is still available
          if (booking.status !== 'pending') {
            socket.emit('ride_unavailable', { 
              bookingId,
              message: 'This ride is no longer available' 
            });
            return;
          }

          // Assign driver to booking
          booking.driver = driverId;
          booking.status = 'driver_assigned';
          booking.acceptedAt = new Date();
          await booking.save();

          // Notify user that driver is on the way
          io.to(`user_${booking.user}`).emit('driver_assigned', {
            bookingId,
            driver: {
              id: driver._id,
              name: driver.name,
              phone: driver.phone,
              vehicle: driver.vehicle
            },
            estimatedArrival: '5 min', // In a real app, calculate ETA
            timestamp: new Date()
          });

          // Notify other drivers that this ride is taken
          io.to('drivers').emit('ride_taken', { bookingId });

        } else {
          // Driver rejected the ride
          // In a real app, you might want to find another driver
          socket.emit('ride_rejected', { bookingId });
        }

      } catch (error) {
        console.error('Error handling driver response:', error);
        socket.emit('error', { message: 'Failed to process driver response' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      // Mark driver as offline if they disconnect
      if (currentUserId) {
        const connection = activeConnections.get(currentUserId);
        if (connection) {
          connection.isOnline = false;
          connection.lastSeen = new Date();
          console.log(`Marked driver ${currentUserId} as offline due to disconnection`);
          
          // Notify other users
          io.emit('driver_status_changed', {
            driverId: currentUserId,
            isOnline: false,
            timestamp: new Date()
          });
        }
      }
    });
  });

  return io;
};

// Helper function to get online drivers
const getOnlineDrivers = () => {
  return Array.from(activeConnections.entries())
    .filter(([_, connection]) => connection.userType === 'driver' && connection.isOnline)
    .map(([userId, data]) => ({
      userId,
      socketId: data.socketId,
      location: data.location,
      lastUpdated: data.lastUpdated
    }));
};

// Helper function to get user's socket connection
const getUserSocket = (userId) => {
  const connection = activeConnections.get(userId);
  return connection ? {
    socketId: connection.socketId,
    userId: connection.userId,
    userType: connection.userType,
    isOnline: connection.isOnline,
    location: connection.location
  } : null;
};

// Get the io instance
const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized');
  }
  return ioInstance;
};

module.exports = {
  initSocket,
  getOnlineDrivers,
  getUserSocket,
  getIO
};
