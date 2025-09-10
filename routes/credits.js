const express = require('express');
const {
  getUserCredits,
  addCredits,
  deductCredits,
  checkCredits
} = require('../controllers/creditController');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get user credits
router.get('/', asyncHandler(getUserCredits));

// Check if user has sufficient credits
router.get('/check', asyncHandler(checkCredits));

// Add credits (internal use)
router.post('/add', asyncHandler(addCredits));

// Deduct credits (internal use)
router.post('/deduct', asyncHandler(deductCredits));

module.exports = router;
