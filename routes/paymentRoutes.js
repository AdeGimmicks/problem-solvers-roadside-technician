const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.post('/checkout', paymentController.createCheckoutSession);
router.get('/success', paymentController.success);
router.get('/cancel', paymentController.cancel);

module.exports = router;
