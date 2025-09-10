const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');
const driverRoutes = require('./routes/drivers');
const paymentRoutes = require('./routes/payments');
const chatRoutes = require('./routes/chat');
const creditRoutes = require('./routes/credits');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { cleanupExpiredRequests } = require('./utils/cleanup');

// Import models
const RideRequest = require('./models/RideRequest');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opul_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Store active user sessions
const activeSessions = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // Join room for real-time ride updates
  socket.on('join-ride', (data) => {
    const { requestId, userType } = data;
    socket.join(`ride-${requestId}`);
    console.log(`👤 User ${socket.id} (${userType}) joined ride room: ${requestId}`);
    
    // Store session info
    activeSessions.set(socket.id, {
      rideId: requestId,
      userType: userType,
      joinedAt: new Date()
    });
    
    // Notify others in the room about user joining
    socket.to(`ride-${requestId}`).emit('user-joined', {
      rideId: requestId,
      userType: userType,
      socketId: socket.id,
      timestamp: new Date()
    });
  });

  // Handle chat messages - FIXED VERSION
  socket.on('send-message', async (data) => {
    try {
      const { requestId, message, sender, timestamp } = data;
      console.log(`💬 Message from ${sender} in ride ${requestId}:`, message);
      
      // Save message to database
      const rideRequest = await RideRequest.findOne({ requestId });
      if (!rideRequest) {
        socket.emit('error', { message: 'Ride request not found' });
        return;
      }

      // Check if ride is in a state where chat is allowed
      const allowedStatuses = ['matched', 'in_progress', 'completed'];
      if (!allowedStatuses.includes(rideRequest.status)) {
        socket.emit('error', { message: 'Chat is not available for this ride status' });
        return;
      }

      // Create chat message object
      const chatMessage = {
        sender: sender === 'user' ? 'client' : sender, // Convert 'user' to 'client' for database
        message: message.trim(),
        timestamp: new Date(timestamp) || new Date(),
        language: 'english' // Default language, can be dynamic
      };

      // Save to database
      rideRequest.chatMessages.push(chatMessage);
      await rideRequest.save();

      // Get the saved message with ID
      const savedMessage = rideRequest.chatMessages[rideRequest.chatMessages.length - 1];
      
      // Broadcast message to ALL users in the ride room INCLUDING sender for confirmation
      io.to(`ride-${requestId}`).emit('receive-message', {
        message: savedMessage.message,
        sender: sender,
        timestamp: savedMessage.timestamp,
        id: savedMessage._id,
        messageId: savedMessage._id
      });

      console.log(`✅ Message saved and broadcasted for ride ${requestId}`);
      
    } catch (error) {
      console.error('❌ Error handling send-message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators - IMPROVED VERSION
  socket.on('user-typing', (data) => {
    const { requestId, sender } = data;
    console.log(`✍️ ${sender} is typing in ride ${requestId}`);
    
    // Broadcast typing indicator to others in the room (exclude sender)
    socket.to(`ride-${requestId}`).emit('user-typing', {
      requestId,
      sender,
      timestamp: new Date()
    });
  });

  socket.on('user-stopped-typing', (data) => {
    const { requestId, sender } = data;
    console.log(`✋ ${sender} stopped typing in ride ${requestId}`);
    
    // Broadcast stop typing to others in the room (exclude sender)
    socket.to(`ride-${requestId}`).emit('user-stopped-typing', {
      requestId,
      sender,
      timestamp: new Date()
    });
  });

  // Handle ride status updates - IMPROVED VERSION
  socket.on('ride-status-update', async (data) => {
    try {
      const { rideId, status } = data;
      console.log(`🚗 Ride status update for ${rideId}:`, status);
      
      // Update database
      const rideRequest = await RideRequest.findOne({ requestId: rideId });
      if (rideRequest) {
        rideRequest.status = status;
        if (status === 'in_progress' && !rideRequest.rideDetails.startTime) {
          rideRequest.rideDetails = {
            ...rideRequest.rideDetails,
            startTime: new Date()
          };
        }
        await rideRequest.save();
      }
      
      // Broadcast to all users in the ride room
      io.to(`ride-${rideId}`).emit('ride-status-changed', { 
        rideId,
        status,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Error updating ride status:', error);
    }
  });

  // Handle location updates (for future use)
  socket.on('location-update', (data) => {
    const { rideId, latitude, longitude, sender } = data;
    
    // Broadcast location to others in the room
    socket.to(`ride-${rideId}`).emit('location-updated', {
      rideId,
      latitude,
      longitude,
      sender,
      timestamp: new Date()
    });
  });

  // Handle driver payment notifications
  socket.on('driver-payment-received', (data) => {
    const { requestId, amount, calculation, message } = data;
    console.log(`💰 Driver payment notification for ride ${requestId}:`, amount);
    
    // Broadcast payment notification to all users in the ride room
    io.to(`ride-${requestId}`).emit('driver-payment-received', {
      requestId,
      amount,
      calculation,
      message,
      timestamp: new Date()
    });
  });

  // Handle ping/pong for connection health
  socket.on('ping', (callback) => {
    if (typeof callback === 'function') {
      callback('pong');
    }
  });

  // Load chat history when user joins
  socket.on('load-chat-history', async (data) => {
    try {
      const { requestId } = data;
      const rideRequest = await RideRequest.findOne({ requestId })
        .select('chatMessages status')
        .populate('driver', 'name');

      if (rideRequest) {
        socket.emit('chat-history-loaded', {
          requestId,
          messages: rideRequest.chatMessages,
          status: rideRequest.status
        });
      }
    } catch (error) {
      console.error('❌ Error loading chat history:', error);
      socket.emit('error', { message: 'Failed to load chat history' });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 User disconnected:', socket.id, 'Reason:', reason);
    
    // Get session info before removing
    const session = activeSessions.get(socket.id);
    if (session) {
      // Notify others in the room about user leaving
      socket.to(`ride-${session.rideId}`).emit('user-left', {
        rideId: session.rideId,
        userType: session.userType,
        socketId: socket.id,
        timestamp: new Date()
      });
      
      // Remove session
      activeSessions.delete(socket.id);
    }
  });
});

// Make io accessible to routes
app.set('io', io);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/credits', creditRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Cleanup expired ride requests every minute
cron.schedule('* * * * *', cleanupExpiredRequests);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📡 Socket.IO enabled`);
});

module.exports = app;
