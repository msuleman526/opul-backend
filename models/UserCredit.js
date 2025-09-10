const mongoose = require('mongoose');

const userCreditSchema = new mongoose.Schema({
  clientEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  clientPhone: {
    type: String,
    required: true
  },
  totalCredits: {
    type: Number,
    default: 0,
    min: 0
  },
  creditHistory: [{
    amount: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['credit', 'debit', 'refund'],
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    rideRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RideRequest'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
userCreditSchema.index({ clientEmail: 1 });
userCreditSchema.index({ clientPhone: 1 });

// Pre-save middleware to update lastUpdated
userCreditSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('UserCredit', userCreditSchema);
