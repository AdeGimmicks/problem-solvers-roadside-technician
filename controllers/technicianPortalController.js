const Admin = require('../models/Admin');
const ServiceRequest = require('../models/ServiceRequest');
const TechnicianApplication = require('../models/TechnicianApplication');
const TechnicianLocation = require('../models/TechnicianLocation');
const { REQUEST_STATUSES } = require('../utils/constants');
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

function technicianSession(admin) {
  return {
    id: admin._id.toString(),
    name: admin.name,
    email: admin.email,
    role: admin.role
  };
}

async function getTechnicianGate(technician) {
  const [application, location] = await Promise.all([
    TechnicianApplication.findOne({
      $or: [
        { technicianAccount: technician.id },
        { email: technician.email }
      ]
    }).sort({ updatedAt: -1 }).lean(),
    TechnicianLocation.findOne({ technician: technician.id }).lean()
  ]);
  const legacyApproved = !application && Boolean(location?.location?.lat);
  const approved = application?.applicationStatus === 'Approved' || legacyApproved;
  let message = 'Submit your technician application before going online or receiving jobs.';
  if (application?.applicationStatus === 'New' || application?.applicationStatus === 'Reviewing') {
    message = 'Your technician application is under review. You can go online after Store Manager approval.';
  }
  if (application?.applicationStatus === 'Rejected') {
    message = 'Your technician application was not approved. Contact Store Manager before going online.';
  }
  if (legacyApproved) {
    message = 'Existing technician account is active.';
  }
  return { application, location, approved, legacyApproved, message };
}

function loginPage(req, res) {
  res.render('technician/login', {
    title: 'Technician Login',
    metaDescription: 'Technician portal login.',
    error: null
  });
}

async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const admin = await Admin.findOne({ email, role: 'technician', active: true });
  if (!admin || !(await admin.comparePassword(req.body.password || ''))) {
    return res.status(401).render('technician/login', {
      title: 'Technician Login',
      metaDescription: 'Technician portal login.',
      error: 'Invalid technician email or password.'
    });
  }
  req.session.technician = technicianSession(admin);
  res.redirect('/technician');
}

function signupPage(req, res) {
  res.render('technician/signup', {
    title: 'Create Technician Account',
    metaDescription: 'Create a technician portal account.',
    error: null,
    form: {}
  });
}

async function signup(req, res) {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');

  if (!name || !email || password.length < 8 || password !== confirmPassword) {
    return res.status(422).render('technician/signup', {
      title: 'Create Technician Account',
      metaDescription: 'Create a technician portal account.',
      error: 'Enter your name, email, and matching password with at least 8 characters.',
      form: { name, email }
    });
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    return res.status(422).render('technician/signup', {
      title: 'Create Technician Account',
      metaDescription: 'Create a technician portal account.',
      error: 'An account already exists for this email.',
      form: { name, email }
    });
  }

  const technician = await Admin.create({ name, email, password, role: 'technician' });
  req.session.technician = technicianSession(technician);
  res.redirect('/technician/application');
}

function logout(req, res) {
  delete req.session.technician;
  res.redirect('/technician/login');
}

async function dashboard(req, res) {
  const technicianId = req.session.technician.id;
  const gate = await getTechnicianGate(req.session.technician);
  const [jobs] = await Promise.all([
    ServiceRequest.find({ assignedTechnician: technicianId }).sort({ createdAt: -1 }).limit(6).lean()
  ]);
  res.render('technician/index', {
    title: 'Technician Portal',
    metaDescription: 'Technician portal overview.',
    location: gate.location,
    gate,
    jobs,
    technician: req.session.technician
  });
}

async function jobs(req, res) {
  const technicianId = req.session.technician.id;
  const gate = await getTechnicianGate(req.session.technician);
  const items = await ServiceRequest.find({ assignedTechnician: technicianId }).sort({ createdAt: -1 }).lean();
  res.render('technician/jobs', {
    title: 'Assigned Jobs',
    metaDescription: 'Technician assigned jobs.',
    items,
    gate,
    statuses: REQUEST_STATUSES,
    technician: req.session.technician
  });
}

