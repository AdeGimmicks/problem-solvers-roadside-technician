const mongoose = require('mongoose');

const visitorEventSchema = new mongoose.Schema({
  visitorId: { type: String, trim: true, index: true },
  sessionId: { type: String, trim: true, index: true },
  eventType: {
    type: String,
    enum: [
      'page_view',
      'page_duration',
      'button_click',
      'service_interest',
      'request_open',
      'form_start',
      'request_start',
      'quote_review',
      'checkout_reached',
      'payment_success',
      'request_submit'
    ],
    required: true,
    index: true
  },
  pageTitle: { type: String, trim: true },
  path: { type: String, trim: true, index: true },
  landingPath: { type: String, trim: true, index: true },
  originalRawLandingUrl: { type: String, trim: true },
  serviceName: { type: String, trim: true, index: true },
  referrer: { type: String, trim: true },
  userAgent: { type: String, trim: true },
  ipAddress: { type: String, trim: true },
  ipHash: { type: String, trim: true, index: true },
  visitorType: { type: String, enum: ['visitor', 'owner', 'owner_test'], default: 'visitor', index: true },
  visitorLabel: { type: String, trim: true, default: 'Visitor' },
  sourceCategory: { type: String, trim: true, index: true },
  sourceName: { type: String, trim: true, index: true },
  sourceMedium: { type: String, trim: true, index: true },
  campaignName: { type: String, trim: true },
  utmSource: { type: String, trim: true },
  utmMedium: { type: String, trim: true },
  utmCampaign: { type: String, trim: true },
  campaignId: { type: String, trim: true },
  adClickId: { type: String, trim: true },
  gclid: { type: String, trim: true, index: true },
  gbraid: { type: String, trim: true, index: true },
  wbraid: { type: String, trim: true, index: true },
  gadSource: { type: String, trim: true },
  deviceType: { type: String, trim: true },
  browserName: { type: String, trim: true },
  operatingSystem: { type: String, trim: true },
  location: {
    city: { type: String, trim: true },
    region: { type: String, trim: true },
    country: { type: String, trim: true },
    postal: { type: String, trim: true },
    timezone: { type: String, trim: true },
    isp: { type: String, trim: true }
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true, expires: 60 * 60 * 24 * 180 }
});

module.exports = mongoose.model('VisitorEvent', visitorEventSchema);
