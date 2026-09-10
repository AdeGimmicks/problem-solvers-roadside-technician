const ServiceRequest = require('../models/ServiceRequest');
const Payment = require('../models/Payment');
const BusinessSettings = require('../models/BusinessSettings');
const Customer = require('../models/Customer');
const { stripe, stripePublishableKey } = require('../config/services');
const { sendPaymentStatusSms } = require('../services/smsService');

const STRIPE_WEBSITE_NAME = 'Problem Solvers Roadside';
const STRIPE_BUSINESS_TYPE = 'Roadside Assistance';
const BATTERY_REPLACEMENT_SERVICE = 'Battery Replacement';
const BATTERY_REPLACEMENT_PRICE = 240;

function serviceItemId(serviceName) {
  return String(serviceName || 'Roadside Service')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'roadside-service';
}

function buildPurchaseConversionPayload({ request, payment, session }) {
  const paymentStatus = payment?.status;
  const requestPaymentStatus = request?.paymentStatus;
  const stripePaymentStatus = session?.payment_status;
  if (!request || !payment || paymentStatus !== 'Paid' || requestPaymentStatus !== 'Paid' || stripePaymentStatus !== 'paid') {
    return null;
  }

  const amount = Number(payment.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;
  const transactionId = payment.stripePaymentIntentId
    || paymentIntentId
    || request.referenceNumber
    || request.requestId
    || request._id?.toString();
  if (!transactionId) return null;

  const bookingId = request.referenceNumber || request.requestId || request._id?.toString();
  const value = Number(amount.toFixed(2));
  const currency = String(payment.currency || session.currency || process.env.STRIPE_CURRENCY || 'usd').toUpperCase();
  const serviceName = request.problem || 'Roadside Service';

  return {
    transaction_id: String(transactionId),
    booking_id: String(bookingId || transactionId),
    value,
    currency,
    items: [{
      item_id: serviceItemId(serviceName),
      item_name: serviceName,
      item_category: 'Roadside Service',
      quantity: 1,
      price: value
    }]
  };
}

async function getTechnicianAvailability() {
  const settings = await BusinessSettings.findOne()
    .sort({ acceptingJobsUpdatedAt: -1, updatedAt: -1 })
    .lean();

  if (!settings || settings.acceptingJobs !== false) {
    return {
      available: true,
      busy: false,
      acceptingJobs: true,
      message: 'Technician is available.'
    };
  }

  return {
    available: false,
    busy: true,
    acceptingJobs: false,
    control: {
      updatedAt: settings.acceptingJobsUpdatedAt || settings.updatedAt
    },
    message: 'No technician is currently accepting immediate jobs. You can continue only if you are willing to wait, or call first before paying.'
  };
}

async function createDirectBatteryReplacementRequest(session, paymentIntentId) {
  const existingPayment = paymentIntentId
    ? await Payment.findOne({ stripePaymentIntentId: paymentIntentId }).populate('serviceRequest')
    : null;
  if (existingPayment?.serviceRequest) {
    return existingPayment.serviceRequest;
  }

  const customerDetails = session.customer_details || {};
  const shippingDetails = session.shipping_details || {};
  const customerName = customerDetails.name || shippingDetails.name || 'Battery Replacement Customer';
  const phone = customerDetails.phone || shippingDetails.phone || 'Phone not provided';
  const email = customerDetails.email || undefined;
  const serviceAddress = shippingDetails.address || customerDetails.address;
  const address = serviceAddress
    ? [
      serviceAddress.line1,
      serviceAddress.line2,
      serviceAddress.city,
      serviceAddress.state,
      serviceAddress.postal_code,
      serviceAddress.country
    ].filter(Boolean).join(', ')
    : 'Customer location collected in Stripe checkout';

  const customer = await Customer.create({
    name: customerName,
    phone,
    email,
    vehicles: [{
      make: 'Battery replacement',
      model: 'Vehicle details not collected before payment',
      color: 'Not provided',
      year: 'Not provided'
    }],
    notes: `Direct ${BATTERY_REPLACEMENT_SERVICE} Stripe checkout. Stripe session: ${session.id}`
  });

  return ServiceRequest.create({
    customer: customer._id,
    customerName,
    phone,
    email,
    vehicleMake: 'Battery replacement',
    vehicleModel: 'Vehicle details not collected before payment',
    vehicleColor: 'Not provided',
    vehicleYear: 'Not provided',
    problem: BATTERY_REPLACEMENT_SERVICE,
    serviceDetails: {
      directBatteryReplacementCheckout: true,
      stripeSessionId: session.id
    },
    currentLocation: address,
    message: 'Direct battery replacement payment completed through Stripe before the full roadside form.',
    preferredPaymentMethod: 'Card',
    status: 'Pending',
    paymentStatus: 'Payment Pending',
    basePrice: BATTERY_REPLACEMENT_PRICE,
    travelFee: 0,
    totalPrice: BATTERY_REPLACEMENT_PRICE,
    estimatedPrice: BATTERY_REPLACEMENT_PRICE
  });
}

async function recordStripeCheckoutPayment(session) {
  let serviceRequestId = session?.metadata?.serviceRequestId;
  const directBatteryCheckout = session?.metadata?.directBatteryReplacementCheckout === 'true';
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;

  if (!serviceRequestId && directBatteryCheckout) {
    const directRequest = await createDirectBatteryReplacementRequest(session, paymentIntentId);
    serviceRequestId = directRequest?._id;
  }

  if (!serviceRequestId) return null;

  const request = await ServiceRequest.findById(serviceRequestId);
  if (!request) return null;
  const wasPaid = request.paymentStatus === 'Paid';

  let payment = paymentIntentId
    ? await Payment.findOne({ stripePaymentIntentId: paymentIntentId })
    : null;

  if (!payment) {
    payment = await Payment.create({
      serviceRequest: request._id,
      customer: request.customer,
      amount: Number(session.amount_total || 0) / 100,
      currency: session.currency || process.env.STRIPE_CURRENCY || 'usd',
      method: 'Card',
      status: session.payment_status === 'paid' ? 'Paid' : 'Pending',
      stripePaymentIntentId: paymentIntentId,
      notes: `Stripe Checkout Session: ${session.id}`
    });
  }

  request.payment = payment._id;
  request.paymentStatus = payment.status === 'Paid' ? 'Paid' : 'Payment Pending';
  await request.save();
  if (!wasPaid && request.paymentStatus === 'Paid') {
    await sendPaymentStatusSms(request, payment);
  }

  return { request, payment };
}

async function createBatteryReplacementCheckout(req, res, next) {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured yet.' });
    }

    const availability = await getTechnicianAvailability();
    const customerAcceptedWait = req.body.customerAcceptedWait === true || req.body.customerAcceptedWait === 'true';
    if (availability.busy && !customerAcceptedWait) {
      return res.status(409).json({
        error: 'No technician is currently accepting immediate jobs. Please confirm you are willing to wait before paying.',
        availability
      });
    }

    const metadata = {
      website: STRIPE_WEBSITE_NAME,
      business: STRIPE_BUSINESS_TYPE,
      service: BATTERY_REPLACEMENT_SERVICE,
      directBatteryReplacementCheckout: 'true',
      customerAcceptedWait: customerAcceptedWait ? 'true' : 'false'
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: process.env.STRIPE_CURRENCY || 'usd',
          unit_amount: BATTERY_REPLACEMENT_PRICE * 100,
          product_data: {
            name: `${STRIPE_WEBSITE_NAME} - ${BATTERY_REPLACEMENT_SERVICE}`,
            description: `${BATTERY_REPLACEMENT_SERVICE} at your location`,
            metadata
          }
        }
      }],
      phone_number_collection: { enabled: true },
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['US']
      },
      metadata,
      payment_intent_data: {
        description: BATTERY_REPLACEMENT_SERVICE,
        metadata
      },
      success_url: `${process.env.APP_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/payments/cancel?service=battery-replacement`
    });

    res.json({ url: session.url, publishableKeyConfigured: Boolean(stripePublishableKey) });
  } catch (error) {
    next(error);
  }
}

