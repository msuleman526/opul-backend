const mongoose = require('mongoose');

const rideRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true
  },
  clientInfo: {
    name: String,
    phone: String,
    email: String
  },
  pickupLocation: {
    address: {
      type: String,
      required: true
    },
    latitude: Number,
    longitude: Number
  },
  duration: {
    type: Number,
    required: true,
    min: 1,
    max: 24 // Maximum 24 hours
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'matched', 'in_progress', 'completed', 'cancelled', 'expired'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'refunded', 'failed'],
    default: 'unpaid'
  },
  upfrontFee: {
    type: Number,
    required: true,
    min: 0
  },
  paymentIntentId: String,
  paypalOrderId: String,
  stripeSessionId: String,
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  driverOffers: [{
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver'
    },
    hourlyRate: Number,
    offeredAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    }
  }],
  rideDetails: {
    startTime: Date,
    endTime: Date,
    actualDuration: Number,
    finalCost: Number,
    opulFee: Number,
    driverEarnings: Number
  },
  driverSelectionTimer: {
    startTime: Date,
    endTime: Date,
    duration: {
      type: Number,
      default: 3 // 3 minutes in minutes
    },
    isActive: {
      type: Boolean,
      default: false
    },
    hasExpired: {
      type: Boolean,
      default: false
    }
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }
  },
  chatMessages: [{
    sender: {
      type: String,
      enum: ['client', 'driver'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    language: {
      type: String,
      enum: ['spanish', 'english'],
      default: 'spanish'
    }
  }]
}, {
  timestamps: true
});

// Index for efficient querying
rideRequestSchema.index({ status: 1, expiresAt: 1 });
rideRequestSchema.index({ 'driver': 1, status: 1 });
rideRequestSchema.index({ requestId: 1 });

// Pre-save middleware to set expiration time
rideRequestSchema.pre('save', function(next) {
  if (this.isNew && this.status === 'pending') {
    // Set expiration to 5 minutes from now
    this.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('RideRequest', rideRequestSchema);
