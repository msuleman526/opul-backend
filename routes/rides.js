const express = require('express');
const RideRequest = require('../models/RideRequest');
const Driver = require('../models/Driver');
const UserCredit = require('../models/UserCredit');
const { validateRideRequest } = require('../middleware/validation');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { 
  generateRequestId, 
  isValidColombianAddress, 
  calculateUpfrontFee 
} = require('../utils/helpers');
const { checkCredits, deductCredits } = require('../controllers/creditController');

const router = express.Router();

// CORRECTED RIDE REQUEST FLOW - Check credits FIRST, then show timer
router.post('/request-corrected', validateRideRequest, asyncHandler(async (req, res) => {
  const { pickupLocation, duration, clientInfo, hasCredits } = req.body;

  // Validate Colombian address
  if (!isValidColombianAddress(pickupLocation.address)) {
    return res.status(400).json({
      success: false,
      message: 'Sorry, we only serve Medellín, Envigado, and Sabaneta'
    });
  }

  // Calculate upfront fee
  const upfrontFee = calculateUpfrontFee(duration);

  // Check if user actually has credits if they claim to have them
  if (hasCredits) {
    try {
      const userCredit = await UserCredit.findOne({
        $or: [
          { clientEmail: clientInfo.email?.toLowerCase() },
          { clientPhone: clientInfo.phone }
        ]
      });
      
      if (!userCredit || userCredit.totalCredits < 1) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient credits. Please pay to continue.'
        });
      }
    } catch (error) {
      console.error('Error checking credits:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking credits'
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      message: 'Payment required. Please pay $10 to get 1 credit.'
    });
  }

  // User has credits - create ride request and start timer immediately
  const rideRequest = new RideRequest({
    requestId: generateRequestId(),
    pickupLocation,
    duration,
    clientInfo,
    upfrontFee,
    status: 'active', // Start as active since user has credits
    paymentStatus: 'paid', // Consider it paid since user has credits
    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // Set expiration to 5 minutes from now
  });

  // Start the timer immediately
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + (3 * 60 * 1000)); // 3 minutes

  rideRequest.driverSelectionTimer = {
    startTime,
    endTime,
    duration: 3,
    isActive: true,
    hasExpired: false
  };

  await rideRequest.save();

  // Emit to all online drivers
  const io = req.app.get('io');
  io.emit('new-ride-request', {
    requestId: rideRequest.requestId,
    pickupLocation: rideRequest.pickupLocation,
    duration: rideRequest.duration,
    upfrontFee: rideRequest.upfrontFee,
    createdAt: rideRequest.createdAt
  });

  // Emit timer started event to client
  io.to(`ride-${rideRequest.requestId}`).emit('timer-started', {
    requestId: rideRequest.requestId,
    startTime,
    endTime,
    duration: 3
  });

  // Set timeout to handle timer expiry
  setTimeout(async () => {
    await handleTimerExpiry(rideRequest.requestId, req.app.get('io'));
  }, 3 * 60 * 1000);

  res.status(201).json({
    success: true,
    message: 'Ride request created and timer started',
    data: {
      requestId: rideRequest.requestId,
      upfrontFee: rideRequest.upfrontFee,
      expiresAt: rideRequest.expiresAt,
      status: rideRequest.status,
      timerStarted: true,
      timerEndTime: endTime
    }
  });
}));

// Original create ride request (Client) - Always create, check credits later
router.post('/request', validateRideRequest, asyncHandler(async (req, res) => {
  const { pickupLocation, duration, clientInfo } = req.body;

  // Validate Colombian address
  if (!isValidColombianAddress(pickupLocation.address)) {
    return res.status(400).json({
      success: false,
      message: 'Sorry, we only serve Medellín, Envigado, and Sabaneta'
    });
  }

  // Calculate upfront fee
  const upfrontFee = calculateUpfrontFee(duration);

  // Create ride request (always create, payment check happens at driver selection)
  const rideRequest = new RideRequest({
    requestId: generateRequestId(),
    pickupLocation,
    duration,
    clientInfo,
    upfrontFee,
    status: 'pending', // Start as pending, becomes active after payment/credit usage
    paymentStatus: 'unpaid', // Will be updated when payment/credit is used
    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // Set expiration to 5 minutes from now
  });

  await rideRequest.save();

  // Emit to all online drivers
  const io = req.app.get('io');
  io.emit('new-ride-request', {
    requestId: rideRequest.requestId,
    pickupLocation: rideRequest.pickupLocation,
    duration: rideRequest.duration,
    upfrontFee: rideRequest.upfrontFee,
    createdAt: rideRequest.createdAt
  });

  res.status(201).json({
    success: true,
    message: 'Ride request created successfully',
    data: {
      requestId: rideRequest.requestId,
      upfrontFee: rideRequest.upfrontFee,
      expiresAt: rideRequest.expiresAt,
      status: rideRequest.status
    }
  });
}));

