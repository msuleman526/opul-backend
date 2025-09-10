const { body, validationResult } = require('express-validator');

const validateRideRequest = [
  body('pickupLocation.address')
    .notEmpty()
    .withMessage('Pickup address is required')
    .isLength({ min: 10 })
    .withMessage('Pickup address must be at least 10 characters long'),
  
  body('duration')
    .isInt({ min: 1, max: 24 })
    .withMessage('Duration must be between 1 and 24 hours'),
  
  body('clientInfo.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  
  body('clientInfo.email')
    .optional()
    .isEmail()
    .withMessage('Valid email required'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

const validateDriverRegistration = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  
  body('phone')
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  
  body('vehicleType')
    .isIn(['sedan', 'suv', 'truck', 'motorcycle', 'other'])
    .withMessage('Valid vehicle type is required'),
  
  body('vehicleModel')
    .notEmpty()
    .withMessage('Vehicle model is required'),
  
  body('vehiclePlate')
    .notEmpty()
    .withMessage('Vehicle plate is required')
    .isLength({ min: 3 })
    .withMessage('Vehicle plate must be at least 3 characters long'),
  
  body('hourlyRate')
    .isFloat({ min: 1 })
    .withMessage('Hourly rate must be at least $1'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

const validatePayment = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  
  body('paymentMethod')
    .optional()
    .isIn(['paypal', 'stripe', 'credit_card', 'debit_card'])
    .withMessage('Valid payment method is required'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: errors.array().map(err => err.msg)
      });
    }
    next();
  }
];

module.exports = {
  validateRideRequest,
  validateDriverRegistration,
  validatePayment
};
