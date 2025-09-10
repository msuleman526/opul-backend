# API Testing Guide

Use these examples to test your Opul backend API endpoints.

## 🧪 Testing with cURL

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Driver Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Driver",
    "email": "test@example.com",
    "phone": "+57-300-123-4567",
    "vehicleType": "sedan",
    "vehicleModel": "Toyota Corolla 2021",
    "vehiclePlate": "TEST-123",
    "hourlyRate": 15
  }'
```

### Driver Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

### Create Ride Request
```bash
curl -X POST http://localhost:5000/api/rides/request \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLocation": {
      "address": "Carrera 43A # 11-30, El Poblado, Medellín"
    },
    "duration": 2,
    "clientInfo": {
      "name": "Test Client",
      "phone": "+57-301-234-5678",
      "email": "client@example.com"
    }
  }'
```

### Get Active Rides
```bash
curl http://localhost:5000/api/rides/active
```

### Make Driver Offer (requires auth token)
```bash
curl -X POST http://localhost:5000/api/rides/RIDE_REQUEST_ID/offer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 Testing with Postman

### Import Collection
Create a new Postman collection with these requests:

1. **Health Check**
   - Method: GET
   - URL: `{{baseUrl}}/health`

2. **Driver Registration**
   - Method: POST
   - URL: `{{baseUrl}}/auth/register`
   - Body (JSON):
   ```json
   {
     "name": "John Doe",
     "email": "john@example.com",
     "phone": "+57-300-123-4567",
     "vehicleType": "sedan",
     "vehicleModel": "Honda Civic 2020",
     "vehiclePlate": "ABC-123",
     "hourlyRate": 18
   }
   ```

3. **Create Ride Request**
   - Method: POST
   - URL: `{{baseUrl}}/rides/request`
   - Body (JSON):
   ```json
   {
     "pickupLocation": {
       "address": "Calle 10 # 43B-73, El Poblado, Medellín",
       "latitude": 6.2442,
       "longitude": -75.5812
     },
     "duration": 3,
     "clientInfo": {
       "name": "Maria Garcia",
       "phone": "+57-301-987-6543",
       "email": "maria@example.com"
     }
   }
   ```

### Environment Variables
Set up these variables in Postman:
- `baseUrl`: `http://localhost:5000/api`
- `driverToken`: (will be set after login)

## 🐛 Testing Error Scenarios

### Invalid Pickup Location
```bash
curl -X POST http://localhost:5000/api/rides/request \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLocation": {
      "address": "Invalid Address, Bogotá"
    },
    "duration": 2
  }'
```
Expected: 400 error - "Sorry, we only serve Medellín, Envigado, and Sabaneta"

### Invalid Duration
```bash
curl -X POST http://localhost:5000/api/rides/request \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLocation": {
      "address": "Carrera 43A # 11-30, El Poblado, Medellín"
    },
    "duration": 25
  }'
```
Expected: 400 error - Validation failed

### Duplicate Driver Registration
Register the same driver twice - should get 400 error.

## 🧪 JavaScript Testing in Browser

```javascript
// Test API from browser console
const API_BASE = 'http://localhost:5000/api';

// Test health endpoint
fetch(`${API_BASE}/health`)
  .then(res => res.json())
  .then(data => console.log('Health check:', data));

// Test ride request creation
async function testRideRequest() {
  const response = await fetch(`${API_BASE}/rides/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pickupLocation: {
        address: 'Carrera 43A # 11-30, El Poblado, Medellín'
      },
      duration: 2,
      clientInfo: {
        name: 'Test User',
        phone: '+57-300-123-4567'
      }
    })
  });
  
  const data = await response.json();
  console.log('Ride request:', data);
  return data;
}

// Test driver registration
async function testDriverRegistration() {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Driver',
      email: 'testdriver@example.com',
      phone: '+57-300-111-2222',
      vehicleType: 'sedan',
      vehicleModel: 'Nissan Sentra 2021',
      vehiclePlate: 'TST-456',
      hourlyRate: 20
    })
  });
  
  const data = await response.json();
  console.log('Driver registration:', data);
  return data;
}

// Run tests
testRideRequest();
testDriverRegistration();
```

## 🔄 Socket.IO Testing

```html
<!DOCTYPE html>
<html>
<head>
  <title>Socket.IO Test</title>
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <h1>Socket.IO Test</h1>
  <div id="messages"></div>
  
  <script>
    const socket = io('http://localhost:5000');
    
    socket.on('connect', () => {
      console.log('Connected to server');
      document.getElementById('messages').innerHTML += '<p>Connected!</p>';
    });
    
    socket.on('new-ride-request', (data) => {
      console.log('New ride request:', data);
      document.getElementById('messages').innerHTML += 
        `<p>New ride: ${data.pickupLocation.address}</p>`;
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      document.getElementById('messages').innerHTML += '<p>Disconnected!</p>';
    });
  </script>
</body>
</html>
```

## 📊 Database Testing

Connect to MongoDB and verify data:

```javascript
// MongoDB shell commands
use opul_db

// Check collections
show collections

// View drivers
db.drivers.find().pretty()

// View ride requests
db.riderequests.find().pretty()

// View payments
db.payments.find().pretty()

// Count documents
db.drivers.count()
db.riderequests.count()
```

## 🚀 Load Testing

Simple load test with Apache Bench:

```bash
# Test health endpoint
ab -n 100 -c 10 http://localhost:5000/api/health

# Test ride creation (need to create a data file)
ab -n 50 -c 5 -T application/json -p ride-request.json http://localhost:5000/api/rides/request
```

ride-request.json:
```json
{
  "pickupLocation": {
    "address": "Carrera 43A # 11-30, El Poblado, Medellín"
  },
  "duration": 2,
  "clientInfo": {
    "name": "Load Test User"
  }
}
```

## ✅ Expected Responses

### Successful Ride Request
```json
{
  "success": true,
  "message": "Ride request created successfully",
  "data": {
    "requestId": "RIDE_1693825200000_A1B2C3D4",
    "upfrontFee": 9,
    "expiresAt": "2023-09-04T15:15:00.000Z",
    "status": "pending"
  }
}
```

### Successful Driver Registration
```json
{
  "success": true,
  "message": "Driver registered successfully",
  "data": {
    "driver": {
      "id": "64f5a1b2c3d4e5f6g7h8i9j0",
      "name": "John Doe",
      "email": "john@example.com",
      "vehicleType": "sedan",
      "hourlyRate": 18,
      "isVerified": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## 🐛 Common Issues

1. **CORS Error**: Make sure FRONTEND_URL is set correctly in .env
2. **MongoDB Connection**: Verify MongoDB is running and URI is correct
3. **PayPal Errors**: Check PayPal credentials and mode (sandbox/live)
4. **Socket.IO Issues**: Ensure client-side Socket.IO version matches server
5. **JWT Errors**: Check JWT_SECRET is set and tokens are being sent correctly

## 📝 Testing Checklist

- [ ] Health endpoint responds
- [ ] Driver registration works
- [ ] Driver login returns token
- [ ] Ride request creation works
- [ ] Colombian address validation works
- [ ] Driver offers system works
- [ ] Chat messages save and load
- [ ] Socket.IO events fire correctly
- [ ] PayPal integration works
- [ ] Error handling works properly
- [ ] Database operations complete successfully
- [ ] Frontend integration works