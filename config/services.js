const Stripe = require('stripe');

const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';

module.exports = { stripe, stripePublishableKey };
