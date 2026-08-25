const { validationResult } = require('express-validator');
const BusinessSettings = require('../models/BusinessSettings');
const Customer = require('../models/Customer');
const ServiceRequest = require('../models/ServiceRequest');
const { sendServiceRequestNotification } = require('../services/emailService');
const { sendNewBookingPush } = require('../services/pushNotificationService');
const { sendNewRequestSms } = require('../services/smsService');
const { cleanObject } = require('../utils/sanitize');

function wantsJson(req) {
  return req.originalUrl.startsWith('/api/') || req.get('accept')?.includes('application/json');
}

async function getTechnicianAvailability() {
  const settings = await BusinessSettings.findOne()
    .sort({ acceptingJobsUpdatedAt: -1, updatedAt: -1 })
    .lean();

  if (!settings || settings.acceptingJobs !== false) {
    return {
      available: true,
      busy: false,
      acceptingJobs: true,
      message: 'Technician is available.'
    };
  }

  return {
    available: false,
    busy: true,
    acceptingJobs: false,
    message: 'No technician is currently accepting immediate jobs. You can continue only if you are willing to wait, or call first before paying.'
  };
}

function serializeRequest(serviceRequest) {
  return {
    id: serviceRequest._id.toString(),
    requestId: serviceRequest.requestId,
    referenceNumber: serviceRequest.referenceNumber || serviceRequest.requestId,
    problem: serviceRequest.problem,
    preferredPaymentMethod: serviceRequest.preferredPaymentMethod,
    paymentStatus: serviceRequest.paymentStatus,
    estimatedArrivalMinutes: serviceRequest.estimatedArrivalMinutes,
    basePrice: serviceRequest.basePrice,
    travelFee: serviceRequest.travelFee,
    totalPrice: serviceRequest.totalPrice,
    distanceMiles: serviceRequest.distanceMiles,
    travelTimeMinutes: serviceRequest.travelTimeMinutes,
    travelEstimateSource: serviceRequest.travelEstimateSource,
    longDistanceApplies: serviceRequest.longDistanceApplies,
    travelFeePercent: serviceRequest.travelFeePercent
  };
}

