const RideRequest = require('../models/RideRequest');

const cleanupExpiredRequests = async () => {
  try {
    const result = await RideRequest.deleteMany({
      status: 'pending',
      expiresAt: { $lte: new Date() }
    });
    
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} expired ride requests`);
    }
  } catch (error) {
    console.error('❌ Error cleaning up expired requests:', error);
  }
};

const markRequestAsExpired = async (requestId) => {
  try {
    await RideRequest.findOneAndUpdate(
      { requestId, status: 'pending' },
      { status: 'expired' }
    );
    console.log(`⏰ Marked request ${requestId} as expired`);
  } catch (error) {
    console.error('❌ Error marking request as expired:', error);
  }
};

module.exports = {
  cleanupExpiredRequests,
  markRequestAsExpired
};
