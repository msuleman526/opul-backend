const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a Stripe Checkout Session for upfront payment
 */
async function createStripeCheckoutSession(amount, currency, description, successUrl, cancelUrl) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: 'Opul Ride Service',
              description: description,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes from now
      metadata: {
        description: description,
        service: 'opul_ride'
      },
      payment_intent_data: {
        metadata: {
          description: description,
          service: 'opul_ride'
        }
      }
    });

    return {
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url,
      sessionData: session
    };
  } catch (error) {
    console.error('Stripe Checkout Session creation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a Payment Intent for final payment (driver receives money)
 */
async function createPaymentIntent(amount, currency, description, metadata = {}) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      description: description,
      metadata: {
        ...metadata,
        service: 'opul_ride'
      },
      capture_method: 'manual' // Manual capture for final payments
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      paymentIntent
    };
  } catch (error) {
    console.error('Stripe Payment Intent creation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Capture a Payment Intent
 */
async function capturePaymentIntent(paymentIntentId, amountToCapture = null) {
  try {
    const captureOptions = {};
    if (amountToCapture) {
      captureOptions.amount_to_capture = Math.round(amountToCapture * 100);
    }

    const paymentIntent = await stripe.paymentIntents.capture(
      paymentIntentId,
      captureOptions
    );

    return {
      success: true,
      paymentIntent,
      amount: paymentIntent.amount_received / 100,
      status: paymentIntent.status
    };
  } catch (error) {
    console.error('Stripe Payment Intent capture error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Retrieve a Checkout Session
 */
async function retrieveCheckoutSession(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent']
    });

    return {
      success: true,
      session,
      paymentStatus: session.payment_status,
      paymentIntentId: session.payment_intent?.id
    };
  } catch (error) {
    console.error('Stripe Session retrieval error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a refund
 */
async function createRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
  try {
    const refundData = {
      payment_intent: paymentIntentId,
      reason: reason
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100);
    }

    const refund = await stripe.refunds.create(refundData);

    return {
      success: true,
      refund,
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status
    };
  } catch (error) {
    console.error('Stripe refund error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Transfer money to driver (requires Stripe Connect)
 */
async function transferToDriver(amount, driverStripeAccountId, description) {
  try {
    // Calculate Opul's fee (10%)
    const opulFee = amount * 0.10;
    const driverAmount = amount - opulFee;

    const transfer = await stripe.transfers.create({
      amount: Math.round(driverAmount * 100),
      currency: 'usd',
      destination: driverStripeAccountId,
      description: description,
      metadata: {
        opul_fee: opulFee.toFixed(2),
        driver_amount: driverAmount.toFixed(2),
        service: 'opul_ride'
      }
    });

    return {
      success: true,
      transfer,
      transferId: transfer.id,
      driverAmount: driverAmount,
      opulFee: opulFee
    };
  } catch (error) {
    console.error('Stripe transfer error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate fees breakdown
 */
function calculateFees(amount) {
  const opulFeePercentage = parseFloat(process.env.OPUL_FEE_PERCENTAGE) || 10;
  const opulFee = amount * (opulFeePercentage / 100);
  const driverEarnings = amount - opulFee;

  return {
    totalAmount: amount,
    opulFee: parseFloat(opulFee.toFixed(2)),
    driverEarnings: parseFloat(driverEarnings.toFixed(2)),
    opulFeePercentage
  };
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(payload, signature) {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return { success: true, event };
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  stripe,
  createStripeCheckoutSession,
  createPaymentIntent,
  capturePaymentIntent,
  retrieveCheckoutSession,
  createRefund,
  transferToDriver,
  calculateFees,
  verifyWebhookSignature
};
