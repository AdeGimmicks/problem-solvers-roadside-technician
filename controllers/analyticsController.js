const crypto = require('crypto');
const VisitorEvent = require('../models/VisitorEvent');
const { PUBLIC_SERVICE_NAMES } = require('../utils/constants');

const EVENT_TYPES = [
  'page_view',
  'page_duration',
  'button_click',
  'service_interest',
  'request_open',
  'form_start',
  'request_start',
  'quote_review',
  'checkout_reached',
  'payment_success',
  'request_submit'
];

function clean(value, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanUrl(value) {
  return clean(value, 2000);
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return normalizeIp(forwarded || req.ip || req.socket?.remoteAddress || '');
}

function normalizeIp(ip) {
  return String(ip || '').replace(/^::ffff:/, '').trim();
}

function isPublicIp(ip) {
  const value = normalizeIp(ip);
  if (!value || value === '::1' || value === '127.0.0.1') return false;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(value)) return false;
  if (/^(fc|fd|fe80):/i.test(value)) return false;
  return true;
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

function firstValue(...values) {
  return values.map((value) => clean(value, 180)).find(Boolean) || '';
}

function numberParam(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function classifySource(path, referrer, preserved = {}) {
  const url = safeUrl(preserved.originalRawLandingUrl || path);
  const params = url.searchParams;
  const ref = referrer ? safeUrl(referrer) : null;
  const refHost = ref?.hostname?.replace(/^www\./, '') || '';
  const utmSource = firstParam(params, ['utm_source']);
  const utmMedium = firstParam(params, ['utm_medium']);
  const campaignName = firstParam(params, ['utm_campaign', 'campaign']);
  const campaignId = firstParam(params, ['utm_id', 'campaignid', 'gad_campaignid']);
  const gclid = firstValue(params.get('gclid'), preserved.gclid);
  const gbraid = firstValue(params.get('gbraid'), preserved.gbraid);
  const wbraid = firstValue(params.get('wbraid'), preserved.wbraid);
  const gadSource = firstValue(params.get('gad_source'), preserved.gadSource);
  const adClickId = firstValue(gclid, gbraid, wbraid, firstParam(params, ['fbclid', 'msclkid', 'ttclid']), preserved.adClickId);
  const hasGoogleAdClick = Boolean(gclid || gbraid || wbraid);
  const hasFacebookAdClick = Boolean(params.get('fbclid'));
  const hasMicrosoftAdClick = Boolean(params.get('msclkid'));
  const paidMedium = /^(cpc|ppc|paid|paid_social|paid-search|display)$/i.test(utmMedium);

  if (hasGoogleAdClick || (/google/i.test(utmSource) && paidMedium)) {
    return { sourceCategory: 'Paid Ads', sourceName: 'Google Ads', campaignName, campaignId, adClickId, sourceMedium: utmMedium || 'Paid Ads', utmSource, utmMedium, utmCampaign: campaignName, gclid, gbraid, wbraid, gadSource };
  }
  if (hasFacebookAdClick || (/(facebook|instagram|meta)/i.test(utmSource) && paidMedium)) {
    return { sourceCategory: 'Paid Ads', sourceName: 'Meta Ads', campaignName, campaignId, adClickId, sourceMedium: utmMedium || 'Paid Ads', utmSource, utmMedium, utmCampaign: campaignName, gclid, gbraid, wbraid, gadSource };
  }
  if (hasMicrosoftAdClick || (/(bing|microsoft)/i.test(utmSource) && paidMedium)) {
    return { sourceCategory: 'Paid Ads', sourceName: 'Microsoft Ads', campaignName, campaignId, adClickId, sourceMedium: utmMedium || 'Paid Ads', utmSource, utmMedium, utmCampaign: campaignName, gclid, gbraid, wbraid, gadSource };
  }
  if (utmSource) {
    return { sourceCategory: utmMedium || 'Campaign', sourceName: utmSource, campaignName, campaignId, adClickId, sourceMedium: utmMedium || 'Campaign', utmSource, utmMedium, utmCampaign: campaignName, gclid, gbraid, wbraid, gadSource };
  }
  if (!refHost || refHost.includes('problemsolversroadside.com')) {
    return { sourceCategory: 'Direct', sourceName: 'Direct visit', campaignName, campaignId, adClickId, sourceMedium: 'Direct', utmSource, utmMedium, utmCampaign: campaignName, gclid, gbraid, wbraid, gadSource };
  }
  if (/google\./i.test(refHost)) return { sourceCategory: 'Organic Search', sourceName: 'Google Search', campaignName, campaignId, adClickId, sourceMedium: 'Organic Search', utmSource, utmMedium, utmCampaign: campaignName, gclid, gbraid, wbraid, gadSource };
  if (/bing\./i.test(refHost)) return { sourceCategory: 'Organic Search', sourceName: 'Bing Search', campaignName, campaignId, adClickId, sourceMedium: 'Organic Search', utmSource, utmMedium, utmCampaign: campaignName, gclid, gbraid, wbraid, gadSource };
  if (/(facebook|instagram|t\.co|twitter|x\.com|youtube|tiktok)/i.test(refHost)) {
    return { sourceCategory: 'Social Referral', sourceName: refHost, campaignName, campaignId, adClickId, sourceMedium: 'Social Referral', utmSource, utmMedium, utmCampaign: campaignName, gclid, gbraid, wbraid, gadSource };
  }
  return { sourceCategory: 'Referral', sourceName: refHost, campaignName, campaignId, adClickId, sourceMedium: 'Referral', utmSource, utmMedium, utmCampaign: campaignName, gclid, gbraid, wbraid, gadSource };
}

function parseDevice(userAgent) {
  const ua = String(userAgent || '');
  const deviceType = /ipad|tablet/i.test(ua) ? 'Tablet'
    : /mobile|iphone|android/i.test(ua) ? 'Mobile'
      : ua ? 'Desktop' : 'Unknown device';
  const browserName = /CriOS\//.test(ua) ? 'Chrome'
    : /FxiOS\//.test(ua) ? 'Firefox'
      : /Edg\//.test(ua) ? 'Edge'
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

function locationFromHeaders(req) {
  return cleanObject({
    city: clean(req.headers['x-vercel-ip-city'] || req.headers['cf-ipcity'], 80),
    region: clean(req.headers['x-vercel-ip-country-region'] || req.headers['cf-region'], 80),
    country: clean(req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'], 80),
    postal: clean(req.headers['x-vercel-ip-postal-code'], 40),
    timezone: clean(req.headers['x-vercel-ip-timezone'], 80)
  });
}

function cleanObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item));
}

async function lookupIpLocation(ip) {
  if (!isPublicIp(ip) || process.env.DISABLE_IP_GEOLOCATION === 'true') return {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ProblemSolversRoadside/1.0' }
    });
    if (!response.ok) return {};
    const data = await response.json();
    return cleanObject({
      city: clean(data.city, 80),
      region: clean(data.region || data.region_code, 80),
      country: clean(data.country_name || data.country, 80),
      postal: clean(data.postal, 40),
      timezone: clean(data.timezone, 80),
      isp: clean(data.org || data.asn, 120)
    });
  } catch (error) {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

async function getLocation(req, ip) {
  const headerLocation = locationFromHeaders(req);
  if (headerLocation.city && headerLocation.region && headerLocation.country) return headerLocation;
  const lookedUpLocation = await lookupIpLocation(ip);
  return cleanObject({
    ...lookedUpLocation,
    ...headerLocation,
    city: headerLocation.city || lookedUpLocation.city,
    region: headerLocation.region || lookedUpLocation.region,
    country: headerLocation.country || lookedUpLocation.country,
    postal: headerLocation.postal || lookedUpLocation.postal,
    timezone: headerLocation.timezone || lookedUpLocation.timezone,
    isp: headerLocation.isp || lookedUpLocation.isp
  });
}

function identifyOwnerVisit(req, ip, visitorId) {
  if (req.session?.admin?.id) {
    return { isOwner: true, visitorType: 'owner', visitorLabel: `Owner${req.session.admin.name ? `: ${req.session.admin.name}` : ''}`, matchedBy: 'dashboard-session' };
  }
  if (req.query.ownerBrowser === '1') {
    return { isOwner: true, visitorType: 'owner_test', visitorLabel: 'OWNER / TEST CLICK', matchedBy: 'owner-browser' };
  }
  const ownerIps = String(process.env.OWNER_IPS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const ownerVisitorIds = String(process.env.OWNER_VISITOR_IDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (ownerIps.includes(ip)) return { isOwner: true, visitorType: 'owner_test', visitorLabel: 'OWNER / TEST CLICK', matchedBy: 'configured-ip' };
  if (ownerVisitorIds.includes(visitorId)) return { isOwner: true, visitorType: 'owner_test', visitorLabel: 'OWNER / TEST CLICK', matchedBy: 'configured-visitor-id' };
  return { isOwner: false, visitorType: 'visitor', visitorLabel: 'Visitor', matchedBy: '' };
}

async function track(req, res) {
  try {
    const eventType = EVENT_TYPES.includes(req.query.eventType) ? req.query.eventType : 'page_view';
    const serviceName = clean(req.query.serviceName, 80);
    const path = cleanUrl(req.query.path || req.get('referer') || '/');
    const landingPath = cleanUrl(req.query.landingPath || path);
    const originalRawLandingUrl = cleanUrl(req.query.originalRawLandingUrl || landingPath || path);
    const referrer = clean(req.query.referrer, 500);
    const visitorId = clean(req.query.visitorId, 80);
    const ipAddress = clean(getClientIp(req), 80);
    const userAgent = clean(req.get('user-agent'), 500);
    const source = classifySource(landingPath || path, referrer, {
      adClickId: req.query.adClickId,
      gclid: req.query.gclid,
      gbraid: req.query.gbraid,
      wbraid: req.query.wbraid,
      gadSource: req.query.gadSource,
      originalRawLandingUrl
    });
    const device = parseDevice(userAgent);
    const ownerVisit = identifyOwnerVisit(req, ipAddress, visitorId);

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
      originalRawLandingUrl,
      serviceName,
      referrer,
      userAgent,
      ipAddress,
      ipHash: hashIp(ipAddress),
      visitorType: ownerVisit.visitorType,
      visitorLabel: ownerVisit.visitorLabel,
      ...source,
      ...device,
      location: await getLocation(req, ipAddress),
      metadata: {
        source: 'website',
        screen: clean(req.query.screen, 40),
        timezone: clean(req.query.timezone, 80),
        language: clean(req.query.language, 40),
        sourceMedium: source.sourceMedium,
        originalRawLandingUrl,
        utmSource: source.utmSource,
        utmMedium: source.utmMedium,
        utmCampaign: source.utmCampaign,
        campaignId: source.campaignId,
        gclid: source.gclid,
        gbraid: source.gbraid,
        wbraid: source.wbraid,
        gadSource: source.gadSource,
        durationSeconds: numberParam(req.query.durationSeconds),
        buttonText: clean(req.query.buttonText, 120),
        buttonHref: clean(req.query.buttonHref, 260),
        buttonName: clean(req.query.buttonName, 80),
        stepName: clean(req.query.stepName, 80),
        ownerMatchedBy: ownerVisit.matchedBy
      }
    });
  } catch (error) {
    console.error('Visitor analytics tracking failed:', error.message);
  }

  res.status(204).end();
}

module.exports = { track };
