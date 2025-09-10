// Test script to debug the payment creation request
require('dotenv').config();

console.log('🧪 Testing Payment Order Creation API');
console.log('=====================================\n');

const requestData = {
  requestId: 'test-123',
  amount: 15.00,
  currency: 'USD',
  paymentMethod: 'stripe'
};

console.log('Request Data:', JSON.stringify(requestData, null, 2));

// Test with the actual fetch request
async function testPaymentOrder() {
  try {
    console.log('\n📡 Making API call to /payments/create-order...');
    
    const response = await fetch('http://localhost:5000/api/payments/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    const data = await response.json();
    
    console.log('\n📥 Response Status:', response.status);
    console.log('📥 Response Data:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.log('\n❌ Request failed!');
      if (data.errors) {
        console.log('Validation Errors:');
        data.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }
    } else {
      console.log('\n✅ Request successful!');
    }
    
  } catch (error) {
    console.log('\n💥 Network Error:', error.message);
    console.log('Make sure your backend server is running on http://localhost:5000');
  }
}

// Test different payment methods
async function testAllPaymentMethods() {
  const paymentMethods = ['paypal', 'stripe', 'credit_card'];
  
  for (const method of paymentMethods) {
    console.log(`\n🧪 Testing payment method: ${method}`);
    console.log('='.repeat(40));
    
    const testData = { ...requestData, paymentMethod: method };
    
    try {
      const response = await fetch('http://localhost:5000/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${method}: SUCCESS`);
      } else {
        console.log(`❌ ${method}: FAILED - ${data.message}`);
        if (data.errors) {
          console.log(`   Errors: ${data.errors.join(', ')}`);
        }
      }
    } catch (error) {
      console.log(`💥 ${method}: NETWORK ERROR - ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Run tests
console.log('Starting payment validation tests...\n');
testAllPaymentMethods();
