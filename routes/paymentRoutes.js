const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.post('/checkout', paymentController.createCheckoutSession);
router.post('/stripe-webhook', paymentController.stripeWebhook);
router.get('/success', paymentController.success);
router.get('/cancel', paymentController.cancel);

module.exports = router;
