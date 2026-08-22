const path = require('path');
const Review = require('../models/Review');
const Photo = require('../models/Photo');
const ServiceArea = require('../models/ServiceArea');
const ServiceRequest = require('../models/ServiceRequest');
const { SERVICES } = require('../utils/constants');
const { hasDatabase } = require('../utils/dbState');

const POLICY_HTML_DIR = path.join(__dirname, '..', 'html');

const POLICIES = {
  'privacy-policy': {
    title: 'Privacy Policy',
    metaDescription: 'Privacy Policy for Problem Solvers Roadside Technician.',
    intro: 'This Privacy Policy explains how Problem Solvers Roadside Technician collects and uses information submitted through this website.',
    sections: [
      {
        heading: 'Information We Collect',
        body: 'We may collect your name, phone number, email address, vehicle details, service requested, service location, uploaded photos, messages, payment status, and request details.'
      },
      {
        heading: 'How We Use Information',
        body: 'We use this information to respond to service requests, communicate by call or text, process payments, dispatch roadside help, maintain records, and improve the website and customer experience.'
      },
      {
        heading: 'Payments',
        body: 'Payments are processed securely through Stripe. We do not store full card numbers on this website.'
      },
      {
        heading: 'Information Sharing',
        body: 'We do not sell personal information. Information may be shared only as needed with service providers, payment processors, technicians, or as required by law.'
      },
      {
        heading: 'Contact',
        body: 'If you have questions about your information, contact Problem Solvers Roadside Technician by phone, text, or through the contact page.'
      }
    ]
  },
  'terms-of-service': {
    title: 'Terms of Service',
    metaDescription: 'Terms of Service for Problem Solvers Roadside Technician.',
    intro: 'By using this website or requesting service, you agree to these Terms of Service.',
    sections: [
      {
        heading: 'Service Requests',
        body: 'Customers are responsible for providing accurate contact information, vehicle information, service details, and location details so roadside assistance can be provided safely and efficiently.'
      },
      {
        heading: 'Availability',
        body: 'Service availability depends on technician availability, location, road conditions, weather, vehicle access, safety conditions, and the type of roadside issue.'
      },
      {
        heading: 'Pricing',
        body: 'Prices and quotes may depend on the requested service, vehicle type, location, road conditions, and any additional service needs discovered at the scene.'
      },
      {
        heading: 'Customer Responsibility',
        body: 'Customers should remain reachable by phone, provide a safe service location when possible, and make sure they have permission to request service for the vehicle.'
      },
      {
        heading: 'Updates',
        body: 'These terms may be updated as the business grows or as new services, payment options, and technician features are added.'
      }
    ]
  },
  'payment-policy': {
    title: 'Payment Policy',
    metaDescription: 'Payment Policy for Problem Solvers Roadside Technician.',
    intro: 'This Payment Policy explains how roadside assistance payments are handled.',
    sections: [
      {
        heading: 'Secure Payment',
        body: 'Online payments are processed securely through Stripe. Your payment details are handled by Stripe and are not stored as full card numbers on this website.'
      },
      {
        heading: 'Payment Before Dispatch',
        body: 'Some service requests may require payment before a technician is dispatched. Once payment is confirmed, the request can be reviewed and handled for service.'
      },
      {
        heading: 'Quoted Amounts',
        body: 'The amount shown may include the selected service and any applicable travel or service-related charges. Final pricing may change if the vehicle condition, location, or requested work changes.'
      },
      {
        heading: 'Receipts',
        body: 'Receipts and payment confirmations may be provided through Stripe, email, text, or the website confirmation screen.'
      }
    ]
  },
  'cancellation-policy': {
    title: 'Cancellation Policy',
    metaDescription: 'Cancellation Policy for Problem Solvers Roadside Technician.',
    intro: 'We understand that roadside situations can change quickly. Please call or text as soon as possible if you need to cancel.',
    sections: [
      {
        heading: 'Before Dispatch',
        body: 'If a technician has not been dispatched, the request may be cancelled with no service charge or with a refund when applicable.'
      },
      {
        heading: 'After Dispatch',
        body: 'If a technician has already been dispatched, a cancellation fee or partial charge may apply depending on travel time, distance, and work already performed.'
      },
      {
        heading: 'After Arrival',
        body: 'If the technician arrives at the service location and the customer is unavailable, provides the wrong location, or no longer needs service, a charge may still apply.'
      },
      {
        heading: 'How To Cancel',
        body: 'To cancel, call or text the business phone number as soon as possible and include your name, service requested, and service location.'
      }
    ]
  },
  'refund-policy': {
    title: 'Refund Policy',
    metaDescription: 'Refund Policy for Problem Solvers Roadside Technician.',
    intro: 'Refunds are reviewed based on the specific service request, payment status, technician dispatch status, and work performed.',
    sections: [
      {
        heading: 'Eligible Refunds',
        body: 'A full or partial refund may be considered for duplicate payments, unavailable service, incorrect charges, or situations where service could not reasonably be completed.'
      },
      {
        heading: 'Non-Refundable Situations',
        body: 'A refund may not apply when the technician arrives and the customer is not present, the customer provides an incorrect location, the issue is different from the request, the service is completed, or the location is unsafe or inaccessible.'
      },
      {
        heading: 'Partial Refunds',
        body: 'Partial refunds may be used when travel, dispatch, or inspection time has already occurred but the full roadside service could not be completed.'
      },
      {
        heading: 'Processing Time',
        body: 'Approved refunds are returned through the original payment method when possible. Bank and card processing times may vary.'
      }
    ]
  },
  'service-disclaimer': {
    title: 'Service Disclaimer',
    metaDescription: 'Service Disclaimer for Problem Solvers Roadside Technician.',
    intro: 'Problem Solvers Roadside Technician provides mobile roadside assistance, not full mechanical repair or guaranteed vehicle recovery in every situation.',
    sections: [
      {
        heading: 'Roadside Assistance Limits',
        body: 'Some issues cannot be fully resolved roadside. Service depends on vehicle condition, available tools, parts, weather, road conditions, safety, and legal access to the vehicle.'
      },
      {
        heading: 'Safety',
        body: 'Technicians may decline or stop service if the location is unsafe, the vehicle is in a dangerous position, the requested work is not legally permitted, or the work cannot be performed safely.'
      },
      {
        heading: 'Vehicle Responsibility',
        body: 'Customers remain responsible for their vehicle, valuables, insurance, and decisions made after the roadside service is performed.'
      },
      {
        heading: 'No Guarantee',
        body: 'We work to provide reliable service, but we cannot guarantee that every vehicle issue can be repaired or resolved at the service location.'
      }
    ]
  },
  'service-area': {
    title: 'Service Area',
    metaDescription: 'Service Area for Problem Solvers Roadside Technician.',
    intro: 'Problem Solvers Roadside Technician provides mobile roadside assistance based on technician availability and service location.',
    sections: [
      {
        heading: 'Illinois Roadside Assistance',
        body: 'The website is built to support service requests within Illinois. Availability may vary by city, distance, technician schedule, and current dispatch location.'
      },
      {
        heading: 'Travel Charges',
        body: 'Travel charges may apply based on your location, distance, traffic, tolls, road conditions, or other service-related factors.'
      },
      {
        heading: 'Confirmation',
        body: 'Call, text, or submit a request to confirm whether service is available at your exact location.'
      }
    ]
  }
};

