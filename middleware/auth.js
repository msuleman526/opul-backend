const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.driver = await Driver.findById(decoded.id).select('-password');
    
    if (!req.driver) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Driver not found.'
      });
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.driver = await Driver.findById(decoded.id).select('-password');
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

module.exports = { authenticate, optionalAuth };
