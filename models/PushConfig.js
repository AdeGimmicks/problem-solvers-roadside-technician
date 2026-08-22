const mongoose = require('mongoose');

const pushConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'manager-vapid' },
    publicKey: { type: String, required: true },
    privateKey: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.PushConfig || mongoose.model('PushConfig', pushConfigSchema);