const DIRECT_SERVICE_SLUGS = ['tire-change', 'jump-start', 'lockout', 'fuel-delivery'];

const DIRECT_SERVICE_CONTENT = {
  'tire-change': {
    eyebrow: 'Flat tire roadside help',
    title: 'Tire Change Roadside Service',
    metaDescription: 'Request mobile tire change service at your location. Problem Solvers Roadside Technician helps with flat tire swaps using your usable spare tire.',
    heading: 'Tire Change At Your Location',
    summary: 'Got a flat or unsafe tire? We come to your location and install your usable spare so you can get moving again.',
    notice: 'A tire change requires a usable spare tire. If you do not have one, call first so we can talk through the best next step.',
    bullets: ['Spare tire installation', 'Flat tire roadside support', 'Vehicle and service location collected before quote']
  },
  'jump-start': {
    eyebrow: 'Dead battery help',
    title: 'Jump Start Roadside Service',
    metaDescription: 'Request mobile jump start service at your location from Problem Solvers Roadside Technician.',
    heading: 'Jump Start At Your Location',
    summary: 'Dead battery or no-start situation? Request a jump start and get a live quote before payment.',
    notice: 'If the vehicle still will not start after the boost, we can discuss next steps before dispatch.',
    bullets: ['Portable battery boost', 'Battery connection check', 'Fast roadside response']
  },
  lockout: {
    eyebrow: 'Vehicle lockout help',
    title: 'Lockout Roadside Service',
    metaDescription: 'Request mobile vehicle lockout help at your location from Problem Solvers Roadside Technician.',
    heading: 'Lockout Help At Your Location',
    summary: 'Locked your keys inside? Start a lockout request and share your vehicle and location details.',
    notice: 'You must have legal access or permission for the vehicle before service can be performed.',
    bullets: ['Non-destructive entry tools', 'Arrival and vehicle verification', 'Mobile lockout support']
  },
  'fuel-delivery': {
    eyebrow: 'Emergency fuel help',
    title: 'Fuel Delivery Roadside Service',
    metaDescription: 'Request emergency fuel delivery at your location from Problem Solvers Roadside Technician.',
    heading: 'Fuel Delivery At Your Location',
    summary: 'Out of gas or too low to continue safely? Request fuel delivery and get help at your location.',
    notice: 'Fuel cost may be added to the roadside service price depending on the amount needed.',
    bullets: ['Emergency fuel delivery', 'Location-based quote', 'Route guidance to nearby gas']
  }
};

function getDirectServicePages() {
  return DIRECT_SERVICE_SLUGS
    .map((slug) => {
      const service = SERVICES.find((item) => item.slug === slug);
      if (!service) return null;
      return {
        ...service,
        ...DIRECT_SERVICE_CONTENT[slug],
        requestUrl: `/request-service?service=${encodeURIComponent(service.name)}`
      };
    })
    .filter(Boolean);
}