async function updateJobStatus(req, res, next) {
  try {
    const technicianId = req.session.technician.id;
    const nextStatus = REQUEST_STATUSES.includes(req.body.status) ? req.body.status : null;
    if (!nextStatus) return res.redirect('/technician/jobs');

    const update = { status: nextStatus };
    if (nextStatus === 'Accepted') update.acceptedAt = new Date();
    if (nextStatus === 'Completed') update.completedAt = new Date();
    await ServiceRequest.updateOne(
      { _id: req.params.id, assignedTechnician: technicianId },
      {
        $set: update,
        $push: {
          statusHistory: {
            status: nextStatus,
            changedBy: technicianId,
            note: req.body.note || 'Technician update',
            changedAt: new Date()
          }
        }
      }
    );
    res.redirect('/technician/jobs');
  } catch (error) {
    next(error);
  }
}

async function liveLocation(req, res) {
  const technicianId = req.session.technician.id;
  const gate = await getTechnicianGate(req.session.technician);
  res.render('technician/live-location', {
    title: 'Live Location',
    metaDescription: 'Share technician live location.',
    technicianLocation: gate.location,
    gate,
    technician: req.session.technician
  });
}

async function updateLiveLocation(req, res, next) {
  try {
    const technicianId = req.session.technician.id;
    const gate = await getTechnicianGate(req.session.technician);
    if (!gate.approved) {
      return res.status(403).json({
        error: gate.message,
        applicationRequired: !gate.application,
        applicationStatus: gate.application?.applicationStatus || 'Application Required'
      });
    }
    const online = req.body.online !== false && req.body.online !== 'false';
    const label = req.session.technician.name || 'Technician';
    const query = { technician: technicianId };

    if (!online) {
      const offline = await TechnicianLocation.findOneAndUpdate(query, {
        technician: technicianId,
        label,
        online: false,
        source: 'technician-portal'
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
    const technicianLocation = await TechnicianLocation.findOneAndUpdate(query, {
      technician: technicianId,
      label,
      online: true,
      location,
      source: 'technician-portal'
    }, { upsert: true, new: true });

    res.json({ ok: true, online: true, location: technicianLocation.location });
  } catch (error) {
    next(error);
  }
}

async function applicationPage(req, res) {
  const gate = await getTechnicianGate(req.session.technician);
  res.render('technician/application', {
    title: 'Technician Application',
    metaDescription: 'Submit technician tools, services, and coverage area.',
    form: gate.application || {
      fullName: req.session.technician.name,
      email: req.session.technician.email
    },
    application: gate.application,
    errors: [],
    services: SERVICE_OPTIONS,
    technician: req.session.technician
  });
}

async function submitApplication(req, res, next) {
  try {
    const data = cleanObject(req.body);
    const servicesOffered = Array.isArray(data.servicesOffered)
      ? data.servicesOffered
      : [data.servicesOffered].filter(Boolean);
    const requiredErrors = [];
    if (!data.fullName) requiredErrors.push({ msg: 'Full name is required.' });
    if (!data.phone) requiredErrors.push({ msg: 'Phone number is required.' });
    if (!data.city) requiredErrors.push({ msg: 'City is required.' });
    if (!servicesOffered.length) requiredErrors.push({ msg: 'Choose at least one service.' });
    if (!data.tools) requiredErrors.push({ msg: 'Tools and equipment are required.' });

    if (requiredErrors.length) {
      return res.status(422).render('technician/application', {
        title: 'Technician Application',
        metaDescription: 'Submit technician tools, services, and coverage area.',
        form: data,
        application: null,
        errors: requiredErrors,
        services: SERVICE_OPTIONS,
        technician: req.session.technician
      });
    }

    await TechnicianApplication.findOneAndUpdate(
      {
        $or: [
          { technicianAccount: req.session.technician.id },
          { email: req.session.technician.email }
        ]
      },
      {
        technicianAccount: req.session.technician.id,
        fullName: data.fullName,
        phone: data.phone,
        email: data.email || req.session.technician.email,
        city: data.city,
        serviceArea: data.serviceArea,
        servicesOffered,
        tools: data.tools,
        vehicle: data.vehicle,
        experience: data.experience,
        photoPaths: (req.files || []).map((file) => `/uploads/${file.filename}`),
        applicationStatus: 'New'
      },
      { upsert: true, new: true }
    );
    res.redirect('/technician');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  loginPage,
  login,
  signupPage,
  signup,
  logout,
  dashboard,
  jobs,
  updateJobStatus,
  liveLocation,
  updateLiveLocation,
  applicationPage,
  submitApplication
};
