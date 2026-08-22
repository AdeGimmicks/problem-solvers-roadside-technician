const Admin = require('../models/Admin');
const BusinessSettings = require('../models/BusinessSettings');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const Photo = require('../models/Photo');
const Pricing = require('../models/Pricing');
const Review = require('../models/Review');
const ServiceArea = require('../models/ServiceArea');
const ServiceRequest = require('../models/ServiceRequest');
const TechnicianLocation = require('../models/TechnicianLocation');
const VisitorEvent = require('../models/VisitorEvent');
const { sendOwnerSms, sendPaymentStatusSms, smsStatus } = require('../services/smsService');
const { issueToken } = require('../middleware/auth');
const { REQUEST_STATUSES, PUBLIC_SERVICE_NAMES } = require('../utils/constants');
const { cleanObject } = require('../utils/sanitize');

async function ensureDefaultAdmin() {
  const count = await Admin.countDocuments();
  if (count || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  await Admin.create({
    name: 'Owner',
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: 'owner'
  });
}

async function loginPage(req, res) {
  await ensureDefaultAdmin();
  const adminCount = await Admin.countDocuments();
  res.render('dashboard/login', {
    title: 'Store Manager Login',
    metaDescription: 'Secure store manager login.',
    error: null,
    canSetup: adminCount === 0
  });
}

async function login(req, res) {
  const admin = await Admin.findOne({ email: String(req.body.email || '').toLowerCase(), active: true });
  if (!admin || !(await admin.comparePassword(req.body.password || ''))) {
    const adminCount = await Admin.countDocuments();
    return res.status(401).render('dashboard/login', {
      title: 'Store Manager Login',
      metaDescription: 'Secure store manager login.',
      error: 'Invalid email or password.',
      canSetup: adminCount === 0
    });
  }
  req.session.admin = {
    id: admin._id.toString(),
    name: admin.name,
    email: admin.email,
    role: admin.role,
    token: issueToken(admin)
  };
  res.redirect('/dashboard');
}

async function setupPage(req, res) {
  const adminCount = await Admin.countDocuments();
  if (adminCount > 0) return res.redirect('/dashboard/login');
  res.render('dashboard/setup', {
    title: 'Create Store Manager Login',
    metaDescription: 'Create your store manager login.',
    error: null,
    form: {}
  });
}

async function setup(req, res) {
  const adminCount = await Admin.countDocuments();
  if (adminCount > 0) return res.redirect('/dashboard/login');

  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');
  const name = String(req.body.name || 'Store Manager').trim();

  if (!email || password.length < 8 || password !== confirmPassword) {
    return res.status(422).render('dashboard/setup', {
      title: 'Create Store Manager Login',
      metaDescription: 'Create your store manager login.',
      error: 'Enter an email and matching password with at least 8 characters.',
      form: { name, email }
    });
  }

  const admin = await Admin.create({
    name,
    email,
    password,
    role: 'owner'
  });

  req.session.admin = {
    id: admin._id.toString(),
    name: admin.name,
    email: admin.email,
    role: admin.role,
    token: issueToken(admin)
  };
  res.redirect('/dashboard');
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/dashboard/login'));
}

async function overview(req, res) {
  const since = new Date(Date.now() - (1000 * 60 * 60 * 24 * 7));
  const [counts, paymentCounts, recentRequests, payments, audience] = await Promise.all([
    ServiceRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ServiceRequest.aggregate([{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }]),
    ServiceRequest.find().sort({ createdAt: -1 }).limit(8).lean(),
    Payment.find().sort({ createdAt: -1 }).limit(6).populate('serviceRequest').lean(),
    getAudienceStats(since)
  ]);
  const statusCounts = Object.fromEntries(counts.map((item) => [item._id, item.count]));
  const paymentStatusCounts = Object.fromEntries(paymentCounts.map((item) => [item._id || 'Payment Pending', item.count]));
  res.render('dashboard/index', {
    title: 'Dashboard Overview',
    metaDescription: 'Admin dashboard overview.',
    statusCounts,
    paymentStatusCounts,
    recentRequests,
    payments,
    audience,
    statuses: REQUEST_STATUSES
  });
}

function pageLabel(path = '') {
  const cleanPath = String(path || '/').split('?')[0] || '/';
  const labels = {
    '/': 'Home',
    '/services': 'Services',
    '/about': 'About',
    '/contact': 'Contact',
    '/request-service': 'Request Service',
    '/service-area': 'Service Area',
    '/privacy-policy': 'Privacy Policy',
    '/terms-of-service': 'Terms of Service',
    '/payment-policy': 'Payment Policy',
    '/cancellation-policy': 'Cancellation Policy',
    '/refund-policy': 'Refund Policy',
    '/service-disclaimer': 'Service Disclaimer'
  };
  return labels[cleanPath] || cleanPath.replace(/^\/+/, '').replaceAll('-', ' ') || 'Home';
}

function actionLabel(eventType = '') {
  return {
    page_view: 'Page view',
    service_interest: 'Service interest',
    request_start: 'Started request',
    quote_review: 'Reviewed quote',
    request_submit: 'Submitted request'
  }[eventType] || String(eventType).replaceAll('_', ' ');
}

function fallbackSource(event = {}) {
  const path = String(event.landingPath || event.path || '');
  const referrer = String(event.referrer || '');
  if (event.sourceName) return event.sourceName;
  if (/[?&](gclid|gbraid|wbraid|gad_source)=/i.test(path)) return 'Google Ads';
  if (/[?&]fbclid=/i.test(path)) return 'Meta Ads';
  if (/google\./i.test(referrer)) return 'Google Search';
  if (referrer) return 'Referral';
  return 'Direct visit';
}

function decorateEvent(event = {}) {
  const plain = event.toObject ? event.toObject() : event;
  return {
    ...plain,
    actionLabel: actionLabel(plain.eventType),
    pageLabel: pageLabel(plain.path),
    landingLabel: pageLabel(plain.landingPath || plain.path),
    sourceLabel: fallbackSource(plain),
    sourceCategory: plain.sourceCategory || (fallbackSource(plain).includes('Ads') ? 'Paid Ads' : 'Unclassified'),
    visitorLabel: plain.visitorLabel || (plain.visitorType === 'owner' ? 'Owner' : 'Visitor'),
    deviceLabel: [plain.deviceType, plain.browserName].filter(Boolean).join(' / ') || 'Unknown device',
    locationLabel: [plain.location?.city, plain.location?.region, plain.location?.country].filter(Boolean).join(', ') || 'Location unavailable'
  };
}

function buildVisitorJourneys(events) {
  const groups = new Map();
  events.forEach((event) => {
    const key = event.sessionId || event.visitorId || event.ipHash || event._id.toString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  });

  return Array.from(groups.entries()).map(([key, group]) => {
    const ordered = group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const first = ordered[0] || {};
    const last = ordered[ordered.length - 1] || {};
    const services = [...new Set(ordered.map((item) => item.serviceName).filter(Boolean))];
    const completed = ordered.some((item) => item.eventType === 'request_submit');
    const started = ordered.some((item) => item.eventType === 'request_start' || item.eventType === 'quote_review');
    const owner = ordered.some((item) => item.visitorType === 'owner');
    return {
      key,
      visitorLabel: owner ? 'Owner' : (first.visitorLabel || 'Visitor'),
      badge: owner ? 'Owner visit' : completed ? 'Booked' : started ? 'Started, no booking yet' : 'Browsed only',
      sourceLabel: first.sourceLabel,
      sourceCategory: first.sourceCategory,
      landingLabel: first.landingLabel,
      landingPath: first.landingPath || first.path,
      lastPageLabel: last.pageLabel,
      services,
      ipAddress: first.ipAddress || 'Not stored',
      locationLabel: first.locationLabel,
      deviceLabel: first.deviceLabel,
      firstSeen: first.createdAt,
      lastSeen: last.createdAt,
      events: ordered.slice(-8).reverse()
    };
  }).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

async function getAudienceStats(since) {
  const baseMatch = { createdAt: { $gte: since } };
  const [visits, uniqueVisitors, ownerVisits, topServices, topPages, topLandingPages, recentEvents, serviceEvents, journeyEvents] = await Promise.all([
    VisitorEvent.countDocuments({ ...baseMatch, eventType: 'page_view' }),
    VisitorEvent.distinct('visitorId', { ...baseMatch, visitorId: { $nin: ['', null] } }),
    VisitorEvent.countDocuments({ ...baseMatch, eventType: 'page_view', visitorType: 'owner' }),
    VisitorEvent.aggregate([
      { $match: { ...baseMatch, serviceName: { $nin: [null, ''] } } },
      { $group: { _id: '$serviceName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]),
    VisitorEvent.aggregate([
      { $match: { ...baseMatch, eventType: 'page_view', path: { $nin: [null, ''] } } },
      { $group: { _id: '$path', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]),
    VisitorEvent.aggregate([
      { $match: { ...baseMatch, eventType: 'page_view', landingPath: { $nin: [null, ''] } } },
      { $group: { _id: '$landingPath', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]),
    VisitorEvent.find(baseMatch).sort({ createdAt: -1 }).limit(50).lean(),
    VisitorEvent.find({ ...baseMatch, serviceName: { $in: PUBLIC_SERVICE_NAMES } })
      .sort({ createdAt: -1 })
      .limit(250)
      .lean(),
    VisitorEvent.find(baseMatch).sort({ createdAt: -1 }).limit(600).lean()
  ]);
  const topServiceCounts = Object.fromEntries(topServices.map((item) => [item._id, item.count]));
  const decoratedServiceEvents = serviceEvents.map(decorateEvent);
  const serviceGroups = PUBLIC_SERVICE_NAMES.map((serviceName) => ({
    serviceName,
    label: `${serviceName} Visitors`,
    count: topServiceCounts[serviceName] || 0,
    events: decoratedServiceEvents.filter((event) => event.serviceName === serviceName).slice(0, 6)
  }));
  const decoratedRecentEvents = recentEvents.map(decorateEvent);
  const decoratedJourneyEvents = journeyEvents.map(decorateEvent);
  const visitorJourneys = buildVisitorJourneys(decoratedJourneyEvents).slice(0, 30);
  const sourceTotals = new Map();
  visitorJourneys.forEach((journey) => {
    const key = `${journey.sourceCategory}::${journey.sourceLabel}`;
    const current = sourceTotals.get(key) || {
      label: journey.sourceLabel,
      category: journey.sourceCategory,
      count: 0
    };
    current.count += 1;
    sourceTotals.set(key, current);
  });

  return {
    since,
    visits,
    uniqueVisitors: uniqueVisitors.length,
    ownerVisits,
    customerVisits: Math.max(0, visits - ownerVisits),
    topServices,
    topPages: topPages.map((item) => ({ ...item, label: pageLabel(item._id) })),
    topLandingPages: topLandingPages.map((item) => ({ ...item, label: pageLabel(item._id) })),
    sourceBreakdown: Array.from(sourceTotals.values()).sort((a, b) => b.count - a.count).slice(0, 8),
    recentEvents: decoratedRecentEvents,
    serviceGroups,
    visitorJourneys
  };
}

async function requests(req, res) {
  const status = req.query.status;
  const payment = req.query.payment;
  const query = {};
  if (status) query.status = status;
  if (payment === 'paid') query.paymentStatus = 'Paid';
  if (payment === 'unpaid') query.paymentStatus = { $ne: 'Paid' };
  const items = await ServiceRequest.find(query).sort({ createdAt: -1 }).populate('customer payment').lean();
  const title = payment === 'paid'
    ? 'Paid Requests'
    : payment === 'unpaid'
      ? 'Unpaid Requests'
      : status ? `${status} Requests` : 'Service Requests';
  res.render('dashboard/requests', {
    title,
    metaDescription: 'Manage roadside assistance requests.',
    items,
    statuses: REQUEST_STATUSES,
    currentStatus: title,
    openRequestId: req.query.open || ''
  });
}

async function updateRequestStatus(req, res, next) {
  try {
    const item = await ServiceRequest.findById(req.params.id).lean();
    if (!item) return res.redirect('/dashboard/requests');

    const adminId = req.session?.admin?.id || null;
    const nextStatus = REQUEST_STATUSES.includes(req.body.status) ? req.body.status : item.status;
    const nextPaymentStatus = ['Payment Pending', 'Paid'].includes(req.body.paymentStatus)
      ? req.body.paymentStatus
      : item.paymentStatus || 'Payment Pending';
    const update = {
      status: nextStatus,
      paymentStatus: nextPaymentStatus,
      internalNotes: req.body.internalNotes || ''
    };
    const push = {};

    if (nextStatus !== item.status) {
      push.statusHistory = {
        status: nextStatus,
        note: req.body.note,
        changedAt: new Date()
      };
      if (adminId) push.statusHistory.changedBy = adminId;
      if (nextStatus === 'Accepted') {
        if (adminId) update.acceptedBy = adminId;
        update.acceptedAt = new Date();
      }
      if (nextStatus === 'Completed') update.completedAt = new Date();
    }

    await ServiceRequest.updateOne(
      { _id: item._id },
      Object.keys(push).length ? { $set: update, $push: push } : { $set: update }
    );
    if (item.paymentStatus !== 'Paid' && nextPaymentStatus === 'Paid') {
      await sendPaymentStatusSms({ ...item, ...update }, { amount: item.totalPrice || item.estimatedPrice, status: 'Paid' });
    }

    if (nextPaymentStatus === 'Paid') return res.redirect('/dashboard/requests?payment=paid');
    if (nextStatus === 'Accepted') return res.redirect('/dashboard/requests?status=Accepted');
    if (nextStatus === 'Completed') return res.redirect('/dashboard/requests?status=Completed');
    if (nextStatus === 'Cancelled') return res.redirect('/dashboard/requests?status=Cancelled');
    res.redirect('/dashboard/requests?payment=unpaid');
  } catch (error) {
    next(error);
  }
}

async function customers(req, res) {
  const items = await Customer.find().sort({ updatedAt: -1 }).lean();
  res.render('dashboard/customers', {
    title: 'Customers',
    metaDescription: 'Customer list.',
    items
  });
}

async function payments(req, res) {
  const items = await Payment.find().sort({ createdAt: -1 }).populate('serviceRequest customer').lean();
  res.render('dashboard/payments', {
    title: 'Payments',
    metaDescription: 'Payment records.',
    items
  });
}

async function audience(req, res) {
  const days = Math.max(1, Math.min(Number(req.query.days || 7), 90));
  const since = new Date(Date.now() - (1000 * 60 * 60 * 24 * days));
  const stats = await getAudienceStats(since);
  res.render('dashboard/audience', {
    title: 'Website Audience',
    metaDescription: 'Website visitor and service interest analytics.',
    days,
    audience: stats
  });
}

async function cms(req, res) {
  res.render('dashboard/cms', {
    title: 'Website CMS',
    metaDescription: 'Website content management hub.'
  });
}

async function liveLocation(req, res) {
  const technicianId = req.session?.admin?.id || null;
  const [businessSettings, technicianLocation] = await Promise.all([
    BusinessSettings.findOne().lean(),
    TechnicianLocation.findOne(technicianId ? { technician: technicianId } : { technician: null }).lean()
  ]);
  res.render('dashboard/live-location', {
    title: 'Live Technician Location',
    metaDescription: 'Share live technician location for quote distance and ETA.',
    businessSettings,
    technicianLocation
  });
}

async function updateLiveLocation(req, res, next) {
  try {
    const online = req.body.online !== false && req.body.online !== 'false';
    const technicianId = req.session?.admin?.id || null;
    const label = req.session?.admin?.name || 'Store Manager';
    if (!online) {
      const query = technicianId ? { technician: technicianId } : { technician: null };
      const offline = await TechnicianLocation.findOneAndUpdate(query, {
        technician: technicianId,
        label,
        online: false,
        source: 'dashboard-live-location'
      }, { upsert: true, new: true });
      return res.json({ ok: true, online: false, location: offline.location });
    }

    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const accuracy = Number(req.body.accuracy || 0);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(422).json({ error: 'Valid latitude and longitude are required.' });
    }
    const location = {
      lat,
      lng,
      accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
      updatedAt: new Date()
    };
    const query = technicianId ? { technician: technicianId } : { technician: null };
    const [settings, technicianLocation] = await Promise.all([
      BusinessSettings.findOneAndUpdate({}, {
      liveTechnicianLocation: {
        lat,
        lng,
        accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
        source: 'dashboard-live-location',
        updatedAt: new Date()
      }
      }, { upsert: true, new: true }),
      TechnicianLocation.findOneAndUpdate(query, {
        technician: technicianId,
        label,
        online: true,
        location,
        source: 'dashboard-live-location'
      }, { upsert: true, new: true })
    ]);

    res.json({
      ok: true,
      online: true,
      location: technicianLocation.location || settings.liveTechnicianLocation
    });
  } catch (error) {
    next(error);
  }
}

async function recordPayment(req, res) {
  const data = cleanObject(req.body);
  const request = await ServiceRequest.findById(data.serviceRequest);
  if (!request) return res.redirect('/dashboard/payments');

  const payment = await Payment.create({
    serviceRequest: request._id,
    customer: request.customer,
    amount: Number(data.amount),
    method: data.method,
    status: data.status || 'Paid',
    notes: data.notes,
    recordedBy: req.session.admin.id
  });
  request.payment = payment._id;
  request.paymentStatus = payment.status || 'Paid';
  await request.save();
  if (request.paymentStatus === 'Paid') {
    await sendPaymentStatusSms(request, payment);
  }
  res.redirect('/dashboard/payments');
}

async function settings(req, res) {
  const [businessSettings, reviews, photos, pricing, areas] = await Promise.all([
    BusinessSettings.findOne().lean(),
    Review.find().sort({ createdAt: -1 }).lean(),
    Photo.find().sort({ createdAt: -1 }).lean(),
    Pricing.find().sort({ serviceName: 1 }).lean(),
    ServiceArea.find().sort({ priority: -1, name: 1 }).lean()
  ]);
  res.render('dashboard/settings', {
    title: 'Business Settings',
    metaDescription: 'Business settings.',
    businessSettings,
    smsStatus: smsStatus(),
    reqQuery: req.query || {},
    reviews,
    photos,
    pricing,
    areas
  });
}

async function updateSettings(req, res) {
  const data = cleanObject(req.body);
  await BusinessSettings.findOneAndUpdate({}, {
    businessName: data.businessName,
    phoneNumber: data.phoneNumber,
    textNumber: data.textNumber,
    email: data.email,
    businessHours: data.businessHours,
    serviceArea: data.serviceArea,
    googleMapsEmbedUrl: data.googleMapsEmbedUrl,
    googleReviewUrl: data.googleReviewUrl,
    dispatchLocation: data.dispatchLat && data.dispatchLng ? {
      lat: Number(data.dispatchLat),
      lng: Number(data.dispatchLng),
      updatedAt: new Date()
    } : undefined,
    quoteConfig: {
      includedMiles: Number(data.includedMiles || 10),
      travelFeePerExtraMile: Number(data.travelFeePerExtraMile || 2),
      maxTravelTimeMinutes: Number(data.maxTravelTimeMinutes || 60),
      longDistanceFee: Number(data.longDistanceFee || 50),
      standardTravelTimeMaxMinutes: Number(data.standardTravelTimeMaxMinutes || 60),
      tierOneTravelTimeMaxMinutes: Number(data.tierOneTravelTimeMaxMinutes || 90),
      tierOneTravelFeePercent: Number(data.tierOneTravelFeePercent || 50),
      tierTwoTravelTimeMaxMinutes: Number(data.tierTwoTravelTimeMaxMinutes || 120),
      tierTwoTravelFeePercent: Number(data.tierTwoTravelFeePercent || 100)
    },
    paymentMethods: {
      card: data.card === 'on',
      applePay: data.applePay === 'on',
      googlePay: data.googlePay === 'on',
      cash: data.cash === 'on',
      cashApp: data.cashApp === 'on',
      zelle: data.zelle === 'on'
    },
    seo: {
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      keywords: String(data.keywords || '').split(',').map((item) => item.trim()).filter(Boolean)
    }
  }, { upsert: true, new: true });
  res.redirect('/dashboard/settings');
}

async function testSms(req, res) {
  const result = await sendOwnerSms([
    'Problem Solvers Roadside SMS Test',
    `Sent: ${new Date().toLocaleString()}`,
    'If you received this, owner SMS alerts are connected.'
  ].join('\n'));
  const status = result?.ok ? 'sent' : 'failed';
  const message = result?.ok
    ? 'Test SMS sent. Check your phone.'
    : `Test SMS failed: ${result?.error || result?.reason || 'Unknown error'}`;
  res.redirect(`/dashboard/settings?sms=${status}&smsMessage=${encodeURIComponent(message)}`);
}

async function addReview(req, res) {
  const data = cleanObject(req.body);
  await Review.create({ customerName: data.customerName, rating: data.rating, quote: data.quote, source: data.source });
  res.redirect('/dashboard/settings#reviews');
}

async function addPhoto(req, res) {
  const data = cleanObject(req.body);
  const url = req.file ? `/uploads/${req.file.filename}` : data.url;
  await Photo.create({ title: data.title, url, alt: data.alt || data.title });
  res.redirect('/dashboard/settings#photos');
}

async function addPricing(req, res) {
  const data = cleanObject(req.body);
  await Pricing.create({ serviceName: data.serviceName, startingPrice: Number(data.startingPrice), description: data.description });
  res.redirect('/dashboard/settings#pricing');
}

async function addServiceArea(req, res) {
  const data = cleanObject(req.body);
  await ServiceArea.create({ name: data.name, priority: Number(data.priority || 0) });
  res.redirect('/dashboard/settings#areas');
}

module.exports = {
  loginPage,
  login,
  setupPage,
  setup,
  logout,
  overview,
  requests,
  updateRequestStatus,
  customers,
  payments,
  audience,
  cms,
  liveLocation,
  updateLiveLocation,
  recordPayment,
  settings,
  updateSettings,
  testSms,
  addReview,
  addPhoto,
  addPricing,
  addServiceArea
};