async function home(req, res) {
  const [reviews, photos, serviceAreas] = hasDatabase()
    ? await Promise.all([
      Review.find({ visible: true }).sort({ createdAt: -1 }).limit(3).lean(),
      Photo.find({ visible: true }).sort({ createdAt: -1 }).limit(6).lean(),
      ServiceArea.find({ active: true }).sort({ priority: -1, name: 1 }).lean()
    ])
    : [[], [], []];
  res.render('home', {
    title: 'Fast Mobile Roadside Assistance in Chicago',
    metaDescription: 'Problem Solvers Roadside Technician provides tire changes, jump starts, lockouts, fuel delivery, and tire inflation in Chicago.',
    services: SERVICES,
    reviews,
    photos,
    serviceAreas
  });
}

function home2(req, res) {
  res.render('home-2', {
    title: 'Fast Roadside Assistance When You Need Help',
    metaDescription: 'Problem Solvers Roadside Technician helps stranded drivers request fast roadside assistance, get service details, and call or text for help.'
  });
}

async function chooseService(req, res) {
  return home(req, res);
}

function services(req, res) {
  res.render('services', {
    title: 'Roadside Assistance Services in Chicago',
    metaDescription: 'Mobile tire change, jump start, lockout, fuel delivery, and tire inflation services.',
    services: SERVICES.filter((service) => service.publicRequest),
    directServicePages: getDirectServicePages()
  });
}

function servicePage(req, res, next) {
  const directServicePages = getDirectServicePages();
  const service = directServicePages.find((item) => item.slug === req.params.serviceSlug);
  if (!service) return next();

  res.render('service-page', {
    title: service.title,
    metaDescription: service.metaDescription,
    service,
    relatedServices: directServicePages.filter((item) => item.slug !== service.slug)
  });
}

function about(req, res) {
  res.render('about', {
    title: 'About Problem Solvers Roadside Technician',
    metaDescription: 'Learn about mobile roadside assistance performed at your location in Chicago and surrounding suburbs.'
  });
}

function contact(req, res) {
  res.render('contact', {
    title: 'Contact Problem Solvers Roadside Technician',
    metaDescription: 'Call, text, or send a message for mobile roadside assistance in Chicago and surrounding suburbs.',
    form: {},
    errors: []
  });
}

async function requestService(req, res) {
  let form = {};
  if (req.query.resume) {
    const request = await ServiceRequest.findOne({
      _id: req.query.resume,
      paymentStatus: { $ne: 'Paid' }
    }).lean().catch(() => null);

    if (request) {
      form = {
        existingServiceRequestId: request._id.toString(),
        problem: request.problem,
        serviceDetails: JSON.stringify(request.serviceDetails || {}),
        customerName: request.customerName,
        phone: request.phone,
        email: request.email,
        vehicleMake: request.vehicleMake,
        vehicleModel: request.vehicleModel,
        vehicleColor: request.vehicleColor,
        vehicleYear: request.vehicleYear,
        currentLocation: request.currentLocation,
        message: request.message,
        basePrice: request.basePrice,
        travelFee: request.travelFee,
        totalPrice: request.totalPrice || request.estimatedPrice,
        distanceMiles: request.distanceMiles,
        travelTimeMinutes: request.travelTimeMinutes,
        estimatedArrivalMinutes: request.estimatedArrivalMinutes,
        referenceNumber: request.referenceNumber,
        travelEstimateSource: request.travelEstimateSource,
        longDistanceApplies: request.longDistanceApplies,
        longDistanceTier: request.longDistanceTier,
        travelFeePercent: request.travelFeePercent,
        longDistanceThresholdMinutes: request.longDistanceThresholdMinutes,
        locationLat: request.location?.lat,
        locationLng: request.location?.lng
      };
    }
  } else if (req.query.service) {
    form.problem = req.query.service;
  }

  res.render('request-service', {
    title: 'Request Roadside Assistance',
    metaDescription: 'Request mobile roadside assistance for tire changes, jump starts, lockouts, fuel delivery, and battery service in Chicago.',
    form,
    errors: []
  });
}

function policy(req, res, next) {
  const policyPage = POLICIES[req.params.slug];
  if (!policyPage) {
    return next();
  }

  return res.sendFile(path.join(POLICY_HTML_DIR, `${req.params.slug}.html`), (error) => {
    if (error) {
      next(error);
    }
  });
}

function robots(req, res) {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/sitemap.xml\n`);
}

function sitemap(req, res) {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const urls = [
    '',
    ...DIRECT_SERVICE_SLUGS.map((slug) => `/${slug}`),
    '/services',
    '/about',
    '/contact',
    '/request-service',
    ...Object.keys(POLICIES).map((slug) => `/${slug}`)
  ];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${baseUrl}${url}</loc></url>`).join('\n')}\n</urlset>`);
}

module.exports = { home, home2, chooseService, services, servicePage, about, contact, requestService, policy, robots, sitemap };
