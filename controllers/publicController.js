const Review = require('../models/Review');
const Photo = require('../models/Photo');
const ServiceArea = require('../models/ServiceArea');
const { SERVICES } = require('../utils/constants');
const { hasDatabase } = require('../utils/dbState');

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
    metaDescription: 'Problem Solvers Roadside Technician provides tire changes, jump starts, lockouts, fuel delivery, battery service, and light roadside repairs in Chicago.',
    services: SERVICES,
    reviews,
    photos,
    serviceAreas
  });
}

function services(req, res) {
  res.render('services', {
    title: 'Roadside Assistance Services in Chicago',
    metaDescription: 'Mobile tire change, jump start, battery testing, battery replacement, lockout, fuel delivery, tire inflation, and light roadside repair services.',
    services: SERVICES
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

function requestService(req, res) {
  res.render('request-service', {
    title: 'Request Roadside Assistance',
    metaDescription: 'Request mobile roadside assistance for tire changes, jump starts, lockouts, fuel delivery, and battery service in Chicago.',
    form: {},
    errors: []
  });
}

function robots(req, res) {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/sitemap.xml\n`);
}

function sitemap(req, res) {
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const urls = ['', '/services', '/about', '/contact', '/request-service'];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${baseUrl}${url}</loc></url>`).join('\n')}\n</urlset>`);
}

module.exports = { home, services, about, contact, requestService, robots, sitemap };
