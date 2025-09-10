#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Opul Backend Setup Script\n');

// Step 1: Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('📝 Creating .env file from template...');
  fs.copyFileSync('.env.example', '.env');
  console.log('✅ .env file created');
  console.log('⚠️  Please edit .env file with your configuration before continuing\n');
} else {
  console.log('✅ .env file already exists\n');
}

// Step 2: Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed\n');
} catch (error) {
  console.error('❌ Failed to install dependencies');
  process.exit(1);
}

// Step 3: Test configuration
console.log('🧪 Testing configuration...');
try {
  execSync('node test-setup.js', { stdio: 'inherit' });
  console.log('');
} catch (error) {
  console.error('❌ Configuration test failed');
  console.log('Please check your .env file and MongoDB connection\n');
}

// Step 4: Offer to seed database
console.log('🌱 Database Seeding Options:');
console.log('   To seed sample data: npm run seed');
console.log('   To start development: npm run dev');
console.log('   To start production: npm start\n');

console.log('📋 Next Steps:');
console.log('1. Edit .env file with your MongoDB URI and PayPal credentials');
console.log('2. Start MongoDB if running locally');
console.log('3. Run: npm run seed (to add sample drivers)');
console.log('4. Run: npm run dev (to start development server)');
console.log('5. Test API at: http://localhost:5000/api/health\n');

console.log('🎉 Setup complete! Happy coding!');
