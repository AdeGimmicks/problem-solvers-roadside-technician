const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  vehicles: [{
    make: String,
    model: String,
    color: String,
    year: String
  }],
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
