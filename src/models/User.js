const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  phone: {
    type: String,
    required: false
  },
  // Keep the legacy role field for backward compatibility
  role: {
    type: String,
    enum: ['user', 'admin', 'driver'],
    default: 'user'
  },
  // New roles array to support multiple roles
  roles: {
    type: [String],
    default: ['user'],
    enum: ['user', 'admin', 'driver']
  },
  isDriver: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  otp: {
    code: String,
    expiresAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add a pre-save hook to sync the legacy role field with the roles array
userSchema.pre('save', function(next) {
  // If this is a new user or the role field was modified
  if (this.isNew || this.isModified('role')) {
    if (!this.roles.includes(this.role)) {
      this.roles = [...new Set([...this.roles, this.role])];
    }
  }
  
  // If roles were modified, update isDriver
  if (this.isModified('roles')) {
    this.isDriver = this.roles.includes('driver');
    // Update the legacy role field to the highest privilege role
    if (this.roles.includes('admin')) {
      this.role = 'admin';
    } else if (this.roles.includes('driver')) {
      this.role = 'driver';
    } else {
      this.role = 'user';
    }
  }
  
  next();
});

// Add a static method to update existing users
userSchema.statics.migrateRoles = async function() {
  try {
    const users = await this.find({});
    const updates = users.map(user => {
      const roles = ['user'];
      if (user.role === 'admin') roles.push('admin');
      if (user.role === 'driver' || user.isDriver) roles.push('driver');
      
      return this.updateOne(
        { _id: user._id },
        { 
          $set: { 
            roles: [...new Set(roles)],
            isDriver: roles.includes('driver')
          }
        }
      );
    });
    
    await Promise.all(updates);
    console.log(`Migrated ${updates.length} users to use roles array`);
  } catch (error) {
    console.error('Error migrating user roles:', error);
    throw error;
  }
};

module.exports = mongoose.model('User', userSchema);