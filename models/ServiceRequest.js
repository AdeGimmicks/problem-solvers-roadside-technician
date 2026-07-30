const mongoose = require('mongoose');
const { REQUEST_STATUSES } = require('../utils/constants');

const statusEventSchema = new mongoose.Schema({
  status: { type: String, enum: REQUEST_STATUSES, required: true },
  note: String,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

const serviceRequestSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  vehicleMake: { type: String, required: true, trim: true },
  vehicleModel: { type: String, required: true, trim: true },
  vehicleColor: { type: String, required: true, trim: true },
  vehicleYear: { type: String, required: true, trim: true },
  problem: { type: String, required: true, trim: true },
  serviceDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  currentLocation: { type: String, required: true, trim: true },
  message: String,
  preferredPaymentMethod: { type: String, default: 'Card' },
  photoPaths: [String],
  status: { type: String, enum: REQUEST_STATUSES, default: 'Pending', index: true },
  statusHistory: { type: [statusEventSchema], default: [{ status: 'Pending' }] },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  acceptedAt: Date,
  completedAt: Date,
  estimatedPrice: Number,
  basePrice: Number,
  travelFee: Number,
  totalPrice: Number,
  distanceMiles: Number,
  travelTimeMinutes: Number,
  estimatedArrivalMinutes: Number,
  referenceNumber: { type: String, index: true },
  paymentStatus: { type: String, enum: ['Payment Pending', 'Paid'], default: 'Payment Pending' },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }
}, { timestamps: true });

serviceRequestSchema.methods.setStatus = function setStatus(status, adminId, note) {
  this.status = status;
  this.statusHistory.push({ status, changedBy: adminId, note });
  if (status === 'Accepted') {
    this.acceptedBy = adminId;
    this.acceptedAt = new Date();
  }
  if (status === 'Completed') this.completedAt = new Date();
};

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
