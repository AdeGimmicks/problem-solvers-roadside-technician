const mongoose = require('mongoose');

const businessSettingsSchema = new mongoose.Schema({
  businessName: { type: String, default: 'Problem Solvers Roadside Technician' },
  phoneNumber: { type: String, default: process.env.BUSINESS_PHONE || '+13129007711' },
  textNumber: { type: String, default: process.env.BUSINESS_TEXT || '+13129007711' },
  email: { type: String, default: process.env.BUSINESS_EMAIL || 'help@example.com' },
  businessHours: { type: String, default: process.env.BUSINESS_HOURS || 'Mon-Sun 6:00 AM - 11:00 PM' },
  serviceArea: { type: String, default: process.env.SERVICE_AREA || 'Chicago and surrounding suburbs' },
  googleMapsEmbedUrl: { type: String, default: process.env.GOOGLE_MAPS_EMBED_URL || '' },
  googleReviewUrl: { type: String, default: process.env.GOOGLE_REVIEW_URL || '' },
  dispatchLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },
  liveTechnicianLocation: {
    lat: Number,
    lng: Number,
    accuracy: Number,
    source: String,
    updatedAt: Date
  },
  quoteConfig: {
    includedMiles: { type: Number, default: 10 },
    travelFeePerExtraMile: { type: Number, default: 2 },
    maxTravelTimeMinutes: { type: Number, default: 60 },
    longDistanceFee: { type: Number, default: 50 },
    standardTravelTimeMaxMinutes: { type: Number, default: 60 },
    tierOneTravelTimeMaxMinutes: { type: Number, default: 90 },
    tierOneTravelFeePercent: { type: Number, default: 50 },
    tierTwoTravelTimeMaxMinutes: { type: Number, default: 120 },
    tierTwoTravelFeePercent: { type: Number, default: 100 },
    closeDistancePrice: { type: Number, default: 40 },
    closeDistanceMaxMinutes: { type: Number, default: 30 },
    closeDistanceTrafficBufferMinutes: { type: Number, default: 5 }
  },
  logo: String,
  coverImage: String,
  socialMedia: {
    facebook: String,
    instagram: String,
    tiktok: String
  },
  paymentMethods: {
    card: { type: Boolean, default: true },
    applePay: { type: Boolean, default: true },
    googlePay: { type: Boolean, default: true },
    cash: { type: Boolean, default: true },
    cashApp: { type: Boolean, default: true },
    zelle: { type: Boolean, default: true }
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  }
}, { timestamps: true });

module.exports = mongoose.model('BusinessSettings', businessSettingsSchema);
