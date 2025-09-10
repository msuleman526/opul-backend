const { v4: uuidv4 } = require('uuid');

// Generate unique ride request ID
const generateRequestId = () => {
  const timestamp = Date.now();
  const randomId = uuidv4().slice(0, 8);
  return `RIDE_${timestamp}_${randomId.toUpperCase()}`;
};

// Generate unique payment ID
const generatePaymentId = () => {
  const timestamp = Date.now();
  const randomId = uuidv4().slice(0, 8);
  return `PAY_${timestamp}_${randomId.toUpperCase()}`;
};

// Calculate distance between two points (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
};

const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

// Format currency
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

// Validate Colombian addresses
const isValidColombianAddress = (address) => {
  const colombianCities = ['medellín', 'medellin', 'envigado', 'sabaneta'];
  const addressLower = address.toLowerCase();
  return colombianCities.some(city => addressLower.includes(city));
};

// Calculate upfront fee (you can customize this logic)
const calculateUpfrontFee = (duration, baseRate = 5) => {
  // Base fee of $5 + $2 per hour
  return baseRate + (duration * 2);
};

// Parse Colombian address components
const parseColombianAddress = (address) => {
  const patterns = {
    carrera: /carrera\s+(\d+[a-z]?)/i,
    calle: /calle\s+(\d+[a-z]?)/i,
    number: /#\s*(\d+[a-z]?[-\d]*)/i,
    interior: /interior\s+(\d+)/i,
    apto: /apto\s+(\d+)/i,
    local: /local\s+(\d+)/i,
    city: /(medellín|medellin|envigado|sabaneta)/i
  };

  const parsed = {};
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = address.match(pattern);
    if (match) {
      parsed[key] = match[1] || match[0];
    }
  }

  return parsed;
};

module.exports = {
  generateRequestId,
  generatePaymentId,
  calculateDistance,
  formatCurrency,
  isValidColombianAddress,
  calculateUpfrontFee,
  parseColombianAddress
};
