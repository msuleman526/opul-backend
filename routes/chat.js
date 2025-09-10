const express = require('express');
const RideRequest = require('../models/RideRequest');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Get chat messages for a ride
router.get('/:requestId/messages', asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const rideRequest = await RideRequest.findOne({ requestId })
    .select('chatMessages status')
    .populate('driver', 'name');

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  res.json({
    success: true,
    data: {
      requestId,
      status: rideRequest.status,
      messages: rideRequest.chatMessages,
      driver: rideRequest.driver
    }
  });
}));

// Send a chat message - FIXED VERSION
router.post('/:requestId/messages', asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { message, sender, language = 'english' } = req.body;

  if (!message || !sender) {
    return res.status(400).json({
      success: false,
      message: 'Message and sender are required'
    });
  }

  if (!['client', 'driver'].includes(sender)) {
    return res.status(400).json({
      success: false,
      message: 'Sender must be either "client" or "driver"'
    });
  }

  const rideRequest = await RideRequest.findOne({ requestId });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  // Check if ride is in a state where chat is allowed
  const allowedStatuses = ['matched', 'in_progress', 'completed'];
  if (!allowedStatuses.includes(rideRequest.status)) {
    return res.status(400).json({
      success: false,
      message: 'Chat is not available for this ride status'
    });
  }

  // Add message to chat
  const chatMessage = {
    sender,
    message: message.trim(),
    timestamp: new Date(),
    language
  };

  rideRequest.chatMessages.push(chatMessage);
  await rideRequest.save();

  // Get the saved message with ID
  const savedMessage = rideRequest.chatMessages[rideRequest.chatMessages.length - 1];

  // Emit real-time message to Socket.IO - IMPROVED VERSION
  const io = req.app.get('io');
  if (io) {
    // Broadcast to ALL users in the room (including sender for confirmation)
    io.to(`ride-${requestId}`).emit('receive-message', {
      message: savedMessage.message,
      sender: sender === 'client' ? 'user' : sender, // Convert 'client' to 'user' for frontend
      timestamp: savedMessage.timestamp,
      id: savedMessage._id,
      messageId: savedMessage._id
    });
    
    console.log(`✅ Real-time message broadcasted for ride ${requestId}`);
  }

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: {
      ...chatMessage,
      id: savedMessage._id
    }
  });
}));

// Mark messages as read (optional feature)
router.put('/:requestId/messages/read', asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { lastReadMessageId, reader } = req.body;

  if (!reader || !['client', 'driver'].includes(reader)) {
    return res.status(400).json({
      success: false,
      message: 'Valid reader type is required'
    });
  }

  const rideRequest = await RideRequest.findOne({ requestId });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  // Emit read status to Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.to(`ride-${requestId}`).emit('messages-read', {
      requestId,
      reader,
      lastReadMessageId,
      timestamp: new Date()
    });
  }

  res.json({
    success: true,
    message: 'Messages marked as read'
  });
}));

// Get chat statistics for a ride
router.get('/:requestId/stats', asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const rideRequest = await RideRequest.findOne({ requestId })
    .select('chatMessages status createdAt');

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  const stats = {
    totalMessages: rideRequest.chatMessages.length,
    clientMessages: rideRequest.chatMessages.filter(msg => msg.sender === 'client').length,
    driverMessages: rideRequest.chatMessages.filter(msg => msg.sender === 'driver').length,
    languageBreakdown: {
      spanish: rideRequest.chatMessages.filter(msg => msg.language === 'spanish').length,
      english: rideRequest.chatMessages.filter(msg => msg.language === 'english').length
    },
    firstMessage: rideRequest.chatMessages[0] || null,
    lastMessage: rideRequest.chatMessages[rideRequest.chatMessages.length - 1] || null,
    rideStatus: rideRequest.status,
    rideCreatedAt: rideRequest.createdAt
  };

  res.json({
    success: true,
    data: stats
  });
}));

