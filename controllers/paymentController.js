const ServiceRequest = require('../models/ServiceRequest');
const Payment = require('../models/Payment');
const { stripe } = require('../config/services');

async function createCheckoutSession(req, res, next) {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured yet.' });
    }

    const serviceRequest = await ServiceRequest.findById(req.body.serviceRequestId);
    if (!serviceRequest) return res.status(404).json({ error: 'Service request not found.' });

    const amount = Number(req.body.amount || serviceRequest.estimatedPrice || 0);
    if (amount <= 0) return res.status(422).json({ error: 'A valid payment amount is required.' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: process.env.STRIPE_CURRENCY || 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `Roadside Assistance - ${serviceRequest.problem}`
          }
        }
      }],
      metadata: { serviceRequestId: serviceRequest._id.toString() },
      success_url: `${process.env.APP_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/payments/cancel`
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
}

async function success(req, res) {
  res.render('payment-success', {
    title: 'Payment Successful',
    metaDescription: 'Your roadside assistance payment was successful.'
  });
}

async function cancel(req, res) {
  res.render('payment-cancel', {
    title: 'Payment Cancelled',
    metaDescription: 'Your payment was cancelled.'
  });
}

async function stripeWebhook(req, res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.sendStatus(204);
  const event = req.body;
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const request = await ServiceRequest.findById(session.metadata.serviceRequestId);
    if (request) {
      const payment = await Payment.create({
        serviceRequest: request._id,
        customer: request.customer,
        amount: session.amount_total / 100,
        method: 'Card',
        status: 'Paid',
        stripePaymentIntentId: session.payment_intent
      });
      request.payment = payment._id;
      request.setStatus('Payment Recorded', null, 'Stripe payment completed.');
      await request.save();
    }
  }
  res.json({ received: true });
}

module.exports = { createCheckoutSession, success, cancel, stripeWebhook };
