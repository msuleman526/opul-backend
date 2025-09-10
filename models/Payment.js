const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  rideRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RideRequest',
    required: function() {
      // Only require rideRequest for ride-related payments
      return ['upfront_fee', 'final_payment', 'driver_payment'].includes(this.paymentType);
    }
  },
  paymentType: {
    type: String,
    enum: ['upfront_fee', 'final_payment', 'service_fee', 'driver_payment'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentMethod: {
    type: String,
    enum: ['paypal', 'stripe', 'credits'],
    required: true
  },
  paymentIntentId: String, // Stripe Payment Intent ID
  paypalOrderId: String, // PayPal Order ID
  stripeSessionId: String, // Stripe Checkout Session ID
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  opulFee: {
    type: Number,
    default: 0
  },
  driverEarnings: {
    type: Number,
    default: 0
  },
  metadata: {
    clientInfo: {
      name: String,
      email: String,
      phone: String
    },
    driverInfo: {
      name: String,
      email: String,
      phone: String
    }
  },
  refundReason: String,
  processedAt: Date,
  failureReason: String
}, {
  timestamps: true
});

// Index for efficient querying
paymentSchema.index({ rideRequest: 1, paymentType: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ paymentId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
