# Frontend Integration Guide

This guide shows how to integrate your existing HTML/CSS/JS frontend with the Opul backend API.

## 📱 Role Selection Integration

Update your frontend to include role selection:

```html
<!-- Add to Index.html before the ride request form -->
<div class="role-selection">
  <h2>Choose Your Role</h2>
  <button class="role-button" onclick="selectRole('client')">
    🚗 I need a ride (Client)
  </button>
  <button class="role-button" onclick="selectRole('driver')">
    🚙 I want to drive (Driver)
  </button>
</div>

<script>
function selectRole(role) {
  if (role === 'client') {
    // Show existing ride request form
    document.querySelector('.ride-request-form').style.display = 'block';
  } else if (role === 'driver') {
    // Redirect to driver registration/login
    window.location.href = 'driver-portal.html';
  }
}
</script>
```

## 🚗 Client (Rider) Integration

### 1. Update Index.html Ride Request

```javascript
// Replace the existing requestRideBtn click handler
requestRideBtn.addEventListener('click', async function() {
  const address = addressInput.value.trim();
  const duration = parseInt(timeSelect.value);

  if (!address || !duration) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

  try {
    // Create ride request
    const response = await fetch('http://localhost:5000/api/rides/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pickupLocation: {
          address: address,
          latitude: null, // Add geolocation if available
          longitude: null
        },
        duration: duration,
        clientInfo: {
          name: prompt('Your name (optional):') || 'Anonymous',
          phone: prompt('Your phone (optional):') || '',
          email: prompt('Your email (optional):') || ''
        }
      })
    });

    const data = await response.json();

    if (data.success) {
      // Redirect to payment page
      window.location.href = `payment.html?requestId=${data.data.requestId}&amount=${data.data.upfrontFee}`;
    } else {
      showMessage(data.message, 'error');
    }
  } catch (error) {
    showMessage('Network error. Please try again.', 'error');
  }
});
```

## 🚙 Driver Integration

### Driver Dashboard JavaScript

```javascript
async function loginDriver() {
  const email = document.getElementById('login-email').value;
  const vehiclePlate = document.getElementById('login-plate').value;

  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, vehiclePlate })
    });

    const data = await response.json();
    if (data.success) {
      localStorage.setItem('driverToken', data.data.token);
      localStorage.setItem('driverInfo', JSON.stringify(data.data.driver));
      window.location.href = 'driver-dashboard.html';
    } else {
      alert('Login failed: ' + data.message);
    }
  } catch (error) {
    alert('Network error');
  }
}

// Load active ride requests for drivers
async function loadActiveRides() {
  try {
    const response = await fetch('http://localhost:5000/api/rides/active');
    const data = await response.json();
    
    if (data.success) {
      displayActiveRides(data.data);
    }
  } catch (error) {
    console.error('Error loading rides:', error);
  }
}

function displayActiveRides(rides) {
  const container = document.getElementById('active-rides');
  container.innerHTML = '';

  rides.forEach(ride => {
    const rideCard = document.createElement('div');
    rideCard.className = 'ride-card';
    rideCard.innerHTML = `
      <h3>Ride Request</h3>
      <p><strong>Pickup:</strong> ${ride.pickupLocation.address}</p>
      <p><strong>Duration:</strong> ${ride.duration} hours</p>
      <p><strong>Fee:</strong> $${ride.upfrontFee}</p>
      <button onclick="makeOffer('${ride.requestId}')">Make Offer</button>
    `;
    container.appendChild(rideCard);
  });
}

async function makeOffer(requestId) {
  const token = localStorage.getItem('driverToken');
  
  try {
    const response = await fetch(`http://localhost:5000/api/rides/${requestId}/offer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (data.success) {
      alert('Offer submitted successfully!');
      loadActiveRides(); // Refresh the list
    } else {
      alert('Failed to submit offer: ' + data.message);
    }
  } catch (error) {
    alert('Network error');
  }
}
```

## 💬 Chat Integration

### Update Chat.html with Backend Integration

```javascript
// Add to the existing chat.js
const API_BASE = 'http://localhost:5000/api';
const requestId = new URLSearchParams(window.location.search).get('requestId');
const socket = io('http://localhost:5000');

