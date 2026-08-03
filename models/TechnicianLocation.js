const mongoose = require('mongoose');

const technicianLocationSchema = new mongoose.Schema({
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', index: true, sparse: true },
  label: { type: String, default: 'Store Manager' },
  online: { type: Boolean, default: false, index: true },
  location: {
    lat: Number,
    lng: Number,
    accuracy: Number,
    updatedAt: Date
  },
  source: { type: String, default: 'dashboard' }
}, { timestamps: true });

technicianLocationSchema.index({ online: 1, 'location.updatedAt': -1 });

module.exports = mongoose.model('TechnicianLocation', technicianLocationSchema);
