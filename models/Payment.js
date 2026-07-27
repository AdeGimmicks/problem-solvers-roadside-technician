const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  serviceRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceRequest' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  method: { type: String, enum: ['Card', 'Cash', 'Cash App', 'Zelle', 'Other'], default: 'Card' },
  status: { type: String, enum: ['Pending', 'Paid', 'Failed', 'Refunded'], default: 'Pending' },
  stripePaymentIntentId: String,
  notes: String,
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
