const mongoose = require('mongoose');

const visitorEventSchema = new mongoose.Schema({
  visitorId: { type: String, trim: true, index: true },
  sessionId: { type: String, trim: true, index: true },
  eventType: {
    type: String,
    enum: ['page_view', 'service_interest', 'request_start', 'quote_review', 'request_submit'],
    required: true,
    index: true
  },
  pageTitle: { type: String, trim: true },
  path: { type: String, trim: true, index: true },
  serviceName: { type: String, trim: true, index: true },
  referrer: { type: String, trim: true },
  userAgent: { type: String, trim: true },
  ipHash: { type: String, trim: true, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true, expires: 60 * 60 * 24 * 180 }
});

module.exports = mongoose.model('VisitorEvent', visitorEventSchema);