async function createCheckoutSession(req, res, next) {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured yet.' });
    }

    const serviceRequest = await ServiceRequest.findById(req.body.serviceRequestId);
    if (!serviceRequest) return res.status(404).json({ error: 'Service request not found.' });

    const availability = await getTechnicianAvailability();
    const customerAcceptedWait = req.body.customerAcceptedWait === true || req.body.customerAcceptedWait === 'true';
    if (availability.busy && !customerAcceptedWait) {
      return res.status(409).json({
        error: 'No technician is currently accepting immediate jobs. Please confirm you are willing to wait before paying.',
        availability
      });
    }

    if (availability.busy && customerAcceptedWait) {
      serviceRequest.waitlisted = true;
      serviceRequest.waitlistedAt = serviceRequest.waitlistedAt || new Date();
      serviceRequest.waitlistReason = 'Customer chose to wait while Store Manager was not accepting immediate jobs.';
      await serviceRequest.save();
    }

    const amount = Number(serviceRequest.totalPrice || serviceRequest.estimatedPrice || 0);
    if (amount <= 0) return res.status(422).json({ error: 'A valid payment amount is required.' });
    const selectedService = serviceRequest.problem || 'Roadside Service';
    const paymentDescription = selectedService;
    const roadsideMetadata = {
      website: STRIPE_WEBSITE_NAME,
      business: STRIPE_BUSINESS_TYPE,
      service: selectedService,
      serviceRequestId: serviceRequest._id.toString(),
      referenceNumber: serviceRequest.referenceNumber || serviceRequest.requestId || ''
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: process.env.STRIPE_CURRENCY || 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `${STRIPE_WEBSITE_NAME} - ${selectedService}`,
            description: paymentDescription,
            metadata: roadsideMetadata
          }
        }
      }],
      customer_email: serviceRequest.email || undefined,
      metadata: roadsideMetadata,
      payment_intent_data: {
        description: paymentDescription,
        metadata: roadsideMetadata
      },
      success_url: `${process.env.APP_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/payments/cancel?request=${serviceRequest._id}`
    });

    res.json({ url: session.url, publishableKeyConfigured: Boolean(stripePublishableKey) });
  } catch (error) {
    next(error);
  }
}

