// test-chat-realtime.js - Create this file in your backend directory for testing

const io = require('socket.io-client');

// Configuration
const SOCKET_URL = 'http://localhost:5000';
const TEST_REQUEST_ID = 'test_ride_123';

function createTestClient(userType, userName) {
  console.log(`\n🔌 Creating ${userType} client: ${userName}`);
  
  const socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    forceNew: true
  });

  socket.on('connect', () => {
    console.log(`✅ ${userName} connected to server`);
    
    // Join the test ride room
    socket.emit('join-ride', {
      requestId: TEST_REQUEST_ID,
      userType: userType
    });
  });

  socket.on('disconnect', () => {
    console.log(`❌ ${userName} disconnected`);
  });

  socket.on('receive-message', (data) => {
    console.log(`📨 ${userName} received:`, {
      from: data.sender,
      message: data.message,
      timestamp: new Date(data.timestamp).toLocaleTimeString()
    });
  });

  socket.on('user-joined', (data) => {
    console.log(`👋 ${userName} sees: ${data.userType} joined the room`);
  });

  socket.on('user-typing', (data) => {
    console.log(`✍️ ${userName} sees: ${data.sender} is typing...`);
  });

  socket.on('user-stopped-typing', (data) => {
    console.log(`✋ ${userName} sees: ${data.sender} stopped typing`);
  });

  socket.on('error', (error) => {
    console.error(`❌ ${userName} error:`, error);
  });

  return {
    socket,
    name: userName,
    userType,
    
    sendMessage: (message) => {
      console.log(`📤 ${userName} sending: "${message}"`);
      socket.emit('send-message', {
        requestId: TEST_REQUEST_ID,
        message: message,
        sender: userType === 'user' ? 'user' : 'driver',
        timestamp: new Date().toISOString()
      });
    },
    
    startTyping: () => {
      socket.emit('user-typing', {
        requestId: TEST_REQUEST_ID,
        sender: userType === 'user' ? 'user' : 'driver'
      });
    },
    
    stopTyping: () => {
      socket.emit('user-stopped-typing', {
        requestId: TEST_REQUEST_ID,
        sender: userType === 'user' ? 'user' : 'driver'
      });
    },
    
    disconnect: () => {
      socket.disconnect();
    }
  };
}

// Test sequence
function runChatTest() {
  console.log('🚀 Starting real-time chat test...');
  console.log(`📋 Test Ride ID: ${TEST_REQUEST_ID}`);
  
  // Create test clients
  const customer = createTestClient('user', 'Customer Alice');
  const driver = createTestClient('driver', 'Driver Bob');
  
  // Wait for connections and run test sequence
  setTimeout(() => {
    console.log('\n🧪 Running test sequence...');
    
    // Test 1: Customer sends message
    setTimeout(() => {
      customer.sendMessage('Hello! I\'m ready for pickup');
    }, 1000);
    
    // Test 2: Driver typing indicator
    setTimeout(() => {
      driver.startTyping();
    }, 2000);
    
    // Test 3: Driver stops typing and sends message
    setTimeout(() => {
      driver.stopTyping();
      driver.sendMessage('On my way! ETA 5 minutes');
    }, 3000);
    
    // Test 4: Customer typing
    setTimeout(() => {
      customer.startTyping();
    }, 4000);
    
    // Test 5: Customer sends another message
    setTimeout(() => {
      customer.stopTyping();
      customer.sendMessage('Perfect! I\'ll be waiting outside');
    }, 5000);
    
    // Test 6: Driver confirms
    setTimeout(() => {
      driver.sendMessage('Great! I can see you now 👋');
    }, 6000);
    
    // Cleanup
    setTimeout(() => {
      console.log('\n🧹 Cleaning up test clients...');
      customer.disconnect();
      driver.disconnect();
      
      console.log('✅ Test completed!');
      process.exit(0);
    }, 8000);
    
  }, 2000);
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
  process.exit(1);
});

// Start the test
runChatTest();