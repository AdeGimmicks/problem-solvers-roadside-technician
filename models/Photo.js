const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  alt: { type: String, trim: true },
  visible: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Photo', photoSchema);
