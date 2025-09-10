require('dotenv').config();

console.log('🔧 Stripe Configuration Test\n');

// Check environment variables
console.log('Environment Variables:');
console.log('- STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing');
console.log('- STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY ? '✅ Set' : '❌ Missing');
console.log('- STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing');

if (!process.env.STRIPE_SECRET_KEY) {
  console.log('\n❌ STRIPE_SECRET_KEY is missing!');
  console.log('Please add your Stripe secret key to the .env file');
  console.log('Get it from: https://dashboard.stripe.com/test/apikeys');
  process.exit(1);
}

if (!process.env.STRIPE_PUBLISHABLE_KEY) {
  console.log('\n❌ STRIPE_PUBLISHABLE_KEY is missing!');
  console.log('Please add your Stripe publishable key to the .env file');
  console.log('Get it from: https://dashboard.stripe.com/test/apikeys');
  process.exit(1);
}

// Test Stripe connection
console.log('\n🧪 Testing Stripe Connection...');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testStripeConnection() {
  try {
    // Test API connection
    const account = await stripe.accounts.retrieve();
    console.log('✅ Stripe connection successful!');
    console.log(`   Account ID: ${account.id}`);
    console.log(`   Country: ${account.country}`);
    console.log(`   Currency: ${account.default_currency}`);

    // Test creating a checkout session
    console.log('\n🧪 Testing Checkout Session Creation...');
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Test Opul Ride',
            },
            unit_amount: 1000, // $10.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel',
    });

    console.log('✅ Checkout session created successfully!');
    console.log(`   Session ID: ${session.id}`);
    console.log(`   Checkout URL: ${session.url}`);

    console.log('\n🎉 All Stripe tests passed! Your configuration is working.');

  } catch (error) {
    console.log('❌ Stripe connection failed!');
    console.log('Error:', error.message);

    if (error.type === 'StripeAuthenticationError') {
      console.log('\n💡 This usually means your API key is invalid.');
      console.log('   - Check your STRIPE_SECRET_KEY in .env file');
      console.log('   - Make sure it starts with sk_test_ for test mode');
      console.log('   - Get the correct key from: https://dashboard.stripe.com/test/apikeys');
    }
  }
}

testStripeConnection();
