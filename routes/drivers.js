const express = require('express');
const Driver = require('../models/Driver');
const RideRequest = require('../models/RideRequest');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { calculateDistance } = require('../utils/helpers');

const router = express.Router();

// Get all available drivers
router.get('/available', asyncHandler(async (req, res) => {
  const { latitude, longitude, radius = 10 } = req.query;

  let query = { 
    isAvailable: true, 
    isOnline: true,
    isVerified: true
  };

  let drivers = await Driver.find(query)
    .select('name vehicleType vehicleModel hourlyRate rating totalRides location')
    .sort({ rating: -1, totalRides: -1 });

  // Filter by distance if coordinates provided
  if (latitude && longitude) {
    drivers = drivers.filter(driver => {
      if (!driver.location?.latitude || !driver.location?.longitude) {
        return false;
      }
      
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        driver.location.latitude,
        driver.location.longitude
      );
      
      return distance <= parseFloat(radius);
    });
  }

  res.json({
    success: true,
    data: drivers,
    count: drivers.length
  });
}));

// Get driver profile
router.get('/profile/:driverId', asyncHandler(async (req, res) => {
  const { driverId } = req.params;

  const driver = await Driver.findById(driverId)
    .select('-email -phone');

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }

  // Get recent completed rides
  const recentRides = await RideRequest.find({
    driver: driverId,
    status: 'completed'
  })
  .select('pickupLocation duration rideDetails createdAt')
  .sort({ createdAt: -1 })
  .limit(5);

  res.json({
    success: true,
    data: {
      driver,
      recentRides
    }
  });
}));

// Update driver profile (authenticated)
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const driverId = req.driver._id;
  const allowedUpdates = [
    'name', 
    'phone', 
    'vehicleType', 
    'vehicleModel', 
    'vehiclePlate', 
    'hourlyRate', 
    'location',
    'profilePicture'
  ];

  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  const driver = await Driver.findByIdAndUpdate(
    driverId,
    updates,
    { new: true, runValidators: true }
  ).select('-email');

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: driver
  });
}));

// Update driver location
router.put('/location', authenticate, asyncHandler(async (req, res) => {
  const { latitude, longitude, address } = req.body;
  const driverId = req.driver._id;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude are required'
    });
  }

  const driver = await Driver.findByIdAndUpdate(
    driverId,
    {
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address
      },
      lastActiveAt: new Date()
    },
    { new: true }
  );

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }

  res.json({
    success: true,
    message: 'Location updated successfully',
    data: {
      location: driver.location
    }
  });
}));

// Toggle driver availability
router.put('/availability', authenticate, asyncHandler(async (req, res) => {
  const { isAvailable } = req.body;
  const driverId = req.driver._id;

  const driver = await Driver.findByIdAndUpdate(
    driverId,
    { 
      isAvailable: Boolean(isAvailable),
      lastActiveAt: new Date()
    },
    { new: true }
  );

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }

  res.json({
    success: true,
    message: `Driver ${isAvailable ? 'available' : 'unavailable'}`,
    data: {
      isAvailable: driver.isAvailable
    }
  });
}));

// Toggle driver online status
router.put('/online', authenticate, asyncHandler(async (req, res) => {
  const { isOnline } = req.body;
  const driverId = req.driver._id;

  const driver = await Driver.findByIdAndUpdate(
    driverId,
    { 
      isOnline: Boolean(isOnline),
      lastActiveAt: new Date()
    },
    { new: true }
  );

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found'
    });
  }

  res.json({
    success: true,
    message: `Driver ${isOnline ? 'online' : 'offline'}`,
    data: {
      isOnline: driver.isOnline
    }
  });
}));

// Get driver dashboard data
router.get('/dashboard', authenticate, asyncHandler(async (req, res) => {
  const driverId = req.driver._id;

  // Get driver stats
  const driver = await Driver.findById(driverId);
  
  // Get active rides
  const activeRides = await RideRequest.find({
    driver: driverId,
    status: { $in: ['matched', 'in_progress'] }
  })
  .populate('clientInfo')
  .sort({ createdAt: -1 });

  // Get recent completed rides
  const recentRides = await RideRequest.find({
    driver: driverId,
    status: 'completed'
  })
  .select('requestId pickupLocation duration rideDetails createdAt')
  .sort({ createdAt: -1 })
  .limit(10);

  // Calculate earnings for current month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyEarnings = await RideRequest.aggregate([
    {
      $match: {
        driver: driverId,
        status: 'completed',
        'rideDetails.endTime': { $gte: startOfMonth }
      }
    },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$rideDetails.driverEarnings' },
        totalRides: { $sum: 1 }
      }
    }
  ]);

  const stats = {
    totalRides: driver.totalRides,
    totalEarnings: driver.totalEarnings,
    rating: driver.rating,
    monthlyEarnings: monthlyEarnings[0]?.totalEarnings || 0,
    monthlyRides: monthlyEarnings[0]?.totalRides || 0,
    isAvailable: driver.isAvailable,
    isOnline: driver.isOnline
  };

  res.json({
    success: true,
    data: {
      driver: {
        id: driver._id,
        name: driver.name,
        vehicleType: driver.vehicleType,
        vehicleModel: driver.vehicleModel,
        hourlyRate: driver.hourlyRate
      },
      stats,
      activeRides,
      recentRides
    }
  });
}));

module.exports = router;