// Get active ride requests (for drivers)
router.get('/active', asyncHandler(async (req, res) => {
  const activeRequests = await RideRequest.find({
    status: { $in: ['active', 'pending', 'matched', 'in_progress'] },
    expiresAt: { $gt: new Date() }
  })
  .populate('driver', 'name phone vehicleType vehicleModel vehiclePlate rating')
  .select('requestId pickupLocation duration upfrontFee status createdAt driverOffers driver rideDetails')
  .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: activeRequests
  });
}));

// Get driver's active rides (matched and in_progress)
router.get('/driver/active', authenticate, asyncHandler(async (req, res) => {
  const driverId = req.driver._id;

  const driverRides = await RideRequest.find({
    driver: driverId,
    status: { $in: ['matched', 'in_progress'] }
  })
  .populate('driver', 'name phone vehicleType vehicleModel vehiclePlate rating')
  .select('requestId pickupLocation duration upfrontFee status createdAt rideDetails clientInfo chatMessages')
  .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: driverRides
  });
}));

// Get ride request details
router.get('/:requestId', asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const rideRequest = await RideRequest.findOne({ requestId })
    .populate('driver', 'name phone vehicleType vehicleModel vehiclePlate rating')
    .populate('driverOffers.driver', 'name vehicleType vehicleModel hourlyRate rating');

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  res.json({
    success: true,
    data: rideRequest
  });
}));

// Driver makes an offer on ride request
router.post('/:requestId/offer', authenticate, asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const driverId = req.driver._id;

  const rideRequest = await RideRequest.findOne({ 
    requestId,
    status: { $in: ['active', 'pending'] },
    expiresAt: { $gt: new Date() }
  });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found or expired'
    });
  }

  // Check if driver already made an offer
  const existingOffer = rideRequest.driverOffers.find(
    offer => offer.driver.toString() === driverId.toString()
  );

  if (existingOffer) {
    return res.status(400).json({
      success: false,
      message: 'You have already made an offer for this ride'
    });
  }

  // Add driver offer
  rideRequest.driverOffers.push({
    driver: driverId,
    hourlyRate: req.driver.hourlyRate,
    status: 'pending'
  });

  await rideRequest.save();

  // Populate driver info for response
  await rideRequest.populate('driverOffers.driver', 'name vehicleType vehicleModel hourlyRate rating');

  // Emit to client about new offer
  const io = req.app.get('io');
  io.to(`ride-${requestId}`).emit('new-driver-offer', {
    requestId,
    driver: {
      id: req.driver._id,
      name: req.driver.name,
      vehicleType: req.driver.vehicleType,
      vehicleModel: req.driver.vehicleModel,
      hourlyRate: req.driver.hourlyRate,
      rating: req.driver.rating
    }
  });

  res.json({
    success: true,
    message: 'Offer submitted successfully',
    data: {
      requestId,
      offer: rideRequest.driverOffers[rideRequest.driverOffers.length - 1]
    }
  });
}));