function parseServiceDetails(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function serviceRequestPayload(data, customerId, serviceDetails, photoPaths = []) {
  const payload = {
    customer: customerId,
    customerName: data.customerName,
    phone: data.phone,
    email: data.email,
    vehicleMake: data.vehicleMake,
    vehicleModel: data.vehicleModel,
    vehicleColor: data.vehicleColor,
    vehicleYear: data.vehicleYear,
    problem: data.problem,
    serviceDetails,
    currentLocation: data.currentLocation,
    location: {
      address: data.currentLocation,
      lat: data.locationLat ? Number(data.locationLat) : undefined,
      lng: data.locationLng ? Number(data.locationLng) : undefined
    },
    message: data.message,
    preferredPaymentMethod: 'Card',
    basePrice: data.basePrice,
    travelFee: data.travelFee,
    totalPrice: data.totalPrice || data.estimatedPrice,
    estimatedPrice: data.totalPrice || data.estimatedPrice,
    distanceMiles: data.distanceMiles,
    travelTimeMinutes: data.travelTimeMinutes,
    estimatedArrivalMinutes: data.estimatedArrivalMinutes,
    travelEstimateSource: data.travelEstimateSource,
    longDistanceApplies: data.longDistanceApplies === 'true',
    longDistanceTier: data.longDistanceTier,
    travelFeePercent: data.travelFeePercent,
    longDistanceThresholdMinutes: data.longDistanceThresholdMinutes,
    referenceNumber: data.referenceNumber,
    paymentStatus: data.paymentStatus || 'Payment Pending'
  };

  if (photoPaths.length) payload.photoPaths = photoPaths;
  return payload;
}

async function submitRequest(req, res, next) {
  try {
    const errors = validationResult(req);
    const form = req.body;
    if (!errors.isEmpty()) {
      if (wantsJson(req)) {
        return res.status(422).json({ errors: errors.array() });
      }
      return res.status(422).render('request-service', {
        title: 'Request Roadside Assistance',
        metaDescription: 'Request mobile roadside assistance in Chicago.',
        form,
        errors: errors.array()
      });
    }

    const data = cleanObject(req.body);
    const serviceDetails = parseServiceDetails(data.serviceDetails);
    if (data.problem === 'Tire Change' && String(serviceDetails.spareTire || '').toLowerCase() === 'no') {
      const message = 'A tire change requires that you already have a usable spare tire. Unfortunately, we cannot complete this service without one.';
      if (wantsJson(req)) return res.status(422).json({ error: message });
      return res.status(422).render('request-service', {
        title: 'Request Roadside Assistance',
        metaDescription: 'Request mobile roadside assistance in Chicago.',
        form,
        errors: [{ msg: message }]
      });
    }

    const customerAcceptedWait = data.customerAcceptedWait === true || data.customerAcceptedWait === 'true';
    const availability = await getTechnicianAvailability();
    if (availability.busy && !customerAcceptedWait) {
      if (wantsJson(req)) {
        return res.status(409).json({
          error: availability.message,
          availability
        });
      }
      return res.status(409).render('request-service', {
        title: 'Request Roadside Assistance',
        metaDescription: 'Request mobile roadside assistance in Chicago.',
        form,
        errors: [{ msg: availability.message }]
      });
    }

    let customer = await Customer.findOne({ phone: data.phone });
    if (!customer) {
      customer = await Customer.create({
        name: data.customerName,
        phone: data.phone,
        email: data.email,
        vehicles: [{ make: data.vehicleMake, model: data.vehicleModel, color: data.vehicleColor, year: data.vehicleYear }]
      });
    }

    const photoPaths = (req.files || []).map((file) => `/uploads/${file.filename}`);
    const payload = serviceRequestPayload(data, customer._id, serviceDetails, photoPaths);
    if (availability.busy && customerAcceptedWait) {
      payload.waitlisted = true;
      payload.waitlistedAt = new Date();
      payload.waitlistReason = 'Customer chose to wait while Store Manager was not accepting immediate jobs.';
    }
    const existingRequest = data.existingServiceRequestId
      ? await ServiceRequest.findOneAndUpdate(
        { _id: data.existingServiceRequestId, paymentStatus: { $ne: 'Paid' } },
        { $set: payload },
        { new: true }
      ).catch(() => null)
      : null;

    const serviceRequest = existingRequest || await ServiceRequest.create({
      ...payload,
      photoPaths
    });

    if (!existingRequest) {
      await sendServiceRequestNotification(serviceRequest);
      await sendNewRequestSms(serviceRequest);
      await sendNewBookingPush(serviceRequest);
    }
    if (wantsJson(req)) {
      return res.status(201).json({ request: serializeRequest(serviceRequest) });
    }
    res.render('success', {
      title: 'Request Received',
      metaDescription: 'Your roadside assistance request has been received.',
      request: serviceRequest
    });
  } catch (error) {
    next(error);
  }
}

async function submitContact(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('contact', {
        title: 'Contact Problem Solvers Roadside Technician',
        metaDescription: 'Contact mobile roadside assistance in Chicago.',
        form: req.body,
        errors: errors.array()
      });
    }

    const data = cleanObject(req.body);
    await sendServiceRequestNotification({
      customerName: data.name,
      phone: data.phone,
      vehicleYear: '',
      vehicleMake: data.vehicle,
      vehicleModel: '',
      problem: data.problem,
      currentLocation: data.location,
      preferredPaymentMethod: 'Not specified'
    });

    res.render('success', {
      title: 'Message Sent',
      metaDescription: 'Your message has been sent.',
      request: { customerName: data.name, problem: data.problem }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { submitRequest, submitContact };