// Join ride room
socket.emit('join-ride', requestId);

// Load existing messages
async function loadChatMessages() {
  try {
    const response = await fetch(`${API_BASE}/chat/${requestId}/messages`);
    const data = await response.json();
    
    if (data.success) {
      data.data.messages.forEach(msg => {
        addMessage(msg.message, msg.sender === 'client' ? 'sent' : 'received', msg.sender);
      });
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

// Send message to backend
async function sendMessage(message, sender) {
  try {
    const response = await fetch(`${API_BASE}/chat/${requestId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        sender: sender, // 'client' or 'driver'
        language: currentLanguage
      })
    });

    const data = await response.json();
    if (!data.success) {
      console.error('Failed to send message:', data.message);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Listen for new messages
socket.on('new-chat-message', (data) => {
  if (data.requestId === requestId) {
    const messageType = data.message.sender === 'client' ? 'sent' : 'received';
    addMessage(data.message.message, messageType, data.message.sender);
  }
});

// Update the message form handler
messageForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const message = messageInput.value.trim();
  
  if (message) {
    addMessage(message, 'sent', 'client');
    sendMessage(message, 'client'); // Send to backend
    messageInput.value = '';
    messageInput.style.height = '48px';
  }
});

// Ride control integration
async function startRide() {
  const token = localStorage.getItem('driverToken');
  
  try {
    const response = await fetch(`${API_BASE}/rides/${requestId}/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (data.success) {
      rideInProgress = true;
      rideStartTime = new Date().toISOString();
      updateRideButton();
      addMessage("🚗 Ride has started! Have a safe trip!", 'system', 'System');
    } else {
      alert('Failed to start ride: ' + data.message);
    }
  } catch (error) {
    alert('Network error');
  }
}

async function endRide() {
  const token = localStorage.getItem('driverToken');
  
  try {
    const response = await fetch(`${API_BASE}/rides/${requestId}/end`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (data.success) {
      rideInProgress = false;
      updateRideButton();
      addMessage(`🏁 Ride completed! Final cost: $${data.data.rideDetails.finalCost}`, 'system', 'System');
      
      // Show final payment option
      showFinalPaymentOption(data.data.rideDetails.finalCost);
    } else {
      alert('Failed to end ride: ' + data.message);
    }
  } catch (error) {
    alert('Network error');
  }
}

function showFinalPaymentOption(amount) {
  const paymentDiv = document.createElement('div');
  paymentDiv.className = 'final-payment';
  paymentDiv.innerHTML = `
    <h3>Final Payment Required</h3>
    <p>Total Amount: $${amount}</p>
    <button onclick="processFinalPayment(${amount})">Pay Now</button>
  `;
  document.body.appendChild(paymentDiv);
}

async function processFinalPayment(amount) {
  const token = localStorage.getItem('driverToken');
  
  try {
    const response = await fetch(`${API_BASE}/payments/final-payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestId: requestId,
        paymentMethod: 'paypal'
      })
    });

    const data = await response.json();
    if (data.success) {
      // Redirect to PayPal
      window.open(data.data.approvalUrl, '_blank');
    } else {
      alert('Failed to create payment: ' + data.message);
    }
  } catch (error) {
    alert('Network error');
  }
}

// Listen for ride status updates
socket.on('ride-started', (data) => {
  if (data.requestId === requestId) {
    addMessage("🚗 Driver has started the ride!", 'system', 'System');
  }
});

socket.on('ride-completed', (data) => {
  if (data.requestId === requestId) {
    addMessage(`🏁 Ride completed! Duration: ${data.actualDuration} hours`, 'system', 'System');
  }
});

// Load messages when page loads
document.addEventListener('DOMContentLoaded', function() {
  loadChatMessages();
});
```

## 🔄 Real-time Updates

### Socket.IO Integration

```javascript
// Add to your main JavaScript files
const socket = io('http://localhost:5000');

// For drivers - listen for new ride requests
socket.on('new-ride-request', (data) => {
  // Show notification or update ride list
  showNotification(`New ride request: ${data.pickupLocation.address}`);
  loadActiveRides(); // Refresh ride list
});

// For clients - listen for driver offers
socket.on('new-driver-offer', (data) => {
  if (data.requestId === currentRequestId) {
    showNotification(`New driver offer from ${data.driver.name}`);
    loadDriverOffers(); // Refresh driver list
  }
});

// For both - listen for ride status changes
socket.on('ride-status-changed', (data) => {
  updateRideStatus(data.status);
});

function showNotification(message) {
  // Create and show notification
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}
```

## 🎨 CSS Updates

### Add styles for new components

```css
/* Role selection */
.role-selection {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 20px 0;
}

.role-button {
  padding: 20px;
  font-size: 18px;
  border: 2px solid #00f0ff;
  background: rgba(11, 12, 42, 0.8);
  color: #00f0ff;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.role-button:hover {
  background: rgba(0, 240, 255, 0.1);
  transform: translateY(-2px);
}

/* Driver cards */
.driver-card, .ride-card {
  background: rgba(11, 12, 42, 0.8);
  border: 1px solid #00f0ff;
  border-radius: 12px;
  padding: 20px;
  margin: 10px 0;
  transition: all 0.3s ease;
}

.driver-card:hover, .ride-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.3);
}

/* Notifications */
.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: linear-gradient(135deg, #00f0ff, #a18cd1);
  color: white;
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.5);
  z-index: 1000;
  animation: slideIn 0.3s ease-out;
}

/* Final payment */
.final-payment {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(11, 12, 42, 0.95);
  border: 2px solid #00f0ff;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  z-index: 1000;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

## 🔗 API Endpoints Quick Reference

### Client Endpoints
- `POST /api/rides/request` - Create ride request
- `GET /api/rides/:requestId` - Get ride details
- `POST /api/rides/:requestId/accept/:driverId` - Accept driver
- `POST /api/rides/:requestId/cancel` - Cancel ride

### Driver Endpoints  
- `POST /api/auth/register` - Driver registration
- `POST /api/auth/login` - Driver login
- `GET /api/rides/active` - Get active rides
- `POST /api/rides/:requestId/offer` - Make offer
- `POST /api/rides/:requestId/start` - Start ride
- `POST /api/rides/:requestId/end` - End ride

### Payment Endpoints
- `POST /api/payments/create-order` - Create PayPal order
- `POST /api/payments/capture-order` - Capture payment
- `POST /api/payments/final-payment` - Final payment

### Chat Endpoints
- `GET /api/chat/:requestId/messages` - Get messages
- `POST /api/chat/:requestId/messages` - Send message

## 🚀 Getting Started

1. **Start the backend:**
```bash
cd opul-backend
npm run dev
```

2. **Update your frontend files** with the integration code above

3. **Test the flow:**
   - Create ride request → Payment → Driver offers → Accept → Chat → Complete

4. **Configure PayPal:**
   - Get PayPal sandbox credentials
   - Update .env file
   - Test payments

## 📱 Mobile Responsiveness

The existing CSS should work well, but you may want to add:

```css
@media (max-width: 768px) {
  .role-selection {
    padding: 10px;
  }
  
  .driver-card, .ride-card {
    padding: 15px;
    margin: 8px 0;
  }
  
  .notification {
    top: 10px;
    right: 10px;
    left: 10px;
    right: 10px;
  }
}
```

This integration maintains your beautiful design while adding full backend functionality!