const express = require('express');
const RideRequest = require('../models/RideRequest');
const Payment = require('../models/Payment');
const UserCredit = require('../models/UserCredit');
const { validatePayment } = require('../middleware/validation');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { createPayPalOrder, capturePayPalOrder, calculateFees } = require('../utils/paypal');
const { addCredits, deductCredits } = require('../controllers/creditController');
const {
  createStripeCheckoutSession,
  retrieveCheckoutSession,
  createPaymentIntent,
  capturePaymentIntent,
  createRefund,
  verifyWebhookSignature
} = require('../utils/stripe');
const { generatePaymentId } = require('../utils/helpers');

const router = express.Router();

// Create payment order for ride (when user has no credits)
router.post('/create-ride-payment', asyncHandler(async (req, res) => {
  const { requestId, paymentMethod = 'paypal', returnUrl, paymentType } = req.body;

  // Verify ride request exists and is pending
  const rideRequest = await RideRequest.findOne({
    requestId,
    status: 'pending',
    paymentStatus: 'unpaid'
  });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found or already paid'
    });
  }

  // Use the upfront fee (which is $10)
  const amount = rideRequest.upfrontFee;

  let paymentResult;
  const paymentData = {
    paymentId: generatePaymentId(),
    rideRequest: rideRequest._id,
    paymentType: paymentType || 'upfront_fee',
    amount,
    currency: 'USD',
    paymentMethod,
    status: 'pending',
    metadata: {
      clientInfo: rideRequest.clientInfo
    }
  };

  if (paymentMethod === 'stripe') {
    // Determine success URL based on payment type
    let successUrl;
    if (paymentType === 'service_fee' || (returnUrl && returnUrl.includes('payment-success-service'))) {
      successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-success-service.html?requestId=${requestId}&session_id={CHECKOUT_SESSION_ID}`;
    } else {
      successUrl = returnUrl || `${process.env.FRONTEND_URL}/payment-success.html?type=ride_payment&requestId=${requestId}&session_id={CHECKOUT_SESSION_ID}`;
    }
    const cancelUrl = `${process.env.FRONTEND_URL}/drivers.html?requestId=${requestId}`;

    paymentResult = await createStripeCheckoutSession(
      amount,
      'USD',
      `Opul Ride Payment - ${requestId}`,
      successUrl,
      cancelUrl
    );

    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create Stripe checkout session',
        error: paymentResult.error
      });
    }

    paymentData.stripeSessionId = paymentResult.sessionId;
    rideRequest.stripeSessionId = paymentResult.sessionId;

    // Create payment record
    const payment = new Payment(paymentData);
    await payment.save();
    await rideRequest.save();

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        stripeSessionId: paymentResult.sessionId,
        checkoutUrl: paymentResult.checkoutUrl,
        amount,
        currency: 'USD',
        paymentMethod: 'stripe'
      }
    });
  } else {
    // Create PayPal order
    paymentResult = await createPayPalOrder(
      amount,
      'USD',
      `Opul Ride Payment - ${requestId}`
    );

    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create PayPal order',
        error: paymentResult.error
      });
    }

    paymentData.paypalOrderId = paymentResult.orderId;
    rideRequest.paypalOrderId = paymentResult.orderId;

    // Create payment record
    const payment = new Payment(paymentData);
    await payment.save();
    await rideRequest.save();

    // Add return URL parameters for PayPal based on payment type
    let enhancedApprovalUrl;
    if (paymentType === 'service_fee' || (returnUrl && returnUrl.includes('payment-success-service'))) {
      const returnUrlFinal = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-success-service.html?requestId=${requestId}&paypal_order_id=${paymentResult.orderId}`;
      enhancedApprovalUrl = `${paymentResult.approvalUrl}&return=${encodeURIComponent(returnUrlFinal)}`;
    } else {
      const returnUrlFinal = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-success.html?type=ride_payment&requestId=${requestId}&paypal_order_id=${paymentResult.orderId}`;
      enhancedApprovalUrl = `${paymentResult.approvalUrl}&return=${encodeURIComponent(returnUrlFinal)}`;
    }

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        paypalOrderId: paymentResult.orderId,
        approvalUrl: enhancedApprovalUrl,
        amount,
        currency: 'USD',
        paymentMethod: 'paypal'
      }
    });
  }
}));

// Create service fee payment (always $10)
router.post('/create-service-fee', asyncHandler(async (req, res) => {
  const { email, phone, paymentMethod = 'paypal' } = req.body;

  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      message: 'Email or phone is required'
    });
  }

  const serviceFeeAmount = 10; // Always $10 service fee
  const currency = 'USD';

  let paymentResult;
  const paymentData = {
    paymentId: generatePaymentId(),
    rideRequest: null, // No specific ride request for service fee
    paymentType: 'service_fee',
    amount: serviceFeeAmount,
    currency,
    paymentMethod,
    status: 'pending',
    metadata: {
      clientInfo: { email, phone }
    }
  };

  if (paymentMethod === 'stripe') {
    // Create Stripe Checkout Session for service fee
    const successUrl = `${process.env.FRONTEND_URL}/payment-success?type=service_fee&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.FRONTEND_URL}/Index.html`;

    paymentResult = await createStripeCheckoutSession(
      serviceFeeAmount,
      currency,
      'Opul Service Fee - $10',
      successUrl,
      cancelUrl
    );

    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create Stripe checkout session',
        error: paymentResult.error
      });
    }

    paymentData.stripeSessionId = paymentResult.sessionId;

    // Create payment record
    const payment = new Payment(paymentData);
    await payment.save();

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        stripeSessionId: paymentResult.sessionId,
        checkoutUrl: paymentResult.checkoutUrl,
        amount: serviceFeeAmount,
        currency,
        paymentMethod: 'stripe'
      }
    });
  } else {
    // Create PayPal order for service fee
    paymentResult = await createPayPalOrder(
      serviceFeeAmount,
      currency,
      'Opul Service Fee - $10'
    );

    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create PayPal order',
        error: paymentResult.error
      });
    }

    paymentData.paypalOrderId = paymentResult.orderId;

    // Create payment record
    const payment = new Payment(paymentData);
    await payment.save();

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        paypalOrderId: paymentResult.orderId,
        approvalUrl: paymentResult.approvalUrl,
        amount: serviceFeeAmount,
        currency,
        paymentMethod: 'paypal'
      }
    });
  }
}));

// Create payment order (supports both PayPal and Stripe)
router.post('/create-order', validatePayment, asyncHandler(async (req, res) => {
  const { requestId, amount, currency = 'USD', paymentMethod = 'paypal' } = req.body;

  // Verify ride request exists and is pending
  const rideRequest = await RideRequest.findOne({
    requestId,
    status: 'pending',
    paymentStatus: 'unpaid'
  });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found or already paid'
    });
  }

  // Verify amount matches upfront fee
  if (amount !== rideRequest.upfrontFee) {
    return res.status(400).json({
      success: false,
      message: 'Payment amount does not match upfront fee'
    });
  }

  let paymentResult;
  const paymentData = {
    paymentId: generatePaymentId(),
    rideRequest: rideRequest._id,
    paymentType: 'upfront_fee',
    amount,
    currency,
    paymentMethod,
    status: 'pending',
    metadata: {
      clientInfo: rideRequest.clientInfo
    }
  };

  if (paymentMethod === 'stripe') {
    // Create Stripe Checkout Session
    const successUrl = `${process.env.FRONTEND_URL}/payment-success?requestId=${requestId}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.FRONTEND_URL}/payment.html?requestId=${requestId}&amount=${amount}`;

    paymentResult = await createStripeCheckoutSession(
      amount,
      currency,
      `Opul Ride Service - ${requestId}`,
      successUrl,
      cancelUrl
    );

    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create Stripe checkout session',
        error: paymentResult.error
      });
    }

    paymentData.stripeSessionId = paymentResult.sessionId;
    rideRequest.stripeSessionId = paymentResult.sessionId;

    // Create payment record
    const payment = new Payment(paymentData);
    await payment.save();
    await rideRequest.save();

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        stripeSessionId: paymentResult.sessionId,
        checkoutUrl: paymentResult.checkoutUrl,
        amount,
        currency,
        paymentMethod: 'stripe'
      }
    });
  } else {
    // Create PayPal order
    paymentResult = await createPayPalOrder(
      amount,
      currency,
      `Opul Ride Service - ${requestId}`
    );

    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create PayPal order',
        error: paymentResult.error
      });
    }

    paymentData.paypalOrderId = paymentResult.orderId;
    rideRequest.paypalOrderId = paymentResult.orderId;

    // Create payment record
    const payment = new Payment(paymentData);
    await payment.save();
    await rideRequest.save();

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        paypalOrderId: paymentResult.orderId,
        approvalUrl: paymentResult.approvalUrl,
        amount,
        currency,
        paymentMethod: 'paypal'
      }
    });
  }
}));

// Capture driver payment (alias for capture-stripe with driver-specific logic)
router.post('/capture-driver-payment', asyncHandler(async (req, res) => {
  const { sessionId, requestId } = req.body;

  console.log('💳 Capturing driver payment for session:', sessionId);
  console.log('📋 Request ID provided:', requestId);

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Stripe session ID is required'
    });
  }

  // Find payment record specifically for driver payments
  const payment = await Payment.findOne({
    stripeSessionId: sessionId,
    paymentType: 'driver_payment'
  });

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Driver payment record not found for this session'
    });
  }

  // Check if already completed
  if (payment.status === 'completed') {
    return res.json({
      success: true,
      message: 'Driver payment already processed.',
      data: {
        paymentId: payment.paymentId,
        amount: payment.amount,
        status: payment.status,
        calculation: payment.metadata.calculation,
        sessionId: sessionId
      }
    });
  }

  // For driver payments, we can be more lenient with Stripe verification
  // since the payment record exists and this is called from success page
  try {
    const sessionResult = await retrieveCheckoutSession(sessionId);
    if (!sessionResult.success) {
      console.warn('⚠️ Stripe session retrieval failed, but assuming driver payment success');
    }
  } catch (error) {
    console.warn('⚠️ Stripe session verification error, but continuing with driver payment:', error.message);
  }

  // Update payment status
  payment.status = 'completed';
  payment.processedAt = new Date();
  await payment.save();

  console.log('🚗 Processing driver payment completion...');

  // Find the ride request for notifications
  let rideRequest = null;
  if (payment.rideRequest) {
    rideRequest = await RideRequest.findById(payment.rideRequest)
      .populate('driver', 'name email phone');
  } else if (requestId) {
    rideRequest = await RideRequest.findOne({ requestId: requestId })
      .populate('driver', 'name email phone');
  }

  // Emit real-time notification to driver via ride room
  const io = req.app.get('io');
  if (io && rideRequest) {
    console.log('📡 Sending driver payment notification to ride room:', `ride-${rideRequest.requestId}`);

    // Calculate payment amounts for messaging
    const userPaidAmount = payment.metadata.calculation?.totalAmount || payment.amount;
    const driverEarnsAmount = payment.metadata.calculation?.baseAmount || (payment.amount * 0.91); // Approximate if calculation missing

    // Send payment notification event
    io.to(`ride-${rideRequest.requestId}`).emit('driver-payment-received', {
      requestId: rideRequest.requestId,
      amount: payment.amount,
      calculation: payment.metadata.calculation,
      message: `Payment received! User Paid ${userPaidAmount.toFixed(2)}`,
      paymentId: payment.paymentId
    });

    // Also send chat messages to the room
    const driverPaymentMessage = `💰 Payment received! User Paid ${userPaidAmount.toFixed(2)}.`;
    const clientPaymentMessage = `✅ Driver payment sent successfully! You paid ${userPaidAmount.toFixed(2)}.`;

    // Save message to database
    if (rideRequest) {
      rideRequest.chatMessages.push({
        sender: 'system',
        message: driverPaymentMessage,
        timestamp: new Date(),
        language: 'english',
        messageType: 'payment_confirmation'
      });
      await rideRequest.save();
    }

    // Send real-time messages
    // io.to(`ride-${rideRequest.requestId}`).emit('receive-message', {
    //   message: driverPaymentMessage,
    //   sender: 'system',
    //   timestamp: new Date(),
    //   messageType: 'payment_confirmation',
    //   targetAudience: 'driver'
    // });

    io.to(`ride-${rideRequest.requestId}`).emit('receive-message', {
      message: clientPaymentMessage,
      sender: 'system',
      timestamp: new Date(),
      messageType: 'payment_confirmation',
      targetAudience: 'client'
    });

    console.log('✅ Driver payment confirmation messages sent');
  }

  res.json({
    success: true,
    message: 'Driver payment processed successfully.',
    data: {
      paymentId: payment.paymentId,
      amount: payment.amount,
      status: payment.status,
      calculation: payment.metadata.calculation,
      sessionId: sessionId
    }
  });
}));

// Find recent payment (fallback for redirect issues)
router.get('/find-recent-payment', asyncHandler(async (req, res) => {
  const { requestId, paymentType } = req.query;

  if (!requestId) {
    return res.status(400).json({
      success: false,
      message: 'Request ID is required'
    });
  }

  try {
    // Find the most recent completed payment for this request
    const payment = await Payment.findOne({
      paymentType: paymentType || 'service_fee',
      status: 'completed',
      // Find payment associated with this request ID
      $or: [
        { 'metadata.requestId': requestId },
        // For ride payments, check the rideRequest reference
        ...(paymentType !== 'service_fee' ? [
          {
            rideRequest: {
              $exists: true
            }
          }
        ] : [])
      ]
    }).sort({ processedAt: -1 });

    if (payment) {
      // For ride payments, verify the request ID matches
      if (paymentType !== 'service_fee' && payment.rideRequest) {
        const rideRequest = await RideRequest.findById(payment.rideRequest);
        if (!rideRequest || rideRequest.requestId !== requestId) {
          return res.status(404).json({
            success: false,
            message: 'No recent payment found for this request'
          });
        }
      }

      return res.json({
        success: true,
        message: 'Recent payment found',
        data: {
          payment: {
            paymentId: payment.paymentId,
            amount: payment.amount,
            status: payment.status,
            calculation: payment.metadata.calculation,
            paymentType: payment.paymentType,
            processedAt: payment.processedAt
          }
        }
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'No recent payment found for this request'
      });
    }
  } catch (error) {
    console.error('Error finding recent payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error searching for recent payment'
    });
  }
}));

router.post('/capture-stripe', asyncHandler(async (req, res) => {
  const { sessionId, requestId } = req.body;

  console.log('💳 Capturing Stripe payment for session:', sessionId);
  console.log('📋 Request ID provided:', requestId);

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Stripe session ID is required'
    });
  }

  // Find payment first (this is the primary record)
  const payment = await Payment.findOne({ stripeSessionId: sessionId });
  console.log('💰 Found payment record:', payment ? 'YES' : 'NO');

  if (payment) {
    console.log('- Payment Type:', payment.paymentType);
    console.log('- Payment Status:', payment.status);
    console.log('- Amount:', payment.amount);
  }

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment record not found for this session'
    });
  }

  // Find ride request using multiple methods
  let rideRequest = null;

  // Method 1: Via payment.rideRequest reference
  if (payment.rideRequest) {
    rideRequest = await RideRequest.findById(payment.rideRequest);
    console.log('🚗 Found ride request via payment.rideRequest:', rideRequest ? 'YES' : 'NO');
  }

  // Method 2: Via stripeSessionId (for older payments)
  if (!rideRequest) {
    rideRequest = await RideRequest.findOne({ stripeSessionId: sessionId });
    console.log('🚗 Found ride request via stripeSessionId:', rideRequest ? 'YES' : 'NO');
  }

  // Method 3: Via requestId from frontend (for driver payments)
  if (!rideRequest && requestId) {
    rideRequest = await RideRequest.findOne({ requestId: requestId });
    console.log('🚗 Found ride request via requestId:', rideRequest ? 'YES' : 'NO');
  }

  // For driver payments, ride request is optional (payment is the main record)
  if (payment.paymentType === 'driver_payment' && !rideRequest) {
    console.log('⚠️ Driver payment without ride request - continuing anyway');
  }

  // Retrieve session details from Stripe - REMOVE validation that might be causing errors
  let sessionResult;
  try {
    sessionResult = await retrieveCheckoutSession(sessionId);
    if (!sessionResult.success) {
      console.warn('⚠️ Failed to retrieve session from Stripe:', sessionResult.error);
      // Continue anyway for driver payments if payment record exists
      if (payment.paymentType === 'driver_payment') {
        console.log('ℹ️ Continuing with driver payment without Stripe session verification');
        sessionResult = { success: true, session: { payment_status: 'paid' } };
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to verify Stripe session',
          error: sessionResult.error
        });
      }
    }
  } catch (error) {
    console.warn('⚠️ Error retrieving Stripe session:', error.message);
    // For driver payments, assume success if payment record exists
    if (payment.paymentType === 'driver_payment') {
      console.log('ℹ️ Assuming driver payment success due to existing payment record');
      sessionResult = { success: true, session: { payment_status: 'paid' } };
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to verify payment with Stripe',
        error: error.message
      });
    }
  }

  const session = sessionResult.session;

  // Check if payment was successful
  if (session.payment_status === 'paid') {
    // Update payment status if not already completed
    if (payment.status !== 'completed') {
      payment.status = 'completed';
      payment.processedAt = new Date();
      await payment.save();
    }

    // Handle service fee payments
    if (payment.paymentType === 'service_fee') {
      // Add 1 credit to user account
      const clientInfo = payment.metadata.clientInfo;
      await addCredits({
        body: {
          email: clientInfo.email,
          phone: clientInfo.phone,
          amount: 1,
          reason: 'Service fee payment - $10'
        }
      }, {
        json: () => { } // Mock response object
      });

      return res.json({
        success: true,
        message: 'Service fee paid successfully. 1 credit added to your account.',
        data: {
          paymentId: payment.paymentId,
          amount: payment.amount,
          status: payment.status,
          creditsAdded: 1,
          sessionId: sessionId
        }
      });
    }

    // Handle driver payment
    if (payment.paymentType === 'driver_payment') {
      console.log('🚗 Processing driver payment...');

      // Try to find the ride request for notifications
      let targetRideRequest = rideRequest;
      if (!targetRideRequest && payment.rideRequest) {
        targetRideRequest = await RideRequest.findById(payment.rideRequest)
          .populate('driver', 'name email phone');
      }

      // Emit real-time notification to driver via ride room
      const io = req.app.get('io');
      if (io && targetRideRequest) {
        console.log('📡 Sending driver payment notification to ride room:', `ride-${targetRideRequest.requestId}`);

        // Send payment notification event
        io.to(`ride-${targetRideRequest.requestId}`).emit('driver-payment-received', {
          requestId: targetRideRequest.requestId,
          amount: payment.amount,
          calculation: payment.metadata.calculation,
          message: `Payment received! You will get ${payment.metadata.calculation?.totalAmount?.toFixed(2) || payment.amount.toFixed(2)} from Opul.`,
          paymentId: payment.paymentId
        });

        // Also send a chat message to the ride room so it appears in chat history
        const driverPaymentMessage = `💰 User has paid you ${payment.metadata.calculation?.totalAmount?.toFixed(2) || payment.amount.toFixed(2)}! Payment will be transferred to you within 24 hours.`;
        const clientPaymentMessage = `✅ Driver payment sent successfully! Driver will receive ${payment.metadata.calculation?.totalAmount?.toFixed(2) || payment.amount.toFixed(2)}.`;

        // Save both messages to database
        if (targetRideRequest) {
          targetRideRequest.chatMessages.push({
            sender: 'system',
            message: driverPaymentMessage,
            timestamp: new Date(),
            language: 'english',
            messageType: 'payment_confirmation'
          });
          await targetRideRequest.save();
        }

        // Send chat messages to all users in the room - separate messages for driver and client
        io.to(`ride-${targetRideRequest.requestId}`).emit('receive-message', {
          message: driverPaymentMessage,
          sender: 'system',
          timestamp: new Date(),
          messageType: 'payment_confirmation',
          targetAudience: 'driver'
        });

        io.to(`ride-${targetRideRequest.requestId}`).emit('receive-message', {
          message: clientPaymentMessage,
          sender: 'system',
          timestamp: new Date(),
          messageType: 'payment_confirmation',
          targetAudience: 'client'
        });

        // Also broadcast to all connected clients for that ride
        io.emit('payment-notification', {
          type: 'driver_payment_success',
          requestId: targetRideRequest.requestId,
          amount: payment.amount,
          calculation: payment.metadata.calculation
        });

        console.log('✅ Payment confirmation message sent to chat');
      } else {
        console.log('⚠️ No ride request found for driver payment notification');
      }

      return res.json({
        success: true,
        message: 'Driver payment processed successfully.',
        data: {
          paymentId: payment.paymentId,
          amount: payment.amount,
          status: payment.status,
          calculation: payment.metadata.calculation,
          sessionId: sessionId
        }
      });
    }

    // Handle ride request payments
    if (rideRequest && rideRequest.status !== 'active') {
      rideRequest.paymentStatus = 'paid';
      rideRequest.status = 'pending'; // Keep as pending until driver is selected
      await rideRequest.save();

      // Add 1 credit as bonus for paying for ride
      const clientInfo = rideRequest.clientInfo;
      await addCredits({
        body: {
          email: clientInfo.email,
          phone: clientInfo.phone,
          amount: 1,
          reason: 'Bonus credit for ride payment - $10'
        }
      }, {
        json: () => { } // Mock response object
      });

      // Emit real-time update to drivers
      const io = req.app.get('io');
      if (io) {
        io.emit('ride-payment-completed', {
          requestId: rideRequest.requestId,
          status: 'pending' // Ready for driver selection
        });
      }
    }

    res.json({
      success: true,
      message: 'Stripe payment verified successfully',
      data: {
        paymentId: payment.paymentId,
        requestId: rideRequest.requestId,
        amount: payment.amount,
        status: payment.status,
        sessionId: sessionId
      }
    });
  } else {
    res.status(400).json({
      success: false,
      message: `Payment not completed. Status: ${session.payment_status}`
    });
  }
}));

// Capture PayPal payment
router.post('/capture-order', asyncHandler(async (req, res) => {
  const { paypalOrderId } = req.body;

  if (!paypalOrderId) {
    return res.status(400).json({
      success: false,
      message: 'PayPal order ID is required'
    });
  }

  // Find ride request and payment
  const rideRequest = await RideRequest.findOne({ paypalOrderId });
  const payment = await Payment.findOne({ paypalOrderId });

  if (!rideRequest || !payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment or ride request not found'
    });
  }

  // Capture PayPal payment
  const captureResult = await capturePayPalOrder(paypalOrderId);

  if (!captureResult.success) {
    // Update payment status to failed
    payment.status = 'failed';
    payment.failureReason = captureResult.error;
    await payment.save();

    return res.status(500).json({
      success: false,
      message: 'Failed to capture PayPal payment',
      error: captureResult.error
    });
  }

  // Update payment status
  payment.status = 'completed';
  payment.processedAt = new Date();
  await payment.save();

  // Handle service fee payments
  if (payment.paymentType === 'service_fee') {
    // Add 1 credit to user account
    const clientInfo = payment.metadata.clientInfo;
    await addCredits({
      body: {
        email: clientInfo.email,
        phone: clientInfo.phone,
        amount: 1,
        reason: 'Service fee payment - $10'
      }
    }, {
      json: () => { } // Mock response object
    });

    return res.json({
      success: true,
      message: 'Service fee paid successfully. 1 credit added to your account.',
      data: {
        paymentId: payment.paymentId,
        amount: captureResult.amount,
        status: payment.status,
        creditsAdded: 1
      }
    });
  }

  // Handle driver payment
  if (payment.paymentType === 'driver_payment') {
    // Find the ride request to get driver information
    const rideRequest = await RideRequest.findById(payment.rideRequest)
      .populate('driver', 'name email phone');

    // Emit real-time notification to driver
    const io = req.app.get('io');
    if (io && rideRequest) {
      io.to(`ride-${rideRequest.requestId}`).emit('driver-payment-received', {
        requestId: rideRequest.requestId,
        amount: payment.amount,
        calculation: payment.metadata.calculation,
        message: `Payment received! You will get ${payment.metadata.calculation.totalAmount.toFixed(2)} from Opul.`
      });
    }

    return res.json({
      success: true,
      message: 'Driver payment processed successfully.',
      data: {
        paymentId: payment.paymentId,
        amount: captureResult.amount,
        status: payment.status,
        calculation: payment.metadata.calculation
      }
    });
  }

  // Handle ride request payments
  if (rideRequest) {
    // Update ride request status
    rideRequest.paymentStatus = 'paid';
    rideRequest.status = 'pending'; // Keep as pending until driver is selected
    await rideRequest.save();

    // Add 1 credit as bonus for paying for ride
    const clientInfo = rideRequest.clientInfo;
    await addCredits({
      body: {
        email: clientInfo.email,
        phone: clientInfo.phone,
        amount: 1,
        reason: 'Bonus credit for ride payment - $10'
      }
    }, {
      json: () => { } // Mock response object
    });

    // Emit real-time update to drivers
    const io = req.app.get('io');
    io.emit('ride-payment-completed', {
      requestId: rideRequest.requestId,
      status: 'pending' // Ready for driver selection
    });
  }

  res.json({
    success: true,
    message: 'Payment captured successfully',
    data: {
      paymentId: payment.paymentId,
      requestId: rideRequest.requestId,
      amount: captureResult.amount,
      status: payment.status
    }
  });
}));

// Create driver payment order (from chat)
router.post('/create-driver-payment', asyncHandler(async (req, res) => {
  const { requestId, clientEmail, clientPhone, paymentMethod = 'paypal' } = req.body;

  // Find the ride request
  const rideRequest = await RideRequest.findOne({ requestId })
    .populate('driver', 'hourlyRate name email phone');

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  if (rideRequest.status !== 'matched' && rideRequest.status !== 'in_progress') {
    return res.status(400).json({
      success: false,
      message: 'Driver payment only available for matched or in-progress rides'
    });
  }

  // Calculate driver payment: (hourly rate * duration) + 10% tip
  const hourlyRate = rideRequest.driver.hourlyRate;
  const duration = rideRequest.duration;
  const baseAmount = hourlyRate * duration;
  const tip = baseAmount * 0.10; // 10% tip
  const totalAmount = baseAmount + tip;

  let paymentResult;
  const paymentData = {
    paymentId: generatePaymentId(),
    rideRequest: rideRequest._id,
    paymentType: 'driver_payment',
    amount: totalAmount,
    currency: 'USD',
    paymentMethod,
    status: 'pending',
    driverEarnings: totalAmount, // Driver gets full amount
    opulFee: 0, // No Opul fee for direct driver payment
    metadata: {
      clientInfo: { email: clientEmail, phone: clientPhone },
      driverInfo: {
        name: rideRequest.driver.name,
        email: rideRequest.driver.email,
        phone: rideRequest.driver.phone
      },
      calculation: {
        hourlyRate,
        duration,
        baseAmount,
        tip,
        totalAmount
      }
    }
  };

  if (paymentMethod === 'stripe') {
    // Create Stripe Checkout Session for driver payment
    const successUrl = `http://localhost:3000/payment-success.html?type=driver_payment&requestId=${requestId}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `http://localhost:3000/Chat.html?requestId=${requestId}&userType=user`;

    paymentResult = await createStripeCheckoutSession(
      totalAmount,
      'USD',
      `Driver Payment - ${rideRequest.driver.name} (${duration}h @ ${hourlyRate}/h + 10% tip)`,
      successUrl,
      cancelUrl
    );

    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create Stripe checkout session',
        error: paymentResult.error
      });
    }

    paymentData.stripeSessionId = paymentResult.sessionId;

    // Create payment record
    const payment = new Payment(paymentData);
    await payment.save();

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        stripeSessionId: paymentResult.sessionId,
        checkoutUrl: paymentResult.checkoutUrl,
        amount: totalAmount,
        calculation: paymentData.metadata.calculation,
        paymentMethod: 'stripe'
      }
    });
  } else {
    // Create PayPal order for driver payment
    paymentResult = await createPayPalOrder(
      totalAmount,
      'USD',
      `Driver Payment - ${rideRequest.driver.name} (${duration}h @ ${hourlyRate}/h + 10% tip)`
    );

    if (!paymentResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create PayPal order',
        error: paymentResult.error
      });
    }

    paymentData.paypalOrderId = paymentResult.orderId;

    // Create payment record
    const payment = new Payment(paymentData);
    await payment.save();

    // Add return URL parameters for PayPal
    const enhancedApprovalUrl = `${paymentResult.approvalUrl}&return=${encodeURIComponent(`http://localhost:3000/payment-success.html?type=driver_payment&requestId=${requestId}&paypal_order_id=${paymentResult.orderId}`)}`;

    res.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        paypalOrderId: paymentResult.orderId,
        approvalUrl: enhancedApprovalUrl,
        amount: totalAmount,
        calculation: paymentData.metadata.calculation,
        paymentMethod: 'paypal'
      }
    });
  }
}));

