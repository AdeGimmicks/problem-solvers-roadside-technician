const crypto = require('crypto');
const VisitorEvent = require('../models/VisitorEvent');
const { PUBLIC_SERVICE_NAMES } = require('../utils/constants');

const EVENT_TYPES = ['page_view', 'service_interest', 'request_start', 'quote_review', 'request_submit'];

function clean(value, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength);
}

function hashIp(req) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const salt = process.env.SESSION_SECRET || 'visitor-analytics';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

async function track(req, res) {
  try {
    const eventType = EVENT_TYPES.includes(req.query.eventType) ? req.query.eventType : 'page_view';
    const serviceName = clean(req.query.serviceName, 80);
    const path = clean(req.query.path || req.get('referer') || '/', 260);

    if (serviceName && !PUBLIC_SERVICE_NAMES.includes(serviceName)) {
      return res.status(204).end();
    }

    await VisitorEvent.create({
      visitorId: clean(req.query.visitorId, 80),
      sessionId: clean(req.query.sessionId, 80),
      eventType,
      pageTitle: clean(req.query.pageTitle, 140),
      path,
      serviceName,
      referrer: clean(req.query.referrer, 500),
      userAgent: clean(req.get('user-agent'), 500),
      ipHash: hashIp(req),
      metadata: {
        source: 'website',
        screen: clean(req.query.screen, 40)
      }
    });
  } catch (error) {
    console.error('Visitor analytics tracking failed:', error.message);
  }

  res.status(204).end();
}

module.exports = { track };
