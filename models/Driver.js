const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  vehicleType: {
    type: String,
    required: true,
    enum: ['sedan', 'suv', 'truck', 'motorcycle', 'other']
  },
  vehicleModel: {
    type: String,
    required: true
  },
  vehiclePlate: {
    type: String,
    required: true,
    unique: true
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 1,
    max: 5
  },
  totalRides: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  profilePicture: String,
  isVerified: {
    type: Boolean,
    default: false
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for geospatial queries
driverSchema.index({ "location.latitude": 1, "location.longitude": 1 });

module.exports = mongoose.model('Driver', driverSchema);
