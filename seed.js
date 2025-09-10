const mongoose = require('mongoose');
require('dotenv').config();

// Sample data for testing
const sampleDrivers = [
  {
    name: "Carlos Rodriguez",
    email: "carlos@example.com",
    phone: "+57-300-123-4567",
    vehicleType: "sedan",
    vehicleModel: "Toyota Corolla 2020",
    vehiclePlate: "ABC-123",
    hourlyRate: 15,
    location: {
      latitude: 6.2442,
      longitude: -75.5812,
      address: "El Poblado, Medellín"
    },
    isAvailable: true,
    isOnline: true,
    rating: 4.8,
    isVerified: true
  },
  {
    name: "Maria Gonzalez",
    email: "maria@example.com",
    phone: "+57-301-234-5678",
    vehicleType: "suv",
    vehicleModel: "Chevrolet Captiva 2019",
    vehiclePlate: "DEF-456",
    hourlyRate: 20,
    location: {
      latitude: 6.2518,
      longitude: -75.5636,
      address: "Laureles, Medellín"
    },
    isAvailable: true,
    isOnline: true,
    rating: 4.9,
    isVerified: true
  },
  {
    name: "Juan Perez",
    email: "juan@example.com", 
    phone: "+57-302-345-6789",
    vehicleType: "truck",
    vehicleModel: "Ford Ranger 2021",
    vehiclePlate: "GHI-789",
    hourlyRate: 25,
    location: {
      latitude: 6.1701,
      longitude: -75.5906,
      address: "Envigado Centro"
    },
    isAvailable: true,
    isOnline: false,
    rating: 4.7,
    isVerified: true
  }
];

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opul_db');
    console.log('✅ Connected to MongoDB');

    const Driver = require('./models/Driver');

    // Clear existing drivers
    await Driver.deleteMany({});
    console.log('🧹 Cleared existing drivers');

    // Insert sample drivers
    const drivers = await Driver.insertMany(sampleDrivers);
    console.log(`📊 Inserted ${drivers.length} sample drivers`);

    console.log('\n📋 Sample Drivers Created:');
    drivers.forEach(driver => {
      console.log(`- ${driver.name} (${driver.vehicleType}) - $${driver.hourlyRate}/hr`);
    });

    console.log('\n✅ Database seeded successfully!');
    console.log('\n🚀 You can now:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Test driver login with any email above');
    console.log('3. Create ride requests from the frontend');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the seeder
seedDatabase();
