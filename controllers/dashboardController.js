const Admin = require('../models/Admin');
const BusinessSettings = require('../models/BusinessSettings');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const Photo = require('../models/Photo');
const Pricing = require('../models/Pricing');
const Review = require('../models/Review');
const ServiceArea = require('../models/ServiceArea');
const ServiceRequest = require('../models/ServiceRequest');
const { issueToken } = require('../middleware/auth');
const { REQUEST_STATUSES } = require('../utils/constants');
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
  const [counts, paymentCounts, recentRequests, payments] = await Promise.all([
    ServiceRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ServiceRequest.aggregate([{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }]),
    ServiceRequest.find().sort({ createdAt: -1 }).limit(8).lean(),
    Payment.find().sort({ createdAt: -1 }).limit(6).populate('serviceRequest').lean()
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
    statuses: REQUEST_STATUSES
  });
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
    currentStatus: title
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
      travelFeePerExtraMile: Number(data.travelFeePerExtraMile || 2)
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
  recordPayment,
  settings,
  updateSettings,
  addReview,
  addPhoto,
  addPricing,
  addServiceArea
};
