const mongoose = require('mongoose');
const { REQUEST_STATUSES } = require('../utils/constants');

const statusEventSchema = new mongoose.Schema({
  status: { type: String, enum: REQUEST_STATUSES, required: true },
  note: String,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

const serviceRequestSchema = new mongoose.Schema({
  requestId: { type: String, unique: true, sparse: true, index: true },
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
  location: {
    address: { type: String, trim: true },
    lat: Number,
    lng: Number
  },
  message: String,
  internalNotes: String,
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

serviceRequestSchema.pre('validate', async function assignRequestId(next) {
  if (this.requestId) return next();

  const now = this.createdAt || new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const count = await this.constructor.countDocuments({ createdAt: { $gte: start, $lt: end } });
  this.requestId = `PS-${datePart}-${String(count + 1).padStart(4, '0')}`;
  next();
});

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
