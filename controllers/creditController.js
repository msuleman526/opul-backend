const UserCredit = require('../models/UserCredit');
const { asyncHandler } = require('../middleware/errorHandler');

// Get user credits by email or phone
const getUserCredits = asyncHandler(async (req, res) => {
  const { email, phone } = req.query;
  
  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      message: 'Email or phone is required'
    });
  }

  let userCredit;
  if (email) {
    userCredit = await UserCredit.findOne({ clientEmail: email.toLowerCase() });
  } else if (phone) {
    userCredit = await UserCredit.findOne({ clientPhone: phone });
  }

  if (!userCredit) {
    // Create new user credit record with 0 credits
    userCredit = new UserCredit({
      clientEmail: email?.toLowerCase() || '',
      clientPhone: phone || '',
      totalCredits: 0,
      creditHistory: []
    });
    await userCredit.save();
  }

  res.json({
    success: true,
    data: {
      totalCredits: userCredit.totalCredits,
      creditHistory: userCredit.creditHistory
    }
  });
});

// Add credits to user account
const addCredits = asyncHandler(async (req, res) => {
  const { email, phone, amount, reason, rideRequestId } = req.body;
  
  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      message: 'Email or phone is required'
    });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid amount is required'
    });
  }

  let userCredit;
  if (email) {
    userCredit = await UserCredit.findOne({ clientEmail: email.toLowerCase() });
  } else if (phone) {
    userCredit = await UserCredit.findOne({ clientPhone: phone });
  }

  if (!userCredit) {
    // Create new user credit record
    userCredit = new UserCredit({
      clientEmail: email?.toLowerCase() || '',
      clientPhone: phone || '',
      totalCredits: 0,
      creditHistory: []
    });
  }

  // Add credits
  userCredit.totalCredits += amount;
  userCredit.creditHistory.push({
    amount,
    type: 'credit',
    reason: reason || 'Service fee payment',
    rideRequest: rideRequestId || null,
    timestamp: new Date()
  });

  await userCredit.save();

  res.json({
    success: true,
    message: 'Credits added successfully',
    data: {
      totalCredits: userCredit.totalCredits,
      addedAmount: amount
    }
  });
});

// Deduct credits from user account
const deductCredits = asyncHandler(async (req, res) => {
  const { email, phone, amount, reason, rideRequestId } = req.body;
  
  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      message: 'Email or phone is required'
    });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid amount is required'
    });
  }

  let userCredit;
  if (email) {
    userCredit = await UserCredit.findOne({ clientEmail: email.toLowerCase() });
  } else if (phone) {
    userCredit = await UserCredit.findOne({ clientPhone: phone });
  }

  if (!userCredit || userCredit.totalCredits < amount) {
    return res.status(400).json({
      success: false,
      message: 'Insufficient credits'
    });
  }

  // Deduct credits
  userCredit.totalCredits -= amount;
  userCredit.creditHistory.push({
    amount: -amount,
    type: 'debit',
    reason: reason || 'Ride selection',
    rideRequest: rideRequestId || null,
    timestamp: new Date()
  });

  await userCredit.save();

  res.json({
    success: true,
    message: 'Credits deducted successfully',
    data: {
      totalCredits: userCredit.totalCredits,
      deductedAmount: amount
    }
  });
});

// Check if user has sufficient credits
const checkCredits = asyncHandler(async (req, res) => {
  const { email, phone, requiredAmount = 1 } = req.query;
  
  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      message: 'Email or phone is required'
    });
  }

  let userCredit;
  if (email) {
    userCredit = await UserCredit.findOne({ clientEmail: email.toLowerCase() });
  } else if (phone) {
    userCredit = await UserCredit.findOne({ clientPhone: phone });
  }

  const currentCredits = userCredit ? userCredit.totalCredits : 0;
  const hasEnoughCredits = currentCredits >= requiredAmount;

  res.json({
    success: true,
    data: {
      totalCredits: currentCredits,
      requiredAmount: parseInt(requiredAmount),
      hasEnoughCredits,
      shortfall: hasEnoughCredits ? 0 : (requiredAmount - currentCredits)
    }
  });
});

module.exports = {
  getUserCredits,
  addCredits,
  deductCredits,
  checkCredits
};
