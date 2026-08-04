const { validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const TechnicianApplication = require('../models/TechnicianApplication');
const TechnicianLocation = require('../models/TechnicianLocation');
const { sendTechnicianApprovalEmail } = require('../services/emailService');
const { cleanObject } = require('../utils/sanitize');

const SERVICE_OPTIONS = [
  'Tire Change',
  'Jump Start',
  'Fuel Delivery',
  'Lockout Service',
  'Tire Inflation',
  'Battery Testing',
  'Battery Replacement',
  'Car Diagnostic'
];

async function applyPage(req, res) {
  res.render('technician-apply', {
    title: 'Technician Application',
    metaDescription: 'Apply to work with Problem Solvers Roadside.',
    form: {},
    errors: [],
    services: SERVICE_OPTIONS
  });
}

async function submitApplication(req, res, next) {
  try {
    const errors = validationResult(req);
    const form = req.body;
    if (!errors.isEmpty()) {
      return res.status(422).render('technician-apply', {
        title: 'Technician Application',
        metaDescription: 'Apply to work with Problem Solvers Roadside.',
        form,
        errors: errors.array(),
        services: SERVICE_OPTIONS
      });
    }

    const data = cleanObject(req.body);
    const servicesOffered = Array.isArray(data.servicesOffered)
      ? data.servicesOffered
      : [data.servicesOffered].filter(Boolean);

    const application = await TechnicianApplication.create({
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      city: data.city,
      serviceArea: data.serviceArea,
      servicesOffered,
      tools: data.tools,
      vehicle: data.vehicle,
      experience: data.experience,
      photoPaths: (req.files || []).map((file) => `/uploads/${file.filename}`)
    });

    res.render('technician-success', {
      title: 'Application Received',
      metaDescription: 'Your technician application was received.',
      application
    });
  } catch (error) {
    next(error);
  }
}

async function dashboardList(req, res) {
  const status = req.query.status;
  const query = status ? { applicationStatus: status } : {};
  const [items, locations, technicianAccounts] = await Promise.all([
    TechnicianApplication.find(query).sort({ createdAt: -1 }).lean(),
    TechnicianLocation.find().sort({ 'location.updatedAt': -1 }).lean(),
    Admin.find({ role: 'technician' }).sort({ createdAt: -1 }).select('name email active createdAt').lean()
  ]);
  res.render('dashboard/technicians', {
    title: 'Technician Applications',
    metaDescription: 'Manage technician applications.',
    items,
    locations,
    technicianAccounts,
    currentStatus: status || '',
    statuses: ['New', 'Reviewing', 'Approved', 'Rejected']
  });
}

async function updateStatus(req, res) {
  const application = await TechnicianApplication.findById(req.params.id);
  if (!application) return res.redirect('/dashboard/technicians');
  const wasApproved = application.applicationStatus === 'Approved';
  application.applicationStatus = req.body.applicationStatusAction || req.body.applicationStatus;
  application.notes = req.body.notes;
  application.stripeConnectStatus = req.body.stripeConnectStatus;
  application.payoutStatus = req.body.payoutStatus;
  await application.save();

  if (!wasApproved && application.applicationStatus === 'Approved') {
    await sendTechnicianApprovalEmail(application).catch((error) => {
      console.error('Technician approval email failed:', error.message);
    });
  }

  res.redirect('/dashboard/technicians');
}

module.exports = {
  applyPage,
  submitApplication,
  dashboardList,
  updateStatus,
  SERVICE_OPTIONS
};
