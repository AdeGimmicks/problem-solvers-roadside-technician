const BusinessSettings = require('../models/BusinessSettings');
const { hasDatabase } = require('../utils/dbState');

const fallbackSettings = {
  businessName: process.env.BUSINESS_NAME || 'Problem Solvers Roadside Technician',
  phoneNumber: process.env.BUSINESS_PHONE || '+13129007711',
  textNumber: process.env.BUSINESS_TEXT || process.env.BUSINESS_PHONE || '+13129007711',
  email: process.env.BUSINESS_EMAIL || 'help@example.com',
  businessHours: process.env.BUSINESS_HOURS || 'Mon-Sun 6:00 AM - 11:00 PM',
  serviceArea: process.env.SERVICE_AREA || 'Chicago and surrounding suburbs',
  googleMapsEmbedUrl: process.env.GOOGLE_MAPS_EMBED_URL || '',
  googleReviewUrl: process.env.GOOGLE_REVIEW_URL || '',
  dispatchLocation: process.env.DISPATCH_LAT && process.env.DISPATCH_LNG ? {
    lat: Number(process.env.DISPATCH_LAT),
    lng: Number(process.env.DISPATCH_LNG)
  } : null,
  quoteConfig: {
    includedMiles: Number(process.env.INCLUDED_MILES || 10),
    travelFeePerExtraMile: Number(process.env.TRAVEL_FEE_PER_EXTRA_MILE || 2),
    maxTravelTimeMinutes: Number(process.env.MAX_TRAVEL_TIME_MINUTES || 60),
    longDistanceFee: Number(process.env.LONG_DISTANCE_FEE || 50),
    standardTravelTimeMaxMinutes: Number(process.env.STANDARD_TRAVEL_TIME_MAX_MINUTES || 60),
    tierOneTravelTimeMaxMinutes: Number(process.env.TIER_ONE_TRAVEL_TIME_MAX_MINUTES || 90),
    tierOneTravelFeePercent: Number(process.env.TIER_ONE_TRAVEL_FEE_PERCENT || 50),
    tierTwoTravelTimeMaxMinutes: Number(process.env.TIER_TWO_TRAVEL_TIME_MAX_MINUTES || 120),
    tierTwoTravelFeePercent: Number(process.env.TIER_TWO_TRAVEL_FEE_PERCENT || 100)
  },
  paymentMethods: {
    card: true,
    applePay: true,
    googlePay: true,
    cash: true,
    cashApp: true,
    zelle: true
  }
};

async function attachBusinessSettings(req, res, next) {
  if (!hasDatabase()) {
    res.locals.settings = fallbackSettings;
    return next();
  }

  try {
    const settings = await BusinessSettings.findOne().lean();
    res.locals.settings = settings || fallbackSettings;
    next();
  } catch (error) {
    res.locals.settings = fallbackSettings;
    next();
  }
}

module.exports = { attachBusinessSettings, fallbackSettings };
