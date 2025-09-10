# Stripe Setup Guide for Opul

## 🚨 Issue: Stripe Not Available

Your Stripe integration is installed but missing API keys. Follow these steps to fix it:

## Step 1: Get Stripe Test Keys

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/
2. **Create account** if you don't have one (free)
3. **Switch to Test Mode** (toggle in left sidebar)
4. **Go to Developers → API Keys**
5. **Copy the following keys:**
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

## Step 2: Update Your Environment File

Replace the placeholder values in your `.env` file:

```env
# Replace these with your actual Stripe test keys
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Step 3: Test the Configuration

1. **Restart your backend server:**
   ```bash
   cd D:\Sulemans-WorkSpace\Other\Opul\opul-backend
   npm run dev
   ```

2. **Test the Stripe config endpoint:**
   ```bash
   curl http://localhost:5000/api/payments/stripe-config
   ```

   Should return:
   ```json
   {
     "success": true,
     "data": {
       "publishableKey": "pk_test_..."
     }
   }
   ```

## Step 4: Test Payment Flow

1. **Open your frontend**: http://localhost:3000
2. **Create a ride request**
3. **Go to payment page**
4. **Select "Card" payment method**
5. **Click "Pay with Card"**

## Step 5: Webhook Setup (Optional for Development)

For production, you'll need to set up webhooks:

1. **Go to Stripe Dashboard → Developers → Webhooks**
2. **Add endpoint**: `https://yourdomain.com/api/payments/webhook/stripe`
3. **Select events**: `checkout.session.completed`, `payment_intent.payment_failed`
4. **Copy webhook secret** to `STRIPE_WEBHOOK_SECRET`

## Test Cards for Development

Use these test card numbers:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Auth**: `4000 0025 0000 3155`

**Expiry**: Any future date  
**CVC**: Any 3 digits  
**ZIP**: Any valid zip code

## Quick Fix Command

Run this command to quickly test if Stripe is working:

```bash
# Test if your backend can reach Stripe
node -e "
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
stripe.customers.list({limit: 1})
  .then(() => console.log('✅ Stripe connection successful'))
  .catch(err => console.log('❌ Stripe error:', err.message))
"
```

## Current Issue Summary

Your code is **100% correct** - you just need to:
1. Get Stripe test keys from dashboard
2. Add them to your `.env` file 
3. Restart your server

The "Stripe is not available" error happens because `process.env.STRIPE_PUBLISHABLE_KEY` is undefined.
