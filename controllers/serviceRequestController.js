const { validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const ServiceRequest = require('../models/ServiceRequest');
const { sendServiceRequestNotification } = require('../services/emailService');
const { cleanObject } = require('../utils/sanitize');

function wantsJson(req) {
  return req.originalUrl.startsWith('/api/') || req.get('accept')?.includes('application/json');
}

function serializeRequest(serviceRequest) {
  return {
    id: serviceRequest._id.toString(),
    referenceNumber: serviceRequest.referenceNumber,
    preferredPaymentMethod: serviceRequest.preferredPaymentMethod,
    paymentStatus: serviceRequest.paymentStatus,
    estimatedArrivalMinutes: serviceRequest.estimatedArrivalMinutes,
    basePrice: serviceRequest.basePrice,
    travelFee: serviceRequest.travelFee,
    totalPrice: serviceRequest.totalPrice,
    distanceMiles: serviceRequest.distanceMiles,
    travelTimeMinutes: serviceRequest.travelTimeMinutes
  };
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
    const serviceRequest = await ServiceRequest.create({
      customer: customer._id,
      customerName: data.customerName,
      phone: data.phone,
      email: data.email,
      vehicleMake: data.vehicleMake,
      vehicleModel: data.vehicleModel,
      vehicleColor: data.vehicleColor,
      vehicleYear: data.vehicleYear,
      problem: data.problem,
      currentLocation: data.currentLocation,
      message: data.message,
      preferredPaymentMethod: 'Card',
      basePrice: data.basePrice,
      travelFee: data.travelFee,
      totalPrice: data.totalPrice || data.estimatedPrice,
      estimatedPrice: data.totalPrice || data.estimatedPrice,
      distanceMiles: data.distanceMiles,
      travelTimeMinutes: data.travelTimeMinutes,
      estimatedArrivalMinutes: data.estimatedArrivalMinutes,
      referenceNumber: data.referenceNumber,
      paymentStatus: data.paymentStatus || 'Payment Pending',
      photoPaths
    });

    await sendServiceRequestNotification(serviceRequest);
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
