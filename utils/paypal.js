const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');

// PayPal environment setup
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (process.env.PAYPAL_MODE === 'live') {
    return new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret);
  } else {
    return new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);
  }
}

// PayPal client
function client() {
  return new checkoutNodeJssdk.core.PayPalHttpClient(environment());
}

// Create PayPal order
const createPayPalOrder = async (amount, currency = 'USD', description = 'Opul Ride Service') => {
  const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: currency,
        value: amount.toFixed(2)
      },
      description: description
    }],
    application_context: {
      brand_name: 'Opul',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
      return_url: `${process.env.FRONTEND_URL}/payment/success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
    }
  });

  try {
    const order = await client().execute(request);
    return {
      success: true,
      orderId: order.result.id,
      approvalUrl: order.result.links.find(link => link.rel === 'approve').href
    };
  } catch (error) {
    console.error('PayPal create order error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Capture PayPal order
const capturePayPalOrder = async (orderId) => {
  const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});

  try {
    const capture = await client().execute(request);
    return {
      success: true,
      captureId: capture.result.id,
      status: capture.result.status,
      amount: capture.result.purchase_units[0].payments.captures[0].amount
    };
  } catch (error) {
    console.error('PayPal capture order error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Calculate fees
const calculateFees = (amount) => {
  const opulFeePercentage = parseInt(process.env.OPUL_FEE_PERCENTAGE) || 10;
  const opulFee = (amount * opulFeePercentage) / 100;
  const driverEarnings = amount - opulFee;
  
  return {
    totalAmount: amount,
    opulFee: Number(opulFee.toFixed(2)),
    driverEarnings: Number(driverEarnings.toFixed(2)),
    feePercentage: opulFeePercentage
  };
};

module.exports = {
  createPayPalOrder,
  capturePayPalOrder,
  calculateFees
};