// Test chat connectivity endpoint
router.get('/:requestId/test', asyncHandler(async (req, res) => {
  const { requestId } = req.params;

  const rideRequest = await RideRequest.findOne({ requestId });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  // Send test message via Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.to(`ride-${requestId}`).emit('receive-message', {
      message: 'Test message from server',
      sender: 'system',
      timestamp: new Date(),
      id: 'test_' + Date.now()
    });
  }

  res.json({
    success: true,
    message: 'Test message sent',
    data: {
      requestId,
      connectedClients: io ? io.sockets.adapter.rooms.get(`ride-${requestId}`)?.size || 0 : 0
    }
  });
}));

// Export chat log (for completed rides)
router.get('/:requestId/export', asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { format = 'json' } = req.query;

  const rideRequest = await RideRequest.findOne({ requestId })
    .populate('driver', 'name phone vehicleType vehicleModel vehiclePlate')
    .select('requestId chatMessages status clientInfo pickupLocation duration rideDetails createdAt updatedAt');

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  // Only allow export for completed rides
  if (rideRequest.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Chat export is only available for completed rides'
    });
  }

  const exportData = {
    rideInfo: {
      requestId: rideRequest.requestId,
      status: rideRequest.status,
      pickupLocation: rideRequest.pickupLocation,
      duration: rideRequest.duration,
      createdAt: rideRequest.createdAt,
      completedAt: rideRequest.updatedAt
    },
    participants: {
      client: rideRequest.clientInfo,
      driver: rideRequest.driver
    },
    rideDetails: rideRequest.rideDetails,
    chatLog: rideRequest.chatMessages.map(msg => ({
      sender: msg.sender,
      message: msg.message,
      timestamp: msg.timestamp,
      language: msg.language
    })),
    exportedAt: new Date(),
    totalMessages: rideRequest.chatMessages.length
  };

  if (format === 'txt') {
    // Generate text format
    let textContent = `OPUL RIDE CHAT LOG\n`;
    textContent += `===================\n\n`;
    textContent += `Ride ID: ${exportData.rideInfo.requestId}\n`;
    textContent += `Pickup: ${exportData.rideInfo.pickupLocation.address}\n`;
    textContent += `Duration: ${exportData.rideInfo.duration} hours\n`;
    textContent += `Started: ${exportData.rideInfo.createdAt}\n`;
    textContent += `Completed: ${exportData.rideInfo.completedAt}\n\n`;
    textContent += `Participants:\n`;
    textContent += `- Client: ${exportData.participants.client.name || 'Anonymous'}\n`;
    textContent += `- Driver: ${exportData.participants.driver.name}\n\n`;
    textContent += `CHAT MESSAGES\n`;
    textContent += `=============\n\n`;

    exportData.chatLog.forEach(msg => {
      const timestamp = new Date(msg.timestamp).toLocaleString();
      textContent += `[${timestamp}] ${msg.sender.toUpperCase()}: ${msg.message}\n`;
    });

    textContent += `\n--- End of Chat Log ---\n`;
    textContent += `Total Messages: ${exportData.totalMessages}\n`;
    textContent += `Exported: ${exportData.exportedAt}`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="chat_log_${requestId}.txt"`);
    return res.send(textContent);
  }

  // Default JSON format
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="chat_log_${requestId}.json"`);
  res.json(exportData);
}));

// Delete chat messages (admin function)
router.delete('/:requestId/messages', asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { messageIds, deleteAll = false } = req.body;

  const rideRequest = await RideRequest.findOne({ requestId });

  if (!rideRequest) {
    return res.status(404).json({
      success: false,
      message: 'Ride request not found'
    });
  }

  if (deleteAll) {
    rideRequest.chatMessages = [];
  } else if (messageIds && Array.isArray(messageIds)) {
    rideRequest.chatMessages = rideRequest.chatMessages.filter(
      msg => !messageIds.includes(msg._id.toString())
    );
  } else {
    return res.status(400).json({
      success: false,
      message: 'Either provide messageIds array or set deleteAll to true'
    });
  }

  await rideRequest.save();

  // Emit real-time update
  const io = req.app.get('io');
  if (io) {
    io.to(`ride-${requestId}`).emit('messages-deleted', {
      requestId,
      deletedAll: deleteAll,
      deletedMessageIds: messageIds,
      timestamp: new Date()
    });
  }

  res.json({
    success: true,
    message: 'Messages deleted successfully',
    data: {
      remainingMessages: rideRequest.chatMessages.length
    }
  });
}));

module.exports = router;