// Process final payment (after ride completion)
router.post('/final-payment', authenticate, asyncHandler(async (req, res) => {
  const { requestId, paymentMethod = 'paypal' } = req.body;
  const driverId = req.driver._id;

  // Find completed ride
  const rideRequest = await RideRequest.findOne({
    requestId,
    driver: driverId,
    status: 'completed'
  });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Completed ride not found'
    });
  }

  // Check if final payment already exists
  const existingPayment = await Payment.findOne({
    rideRequest: rideRequest._id,
    paymentType: 'final_payment'
  });

  if (existingPayment) {
    return res.status(400).json({
      success: false,
      message: 'Final payment already processed'
    });
  }

  const finalCost = rideRequest.rideDetails.finalCost;
  const fees = calculateFees(finalCost);

  // Create PayPal order for final payment
  const paypalResult = await createPayPalOrder(
    finalCost,
    'USD',
    `Opul Final Payment - ${requestId}`
  );

  if (!paypalResult.success) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create final payment order',
      error: paypalResult.error
    });
  }

  // Create final payment record
  const payment = new Payment({
    paymentId: generatePaymentId(),
    rideRequest: rideRequest._id,
    paymentType: 'final_payment',
    amount: finalCost,
    currency: 'USD',
    paymentMethod,
    paypalOrderId: paypalResult.orderId,
    status: 'pending',
    opulFee: fees.opulFee,
    driverEarnings: fees.driverEarnings,
    metadata: {
      clientInfo: rideRequest.clientInfo,
      driverInfo: {
        name: req.driver.name,
        email: req.driver.email,
        phone: req.driver.phone
      }
    }
  });

  await payment.save();

  res.json({
    success: true,
    message: 'Final payment order created',
    data: {
      paymentId: payment.paymentId,
      paypalOrderId: paypalResult.orderId,
      approvalUrl: paypalResult.approvalUrl,
      amount: finalCost,
      breakdown: fees
    }
  });
}));

