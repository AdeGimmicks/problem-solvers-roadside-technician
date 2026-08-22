const crypto = require('crypto');
const VisitorEvent = require('../models/VisitorEvent');
const { PUBLIC_SERVICE_NAMES } = require('../utils/constants');

const EVENT_TYPES = ['page_view', 'service_interest', 'request_start', 'quote_review', 'request_submit'];

function clean(value, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength);
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || '';
}

function hashIp(ip) {
  const salt = process.env.SESSION_SECRET || 'visitor-analytics';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function safeUrl(value) {
  try {
    return new URL(value, 'https://problemsolversroadside.com');
  } catch (error) {
    return new URL('/', 'https://problemsolversroadside.com');
  }
}

function firstParam(searchParams, names) {
  return names.map((name) => clean(searchParams.get(name), 120)).find(Boolean) || '';
}

function classifySource(path, referrer) {
  const url = safeUrl(path);
  const params = url.searchParams;
  const ref = referrer ? safeUrl(referrer) : null;
  const refHost = ref?.hostname?.replace(/^www\./, '') || '';
  const utmSource = firstParam(params, ['utm_source']);
  const utmMedium = firstParam(params, ['utm_medium']);
  const campaignName = firstParam(params, ['utm_campaign', 'campaign']);
  const adClickId = firstParam(params, ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid']);
  const hasGoogleAdClick = Boolean(params.get('gclid') || params.get('gbraid') || params.get('wbraid'));
  const hasFacebookAdClick = Boolean(params.get('fbclid'));
  const hasMicrosoftAdClick = Boolean(params.get('msclkid'));
  const paidMedium = /^(cpc|ppc|paid|paid_social|paid-search|display)$/i.test(utmMedium);

  if (hasGoogleAdClick || (/google/i.test(utmSource) && paidMedium)) {
    return { sourceCategory: 'Paid Ads', sourceName: 'Google Ads', campaignName, adClickId };
  }
  if (hasFacebookAdClick || (/(facebook|instagram|meta)/i.test(utmSource) && paidMedium)) {
    return { sourceCategory: 'Paid Ads', sourceName: 'Meta Ads', campaignName, adClickId };
  }
  if (hasMicrosoftAdClick || (/(bing|microsoft)/i.test(utmSource) && paidMedium)) {
    return { sourceCategory: 'Paid Ads', sourceName: 'Microsoft Ads', campaignName, adClickId };
  }
  if (utmSource) {
    return { sourceCategory: utmMedium || 'Campaign', sourceName: utmSource, campaignName, adClickId };
  }
  if (!refHost || refHost.includes('problemsolversroadside.com')) {
    return { sourceCategory: 'Direct', sourceName: 'Direct visit', campaignName, adClickId };
  }
  if (/google\./i.test(refHost)) return { sourceCategory: 'Organic Search', sourceName: 'Google Search', campaignName, adClickId };
  if (/bing\./i.test(refHost)) return { sourceCategory: 'Organic Search', sourceName: 'Bing Search', campaignName, adClickId };
  if (/(facebook|instagram|t\.co|twitter|x\.com|youtube|tiktok)/i.test(refHost)) {
    return { sourceCategory: 'Social Referral', sourceName: refHost, campaignName, adClickId };
  }
  return { sourceCategory: 'Referral', sourceName: refHost, campaignName, adClickId };
}

function parseDevice(userAgent) {
  const ua = String(userAgent || '');
  const deviceType = /mobile|iphone|android/i.test(ua) ? 'Mobile' : /ipad|tablet/i.test(ua) ? 'Tablet' : 'Desktop';
  const browserName = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
      : /Safari\//.test(ua) ? 'Safari'
        : /Firefox\//.test(ua) ? 'Firefox'
          : 'Unknown';
  const operatingSystem = /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
      : /Android/i.test(ua) ? 'Android'
        : /iPhone|iPad/i.test(ua) ? 'iOS'
          : 'Unknown';
  return { deviceType, browserName, operatingSystem };
}

function getLocation(req) {
  return {
    city: clean(req.headers['x-vercel-ip-city'] || req.headers['cf-ipcity'], 80),
    region: clean(req.headers['x-vercel-ip-country-region'] || req.headers['cf-region'], 80),
    country: clean(req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'], 80)
  };
}

function isOwnerVisit(req, ip, visitorId) {
  if (req.session?.admin?.id) return true;
  const ownerIps = String(process.env.OWNER_IPS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const ownerVisitorIds = String(process.env.OWNER_VISITOR_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return ownerIps.includes(ip) || ownerVisitorIds.includes(visitorId);
}

async function track(req, res) {
  try {
    const eventType = EVENT_TYPES.includes(req.query.eventType) ? req.query.eventType : 'page_view';
    const serviceName = clean(req.query.serviceName, 80);
    const path = clean(req.query.path || req.get('referer') || '/', 260);
    const landingPath = clean(req.query.landingPath || path, 260);
    const referrer = clean(req.query.referrer, 500);
    const visitorId = clean(req.query.visitorId, 80);
    const ipAddress = clean(getClientIp(req), 80);
    const userAgent = clean(req.get('user-agent'), 500);
    const source = classifySource(landingPath || path, referrer);
    const device = parseDevice(userAgent);
    const ownerVisit = isOwnerVisit(req, ipAddress, visitorId);

    if (serviceName && !PUBLIC_SERVICE_NAMES.includes(serviceName)) {
      return res.status(204).end();
    }

    await VisitorEvent.create({
      visitorId,
      sessionId: clean(req.query.sessionId, 80),
      eventType,
      pageTitle: clean(req.query.pageTitle, 140),
      path,
      landingPath,
      serviceName,
      referrer,
      userAgent,
      ipAddress,
      ipHash: hashIp(ipAddress),
      visitorType: ownerVisit ? 'owner' : 'visitor',
      visitorLabel: ownerVisit ? `Owner${req.session?.admin?.name ? `: ${req.session.admin.name}` : ''}` : 'Visitor',
      ...source,
      ...device,
      location: getLocation(req),
      metadata: {
        source: 'website',
        screen: clean(req.query.screen, 40),
        timezone: clean(req.query.timezone, 80),
        language: clean(req.query.language, 40),
        ownerMatchedBy: ownerVisit ? (req.session?.admin?.id ? 'dashboard-session' : 'configured-identity') : ''
      }
    });
  } catch (error) {
    console.error('Visitor analytics tracking failed:', error.message);
  }

  res.status(204).end();
}

module.exports = { track };
