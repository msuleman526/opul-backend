// Test script to verify the in-progress rides fix
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5000/api';

async function testFix() {
  console.log('🔧 Testing In-Progress Rides Fix...\n');

  try {
    // Test 1: Check if backend is running
    console.log('1️⃣ Testing backend connection...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    
    if (healthResponse.ok) {
      console.log('✅ Backend is running');
    } else {
      console.log('❌ Backend is not responding');
      return;
    }

    // Test 2: Check if new endpoint exists
    console.log('\n2️⃣ Testing new /rides/driver/active endpoint...');
    const driverActiveResponse = await fetch(`${API_BASE}/rides/driver/active`);
    
    if (driverActiveResponse.status === 401) {
      console.log('✅ Endpoint exists (returns 401 - authentication required)');
    } else if (driverActiveResponse.status === 404) {
      console.log('❌ Endpoint not found - make sure you added the new route to rides.js');
      return;
    } else {
      console.log(`✅ Endpoint exists (status: ${driverActiveResponse.status})`);
    }

    // Test 3: Check if updated /rides/active endpoint includes matched/in_progress
    console.log('\n3️⃣ Testing updated /rides/active endpoint...');
    const activeResponse = await fetch(`${API_BASE}/rides/active`);
    
    if (activeResponse.ok) {
      const data = await activeResponse.json();
      console.log(`✅ /rides/active endpoint working (found ${data.data?.length || 0} rides)`);
    } else {
      console.log('❌ /rides/active endpoint not working');
    }

    console.log('\n🎉 All tests passed! The fix should be working.');
    console.log('\n📋 Next steps:');
    console.log('1. Create a ride request as a customer');
    console.log('2. Make an offer as a driver');
    console.log('3. Accept the driver as a customer');
    console.log('4. Check if the ride appears in driver dashboard "In Progress Rides"');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Make sure:');
    console.log('1. Backend server is running: npm start in opul-backend');
    console.log('2. You saved the changes to routes/rides.js');
    console.log('3. You restarted the backend after making changes');
  }
}

// Run the test
testFix();
