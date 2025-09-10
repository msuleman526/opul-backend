const mongoose = require('mongoose');

// Test database connection
const testConnection = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opul_db');
    console.log('✅ MongoDB connection successful!');
    
    // Test basic operations
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📊 Database has ${collections.length} collections`);
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// Test PayPal configuration
const testPayPal = () => {
  const required = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.log('⚠️  PayPal configuration incomplete:');
    missing.forEach(key => console.log(`   - ${key} is missing`));
    console.log('   PayPal payments will not work until these are set');
  } else {
    console.log('✅ PayPal configuration complete');
  }
};

// Test environment configuration
const testEnvironment = () => {
  console.log('🔧 Environment Configuration:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   PORT: ${process.env.PORT || 5000}`);
  console.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`   OPUL_FEE_PERCENTAGE: ${process.env.OPUL_FEE_PERCENTAGE || 10}%`);
  
  if (!process.env.JWT_SECRET) {
    console.log('⚠️  JWT_SECRET is not set - generate one for security');
  } else {
    console.log('✅ JWT_SECRET is configured');
  }
};

const runTests = async () => {
  require('dotenv').config();
  
  console.log('🧪 Running Opul Backend Tests...\n');
  
  testEnvironment();
  console.log('');
  testPayPal();
  console.log('');
  await testConnection();
  
  console.log('\n🎉 All tests completed!');
};

runTests();
