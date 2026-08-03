const ServiceRequest = require('../models/ServiceRequest');
const Payment = require('../models/Payment');
const { stripe, stripePublishableKey } = require('../config/services');

const STRIPE_WEBSITE_NAME = 'Problem Solvers Roadside';
const STRIPE_BUSINESS_TYPE = 'Roadside Assistance';

async function recordStripeCheckoutPayment(session) {
  const serviceRequestId = session?.metadata?.serviceRequestId;
  if (!serviceRequestId) return null;

  const request = await ServiceRequest.findById(serviceRequestId);
  if (!request) return null;

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;
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

  return { request, payment };
}

async function createCheckoutSession(req, res, next) {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured yet.' });
    }

    const serviceRequest = await ServiceRequest.findById(req.body.serviceRequestId);
    if (!serviceRequest) return res.status(404).json({ error: 'Service request not found.' });

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
      session
    });
  } catch (error) {
    next(error);
  }
}

async function cancel(req, res, next) {
  try {
    const request = req.query.request ? await ServiceRequest.findById(req.query.request) : null;
    res.render('payment-cancel', {
      title: 'Payment Cancelled',
      metaDescription: 'Your payment was cancelled.',
      request
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
  createCheckoutSession,
  success,
  cancel,
  stripeWebhook,
  recordStripeCheckoutPayment
};