// Client accepts driver offer
router.post('/:requestId/accept/:driverId', asyncHandler(async (req, res) => {
  const { requestId, driverId } = req.params;

  console.log(`🚗 Accepting driver ${driverId} for ride ${requestId}`);

  const rideRequest = await RideRequest.findOne({ requestId })
    .populate('driver', 'name phone vehicleType vehicleModel vehiclePlate');

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  console.log('📋 Current ride status:', {
    status: rideRequest.status,
    paymentStatus: rideRequest.paymentStatus,
    timerActive: rideRequest.driverSelectionTimer?.isActive,
    timerExpired: rideRequest.driverSelectionTimer?.hasExpired
  });

  // Check if ride is in a state that allows driver selection
  const validStatuses = ['pending', 'active'];
  if (!validStatuses.includes(rideRequest.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot accept driver for ride with status: ${rideRequest.status}`
    });
  }

  // Check if user has paid (either via payment or has sufficient credits)
  const clientInfo = rideRequest.clientInfo;
  let hasPaid = rideRequest.paymentStatus === 'paid';
  
  if (!hasPaid) {
    // Check if user has credits
    try {
      const userCredit = await UserCredit.findOne({
        $or: [
          { clientEmail: clientInfo.email?.toLowerCase() },
          { clientPhone: clientInfo.phone }
        ]
      });
      
      if (userCredit && userCredit.totalCredits >= 1) {
        hasPaid = true;
        console.log('✅ User has', userCredit.totalCredits, 'credits, allowing selection');
      }
    } catch (error) {
      console.error('Error checking credits:', error);
    }
  }

  if (!hasPaid) {
    return res.status(400).json({
      success: false,
      message: 'Payment required or insufficient credits'
    });
  }

  // Find the driver offer
  const driverOffer = rideRequest.driverOffers.find(
    offer => offer.driver.toString() === driverId
  );

  if (!driverOffer) {
    return res.status(404).json({
      success: false,
      message: 'Driver offer not found'
    });
  }

  console.log('💳 Deducting 1 credit for driver selection...');
  
  // Deduct 1 credit when driver is selected
  try {
    await deductCredits({
      body: {
        email: clientInfo.email,
        phone: clientInfo.phone,
        amount: 1,
        reason: 'Driver selection for ride',
        rideRequestId: rideRequest._id
      }
    }, {
      json: () => {} // Mock response object
    });
  } catch (error) {
    console.error('Error deducting credits:', error);
    return res.status(400).json({
      success: false,
      message: 'Failed to deduct credits'
    });
  }

  // Update ride request
  rideRequest.driver = driverId;
  rideRequest.status = 'matched';
  
  // Stop the timer since driver was selected
  rideRequest.driverSelectionTimer.isActive = false;
  
  // Update all offers status
  rideRequest.driverOffers.forEach(offer => {
    if (offer.driver.toString() === driverId) {
      offer.status = 'accepted';
    } else {
      offer.status = 'rejected';
    }
  });

  await rideRequest.save();

  // Update driver availability
  await Driver.findByIdAndUpdate(driverId, { 
    isAvailable: false,
    lastActiveAt: new Date()
  });

  // Emit real-time updates
  const io = req.app.get('io');
  
  // Notify the accepted driver
  io.emit('ride-accepted', {
    requestId,
    driverId,
    rideRequest: {
      requestId: rideRequest.requestId,
      pickupLocation: rideRequest.pickupLocation,
      duration: rideRequest.duration,
      clientInfo: rideRequest.clientInfo
    }
  });

  // Notify rejected drivers
  rideRequest.driverOffers.forEach(offer => {
    if (offer.driver.toString() !== driverId) {
      io.emit('ride-rejected', {
        requestId,
        driverId: offer.driver
      });
    }
  });

  res.json({
    success: true,
    message: 'Driver accepted successfully',
    data: {
      requestId,
      driver: rideRequest.driver,
      status: rideRequest.status
    }
  });
}));

// Start ride (Driver)
router.post('/:requestId/start', authenticate, asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const driverId = req.driver._id;

  const rideRequest = await RideRequest.findOne({ 
    requestId,
    driver: driverId,
    status: 'matched'
  });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride not found or not authorized'
    });
  }

  // Update ride status and start time
  rideRequest.status = 'in_progress';
  rideRequest.rideDetails = {
    ...rideRequest.rideDetails,
    startTime: new Date()
  };

  await rideRequest.save();

  // Emit real-time update
  const io = req.app.get('io');
  io.to(`ride-${requestId}`).emit('ride-started', {
    requestId,
    startTime: rideRequest.rideDetails.startTime
  });

  res.json({
    success: true,
    message: 'Ride started successfully',
    data: {
      requestId,
      status: rideRequest.status,
      startTime: rideRequest.rideDetails.startTime
    }
  });
}));

// End ride (Driver)
router.post('/:requestId/end', authenticate, asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const driverId = req.driver._id;

  const rideRequest = await RideRequest.findOne({ 
    requestId,
    driver: driverId,
    status: 'in_progress'
  });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride not found or not authorized'
    });
  }

  const endTime = new Date();
  const startTime = rideRequest.rideDetails?.startTime || new Date();
  const actualDuration = Math.ceil((endTime - startTime) / (1000 * 60 * 60)); // hours

  // Calculate final cost
  const hourlyRate = req.driver.hourlyRate;
  const finalCost = actualDuration * hourlyRate;
  const opulFee = (finalCost * 10) / 100; // 10% fee
  const driverEarnings = finalCost - opulFee;

  // Update ride details
  rideRequest.status = 'completed';
  rideRequest.rideDetails = {
    ...rideRequest.rideDetails,
    endTime,
    actualDuration,
    finalCost,
    opulFee,
    driverEarnings
  };

  await rideRequest.save();

  // Update driver stats
  await Driver.findByIdAndUpdate(driverId, {
    $inc: { 
      totalRides: 1,
      totalEarnings: driverEarnings
    },
    isAvailable: true,
    lastActiveAt: new Date()
  });

  // Emit real-time update
  const io = req.app.get('io');
  io.to(`ride-${requestId}`).emit('ride-completed', {
    requestId,
    endTime,
    actualDuration,
    finalCost,
    driverEarnings
  });

  res.json({
    success: true,
    message: 'Ride completed successfully',
    data: {
      requestId,
      status: rideRequest.status,
      rideDetails: rideRequest.rideDetails
    }
  });
}));

// Start driver selection timer - Called when user accepts driver
router.post('/:requestId/start-timer', asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const rideRequest = await RideRequest.findOne({ 
    requestId,
    status: { $in: ['active', 'pending'] } // Allow both active and pending
  });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  // Check if timer is already active
  if (rideRequest.driverSelectionTimer.isActive) {
    return res.status(400).json({
      success: false,
      message: 'Timer is already active'
    });
  }

  // Start the timer
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + (3 * 60 * 1000)); // 3 minutes

  rideRequest.driverSelectionTimer = {
    startTime,
    endTime,
    duration: 3,
    isActive: true,
    hasExpired: false
  };

  rideRequest.status = 'active'; // Change status to active when timer starts
  await rideRequest.save();

  // Emit timer started event
  const io = req.app.get('io');
  io.to(`ride-${requestId}`).emit('timer-started', {
    requestId,
    startTime,
    endTime,
    duration: 3
  });

  // Set timeout to handle timer expiry
  setTimeout(async () => {
    await handleTimerExpiry(requestId, req.app.get('io'));
  }, 3 * 60 * 1000);

  res.json({
    success: true,
    message: 'Driver selection timer started',
    data: {
      requestId,
      timer: rideRequest.driverSelectionTimer
    }
  });
}));

// Get timer status
router.get('/:requestId/timer-status', asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const rideRequest = await RideRequest.findOne({ requestId });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  const timer = rideRequest.driverSelectionTimer;
  let timeRemaining = 0;
  
  if (timer.isActive && !timer.hasExpired) {
    const now = new Date();
    timeRemaining = Math.max(0, Math.floor((timer.endTime - now) / 1000)); // seconds
  }

  res.json({
    success: true,
    data: {
      timer,
      timeRemaining
    }
  });
}));

// Function to handle timer expiry
async function handleTimerExpiry(requestId, io) {
  try {
    const rideRequest = await RideRequest.findOne({ 
      requestId,
      'driverSelectionTimer.isActive': true,
      'driverSelectionTimer.hasExpired': false
    });

    if (!rideRequest) {
      return; // Timer already handled or ride not found
    }

    // Check if driver was selected during timer
    if (rideRequest.status === 'matched') {
      return; // Driver was selected, no need to expire
    }

    // Mark timer as expired
    rideRequest.driverSelectionTimer.isActive = false;
    rideRequest.driverSelectionTimer.hasExpired = true;
    rideRequest.status = 'expired';

    // Refund credits to user
    if (rideRequest.clientInfo.email || rideRequest.clientInfo.phone) {
      const UserCredit = require('../models/UserCredit');
      
      // Find user credit record
      const userCredit = await UserCredit.findOne({
        $or: [
          { email: rideRequest.clientInfo.email },
          { phoneNumber: rideRequest.clientInfo.phone }
        ]
      });

      if (userCredit) {
        // Add credit back
        userCredit.credits.push({
          amount: 1,
          source: 'timer_expiry_refund',
          description: `Refund for expired ride selection - ${requestId}`,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        });
        
        await userCredit.save();
      }
    }

    await rideRequest.save();

    // Emit timer expired event
    io.to(`ride-${requestId}`).emit('timer-expired', {
      requestId,
      message: 'Driver selection time expired. Credit has been refunded to your account.'
    });

    // Notify all drivers that the ride is no longer available
    io.emit('ride-expired', {
      requestId
    });

  } catch (error) {
    console.error('Error handling timer expiry:', error);
  }
}

// Cancel ride request
router.post('/:requestId/cancel', asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { reason } = req.body;

  const rideRequest = await RideRequest.findOne({ requestId });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  if (rideRequest.status === 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Cannot cancel completed ride'
    });
  }

  rideRequest.status = 'cancelled';
  await rideRequest.save();

  // If driver was assigned, make them available again
  if (rideRequest.driver) {
    await Driver.findByIdAndUpdate(rideRequest.driver, {
      isAvailable: true
    });
  }

  // Emit real-time update
  const io = req.app.get('io');
  io.emit('ride-cancelled', {
    requestId,
    reason
  });

  res.json({
    success: true,
    message: 'Ride cancelled successfully',
    data: {
      requestId,
      status: rideRequest.status,
      reason
    }
  });
}));

module.exports = router;
