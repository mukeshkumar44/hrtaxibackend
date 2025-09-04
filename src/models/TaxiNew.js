const mongoose = require('mongoose');

const taxiSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false 
  },
  driverName: { 
    type: String, 
    required: [true, 'Driver name is required'],
    trim: true
  },
  vehicleNumber: { 
    type: String, 
    required: [true, 'Vehicle number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  vehicleModel: { 
    type: String, 
    required: [true, 'Vehicle model is required'],
    trim: true
  },
  licenseNumber: { 
    type: String, 
    required: [true, 'License number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  phoneNumber: { 
    type: String, 
    required: [true, 'Phone number is required'],
    match: [/^\d{10}$/, 'Please provide a valid 10-digit phone number']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please provide a valid email']
  },
  address: { 
    type: String, 
    required: [true, 'Address is required'],
    trim: true
  },
  vehicleType: { 
    type: String, 
    enum: {
      values: ['sedan', 'suv', 'hatchback', 'luxury'],
      message: 'Invalid vehicle type'
    },
    default: 'sedan' 
  },
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Owner reference is required'] 
  },
  status: { 
    type: String, 
    enum: {
      values: ['pending', 'approved', 'rejected'],
      message: 'Invalid status'
    },
    default: 'pending' 
  },
  rejectionReason: {
    type: String,
    trim: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  strictPopulate: false 
});

// Indexes for better query performance
taxiSchema.index({ vehicleNumber: 1 });
taxiSchema.index({ licenseNumber: 1 });
taxiSchema.index({ owner: 1 });
taxiSchema.index({ status: 1 });

// Virtual for getting the document URLs
// taxiSchema.virtual('vehiclePhoto').get(function() {
//   const doc = this.documents?.find(d => d.type === 'vehicle_photo');
//   return doc ? doc.url : null;
// });

// Pre-save hook to ensure vehicle photo is always present
// taxiSchema.pre('save', function(next) {
//   if (this.isNew && !this.documents.some(doc => doc.type === 'vehicle_photo')) {
//     throw new Error('Vehicle photo is required');
//   }
//   next();
// });

// Static method to get taxis by status
taxiSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

// Instance method to approve taxi
taxiSchema.methods.approve = function() {
  this.status = 'approved';
  this.rejectionReason = undefined;
  return this.save();
};

// Instance method to reject taxi
taxiSchema.methods.reject = function(reason) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  return this.save();
};

const TaxiNew = mongoose.model('TaxiNew', taxiSchema);
module.exports = TaxiNew;