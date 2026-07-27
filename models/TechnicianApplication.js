const mongoose = require('mongoose');

const technicianApplicationSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  city: { type: String, required: true, trim: true },
  serviceArea: { type: String, trim: true },
  servicesOffered: [{ type: String, trim: true }],
  tools: { type: String, trim: true },
  vehicle: { type: String, trim: true },
  experience: { type: String, trim: true },
  photoPaths: [String],
  applicationStatus: {
    type: String,
    enum: ['New', 'Reviewing', 'Approved', 'Rejected'],
    default: 'New',
    index: true
  },
  stripeConnectAccountId: String,
  stripeConnectStatus: {
    type: String,
    enum: ['Not Started', 'Pending', 'Active', 'Restricted'],
    default: 'Not Started'
  },
  payoutStatus: {
    type: String,
    enum: ['Not Ready', 'Ready'],
    default: 'Not Ready'
  },
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('TechnicianApplication', technicianApplicationSchema);
