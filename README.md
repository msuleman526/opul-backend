# Opul Backend API

A Node.js backend for the Opul ride-sharing platform with MongoDB, Socket.IO for real-time communication, and PayPal integration.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- MongoDB (local or cloud)
- PayPal Developer Account

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Environment Setup:**
```bash
cp .env.example .env
```
Edit `.env` with your configuration:
- MongoDB URI
- PayPal credentials
- JWT secret
- Other settings

3. **Start MongoDB:**
```bash
# If using local MongoDB
mongod
```

4. **Run the server:**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:5000`

## 📡 API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /register` - Driver registration
- `POST /login` - Driver login
- `POST /logout` - Driver logout

### Ride Routes (`/api/rides`)
- `POST /request` - Create ride request (Client)
- `GET /active` - Get active ride requests
- `GET /:requestId` - Get ride details
- `POST /:requestId/offer` - Driver makes offer
- `POST /:requestId/accept/:driverId` - Client accepts driver
- `POST /:requestId/start` - Start ride (Driver)
- `POST /:requestId/end` - End ride (Driver)
- `POST /:requestId/cancel` - Cancel ride

### Driver Routes (`/api/drivers`)
- `GET /available` - Get available drivers
- `GET /profile/:driverId` - Get driver profile
- `PUT /profile` - Update driver profile
- `PUT /location` - Update driver location
- `PUT /availability` - Toggle availability
- `PUT /online` - Toggle online status
- `GET /dashboard` - Get driver dashboard

### Payment Routes (`/api/payments`)
- `POST /create-order` - Create PayPal order
- `POST /capture-order` - Capture PayPal payment
- `POST /final-payment` - Process final payment
- `GET /credits/:clientEmail` - Get user credits
- `POST /credits/add` - Add credits
- `POST /credits/use` - Use credits
- `GET /history/:requestId` - Payment history

### Chat Routes (`/api/chat`)
- `GET /:requestId/messages` - Get chat messages
- `POST /:requestId/messages` - Send message
- `PUT /:requestId/messages/read` - Mark as read
- `GET /:requestId/stats` - Chat statistics
- `GET /:requestId/export` - Export chat log

## 🔄 Real-time Events (Socket.IO)

### Client Events
- `new-ride-request` - New ride request created
- `new-driver-offer` - Driver made an offer
- `ride-accepted` - Client accepted driver
- `ride-rejected` - Driver offer rejected
- `ride-started` - Ride started
- `ride-completed` - Ride completed
- `ride-cancelled` - Ride cancelled
- `new-chat-message` - New chat message
- `messages-read` - Messages marked as read

### Server Events
- `join-ride` - Join ride room
- `send-message` - Send chat message
- `ride-status-update` - Update ride status

## 📊 Database Models

### Driver
- Personal info (name, email, phone)
- Vehicle details (type, model, plate)
- Location and availability
- Ratings and earnings

### RideRequest
- Pickup location and duration
- Payment status and amounts
- Driver offers and matching
- Chat messages
- Ride timeline

### Payment
- Payment details and status
- PayPal integration data
- Fee calculations
- Transaction history

### UserCredit
- Client credit balance
- Credit transaction history
- Refund management

## 🔧 Configuration

### Environment Variables
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/opul_db
JWT_SECRET=your_jwt_secret
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox
FRONTEND_URL=http://localhost:3000
OPUL_FEE_PERCENTAGE=10
```

### PayPal Setup
1. Create PayPal Developer Account
2. Create app in PayPal Dashboard
3. Get Client ID and Secret
4. Set mode to 'sandbox' for testing

## 🏗️ Project Structure
```
opul-backend/
├── models/           # MongoDB schemas
├── routes/           # API route handlers
├── middleware/       # Custom middleware
├── utils/           # Helper functions
├── controllers/     # Request controllers
├── server.js        # Main server file
├── package.json     # Dependencies
└── .env.example     # Environment template
```

## 🧪 Testing

```bash
# Run tests
npm test

# Test specific route
curl http://localhost:5000/api/health
```

## 🚀 Deployment

1. **Production Environment:**
```bash
NODE_ENV=production
```

2. **MongoDB Atlas:**
Update `MONGODB_URI` with Atlas connection string

3. **PayPal Live Mode:**
```bash
PAYPAL_MODE=live
```

## 🔄 Data Flow

1. **Client Flow:**
   - Create ride request → Pay upfront fee → Get driver offers → Accept driver → Chat → Complete ride

2. **Driver Flow:**
   - Register/Login → See active requests → Make offers → Get accepted → Start ride → Chat → End ride

3. **Payment Flow:**
   - Upfront fee (PayPal) → Ride completion → Final payment → Fee distribution

## 🛡️ Security Features

- JWT authentication for drivers
- Request validation and sanitization
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation with express-validator

## 📱 Integration with Frontend

The backend is designed to work with the existing HTML/CSS/JS frontend:
- RESTful API endpoints
- Real-time Socket.IO communication
- PayPal SDK integration
- Colombian address validation

## 🔍 Monitoring

- Request logging with Morgan
- Error handling middleware
- Health check endpoint
- Database connection monitoring

## 📝 API Response Format

```json
{
  "success": boolean,
  "message": "string",
  "data": object | array,
  "errors": array (optional)
}
```

## 🚨 Error Handling

All routes use async error handling with proper HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Server Error

## 🔄 Real-time Features

- Live ride tracking
- Instant chat messaging
- Driver availability updates
- Payment status updates
- Ride request notifications