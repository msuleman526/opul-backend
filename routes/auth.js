const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');
const { validateDriverRegistration } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Driver registration
router.post('/register', validateDriverRegistration, asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    vehicleType,
    vehicleModel,
    vehiclePlate,
    hourlyRate,
    location
  } = req.body;

  // Check if driver already exists
  const existingDriver = await Driver.findOne({
    $or: [{ email }, { vehiclePlate }]
  });

  if (existingDriver) {
    return res.status(400).json({
      success: false,
      message: 'Driver with this email or vehicle plate already exists'
    });
  }

  // Create new driver
  const driver = new Driver({
    name,
    email,
    phone,
    vehicleType,
    vehicleModel,
    vehiclePlate,
    hourlyRate,
    location
  });

  await driver.save();

  // Generate JWT token
  const token = jwt.sign(
    { id: driver._id, role: 'driver' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    success: true,
    message: 'Driver registered successfully',
    data: {
      driver: {
        id: driver._id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        vehicleModel: driver.vehicleModel,
        vehiclePlate: driver.vehiclePlate,
        hourlyRate: driver.hourlyRate,
        isVerified: driver.isVerified
      },
      token
    }
  });
}));

// Driver login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, vehiclePlate } = req.body;

  if (!email && !vehiclePlate) {
    return res.status(400).json({
      success: false,
      message: 'Email or vehicle plate is required'
    });
  }

  // Find driver
  const driver = await Driver.findOne({
    $or: [{ email }, { vehiclePlate }]
  });

  if (!driver) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Update last active time and online status
  driver.lastActiveAt = new Date();
  driver.isOnline = true;
  await driver.save();

  // Generate JWT token
  const token = jwt.sign(
    { id: driver._id, role: 'driver' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      driver: {
        id: driver._id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        vehicleModel: driver.vehicleModel,
        vehiclePlate: driver.vehiclePlate,
        hourlyRate: driver.hourlyRate,
        rating: driver.rating,
        totalRides: driver.totalRides,
        isVerified: driver.isVerified,
        isOnline: driver.isOnline
      },
      token
    }
  });
}));

// Driver logout
router.post('/logout', asyncHandler(async (req, res) => {
  const { driverId } = req.body;

  if (driverId) {
    await Driver.findByIdAndUpdate(driverId, {
      isOnline: false,
      lastActiveAt: new Date()
    });
  }

  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

module.exports = router;
