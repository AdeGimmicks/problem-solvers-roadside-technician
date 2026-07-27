const mongoose = require('mongoose');

const serviceAreaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true },
  priority: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('ServiceArea', serviceAreaSchema);