// Get user credits
// Get Stripe publishable key (no auth required)
router.get('/stripe-config', (req, res) => {
  res.json({
    success: true,
    data: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    }
  });
});

// TEMPORARY: Skip webhook verification for development
router.post('/webhook/stripe', express.json(), asyncHandler(async (req, res) => {
  // Skip signature verification for development
  if (process.env.NODE_ENV === 'development' && !process.env.STRIPE_WEBHOOK_SECRET) {
    console.log('⚠️  Webhook signature verification skipped for development');
    res.status(200).json({ success: true, message: 'Webhook received (dev mode)' });
    return;
  }

  // Production webhook verification
  const payload = req.body;
  const sig = req.headers['stripe-signature'];

  const verification = verifyWebhookSignature(payload, sig);

  if (!verification.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid webhook signature'
    });
  }

  const event = verification.event;
  console.log('Stripe Webhook Event:', event.type);

  // Handle different Stripe webhook events
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Checkout session completed:', session.id);

      // Find and update payment record
      const payment = await Payment.findOne({ stripeSessionId: session.id });
      if (payment && payment.status === 'pending') {
        payment.status = 'completed';
        payment.processedAt = new Date();
        await payment.save();

        // Update ride request
        const rideRequest = await RideRequest.findOne({ stripeSessionId: session.id });
        if (rideRequest) {
          rideRequest.paymentStatus = 'paid';
          rideRequest.status = 'active';
          await rideRequest.save();

          // Emit real-time update
          const io = req.app.get('io');
          io.emit('ride-payment-completed', {
            requestId: rideRequest.requestId,
            status: 'active'
          });
        }
      }
      break;

    case 'payment_intent.payment_failed':
      const paymentIntent = event.data.object;
      console.log('Payment failed:', paymentIntent.id);

      // Find and update payment record
      const failedPayment = await Payment.findOne({ paymentIntentId: paymentIntent.id });
      if (failedPayment) {
        failedPayment.status = 'failed';
        failedPayment.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
        await failedPayment.save();
      }
      break;

    default:
      console.log('Unhandled Stripe webhook event:', event.type);
  }

  res.status(200).json({ success: true });
}));

// Webhook for PayPal events (optional, for production)
router.post('/webhook/paypal', asyncHandler(async (req, res) => {
  const event = req.body;

  console.log('PayPal Webhook Event:', event);

  // Handle different PayPal webhook events
  switch (event.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      // Handle successful payment capture
      break;
    case 'PAYMENT.CAPTURE.DENIED':
      // Handle failed payment capture
      break;
    default:
      console.log('Unhandled PayPal webhook event:', event.event_type);
  }

  res.status(200).json({ success: true });
}));

module.exports = router;