async function success(req, res, next) {
  try {
    let request = null;
    let payment = null;
    let session = null;

    if (stripe && req.query.session_id) {
      session = await stripe.checkout.sessions.retrieve(req.query.session_id);
      if (session.payment_status === 'paid') {
        const recorded = await recordStripeCheckoutPayment(session);
        request = recorded?.request || null;
        payment = recorded?.payment || null;
      } else if (session.metadata?.serviceRequestId) {
        request = await ServiceRequest.findById(session.metadata.serviceRequestId);
      }
    }

    res.render('payment-success', {
      title: 'Payment Successful',
      metaDescription: 'Your roadside assistance payment was successful.',
      request,
      payment,
      session,
      purchaseConversion: buildPurchaseConversionPayload({ request, payment, session })
    });
  } catch (error) {
    next(error);
  }
}

async function cancel(req, res, next) {
  try {
    const request = req.query.request ? await ServiceRequest.findById(req.query.request) : null;
    const isBatteryReplacement = req.query.service === 'battery-replacement';
    res.render('payment-cancel', {
      title: 'Payment Cancelled',
      metaDescription: 'Your payment was cancelled.',
      request,
      returnUrl: request
        ? `/request-service?resume=${encodeURIComponent(request._id.toString())}`
        : isBatteryReplacement ? '/request-service?service=Battery%20Replacement' : '/request-service'
    });
  } catch (error) {
    next(error);
  }
}

async function stripeWebhook(req, res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.sendStatus(204);
  const signature = req.headers['stripe-signature'];
  let event = req.body;

  if (Buffer.isBuffer(req.body)) {
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }

  if (event.type === 'checkout.session.completed') {
    await recordStripeCheckoutPayment(event.data.object);
  }
  res.json({ received: true });
}

module.exports = {
  createBatteryReplacementCheckout,
  createCheckoutSession,
  success,
  cancel,
  stripeWebhook,
  recordStripeCheckoutPayment,
  buildPurchaseConversionPayload
};
