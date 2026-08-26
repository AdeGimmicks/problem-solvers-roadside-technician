const Admin = require('../models/Admin');
const BusinessSettings = require('../models/BusinessSettings');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const Photo = require('../models/Photo');
const Pricing = require('../models/Pricing');
const Review = require('../models/Review');
const ServiceArea = require('../models/ServiceArea');
const ServiceRequest = require('../models/ServiceRequest');
const TechnicianLocation = require('../models/TechnicianLocation');
const VisitorEvent = require('../models/VisitorEvent');
const { sendOwnerSms, sendPaymentStatusSms, smsStatus } = require('../services/smsService');
const { issueToken } = require('../middleware/auth');
const { REQUEST_STATUSES, PUBLIC_SERVICE_NAMES } = require('../utils/constants');
const { cleanObject } = require('../utils/sanitize');

const dashboardTimeZone = process.env.DASHBOARD_TIME_ZONE || 'America/Chicago';
const audienceStartWindow = {
  start: new Date('2026-08-26T05:00:00.000Z'),
  label: 'August 26, 2026 onward',
  slug: 'august-26-2026-onward'
};

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

async function writeAllBusinessSettings(setFields) {
  const result = await BusinessSettings.updateMany({}, { $set: setFields });
  const matched = result.matchedCount ?? result.n ?? 0;
  if (!matched) return BusinessSettings.create(setFields);
  return BusinessSettings.findOne().sort({ acceptingJobsUpdatedAt: -1, updatedAt: -1 });
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
  const [counts, paymentCounts, recentRequests, payments, audience] = await Promise.all([
    ServiceRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ServiceRequest.aggregate([{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }]),
    ServiceRequest.find().sort({ createdAt: -1 }).limit(8).lean(),
    Payment.find().sort({ createdAt: -1 }).limit(6).populate('serviceRequest').lean(),
    getAudienceStats(audienceWindow())
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
    audience,
    statuses: REQUEST_STATUSES
  });
}

function pageLabel(path = '') {
  const cleanPath = String(path || '/').split('?')[0] || '/';
  const labels = {
    '/': 'Home',
    '/services': 'Services',
    '/about': 'About',
    '/contact': 'Contact',
    '/request-service': 'Request Service',
    '/service-area': 'Service Area',
    '/privacy-policy': 'Privacy Policy',
    '/terms-of-service': 'Terms of Service',
    '/payment-policy': 'Payment Policy',
    '/cancellation-policy': 'Cancellation Policy',
    '/refund-policy': 'Refund Policy',
    '/service-disclaimer': 'Service Disclaimer',
    '/tire-change': 'Tire Change Page',
    '/jump-start': 'Jump Start Page',
    '/lockout': 'Lockout Page',
    '/fuel-delivery': 'Fuel Delivery Page'
  };
  return labels[cleanPath] || cleanPath.replace(/^\/+/, '').replaceAll('-', ' ') || 'Home';
}

function formatDashboardTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: dashboardTimeZone,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(value));
}

function formatDashboardDate(value) {
  if (!value) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: dashboardTimeZone,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

function dashboardDateKey(value) {
  if (!value) return 'Unknown date';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: dashboardTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function actionLabel(eventType = '') {
  return {
    page_view: 'Page view',
    page_duration: 'Page time',
    button_click: 'Button click',
    service_interest: 'Service interest',
    request_open: 'Opened Request Service',
    form_start: 'Started form',
    request_start: 'Started request',
    quote_review: 'Reviewed quote',
    checkout_reached: 'Reached checkout',
    payment_success: 'Payment successful',
    request_submit: 'Submitted request'
  }[eventType] || String(eventType).replaceAll('_', ' ');
}

function fallbackSource(event = {}) {
  const path = String(event.landingPath || event.path || '');
  const referrer = String(event.referrer || '');
  if (event.sourceName) return event.sourceName;
  if (event.gclid || event.gbraid || event.wbraid || event.metadata?.gclid || event.metadata?.gbraid || event.metadata?.wbraid) return 'Google Ads';
  if (/[?&](gclid|gbraid|wbraid|gad_source)=/i.test(path)) return 'Google Ads';
  if (/[?&]fbclid=/i.test(path)) return 'Meta Ads';
  if (/google\./i.test(referrer)) return 'Google Search';
  if (referrer) return 'Referral';
  return 'Direct visit';
}

function isOwnerTraffic(event = {}) {
  return event.visitorType === 'owner' || event.visitorType === 'owner_test';
}

function trafficIdentity(event = {}) {
  if (isOwnerTraffic(event)) return 'Owner-test';
  if (!event.visitorId && !event.sessionId && !event.ipAddress && !event.userAgent) return 'Unknown';
  return 'External visitor';
}

function decorateEvent(event = {}) {
  const plain = event.toObject ? event.toObject() : event;
  const durationSeconds = Number(plain.metadata?.durationSeconds || 0);
  const gclid = plain.gclid || plain.metadata?.gclid || '';
  const gbraid = plain.gbraid || plain.metadata?.gbraid || '';
  const wbraid = plain.wbraid || plain.metadata?.wbraid || '';
  const gadSource = plain.gadSource || plain.metadata?.gadSource || '';
  const originalRawLandingUrl = plain.originalRawLandingUrl || plain.metadata?.originalRawLandingUrl || plain.landingPath || plain.path || '';
  const visitorLabel = plain.visitorLabel || (isOwnerTraffic(plain) ? 'OWNER / TEST CLICK' : 'Visitor');
  const sourceMedium = plain.sourceMedium || plain.metadata?.sourceMedium || plain.sourceCategory || (fallbackSource(plain).includes('Ads') ? 'Paid Ads' : 'Unclassified');
  return {
    ...plain,
    actionLabel: actionLabel(plain.eventType),
    pageLabel: pageLabel(plain.path),
    landingLabel: pageLabel(plain.landingPath || plain.path),
    sourceLabel: fallbackSource(plain),
    sourceCategory: plain.sourceCategory || (fallbackSource(plain).includes('Ads') ? 'Paid Ads' : 'Unclassified'),
    sourceMedium,
    visitorLabel,
    trafficIdentity: trafficIdentity(plain),
    deviceLabel: [plain.deviceType, plain.browserName].filter(Boolean).join(' / ') || 'Unknown device',
    locationLabel: [plain.location?.city, plain.location?.region, plain.location?.country].filter(Boolean).join(', ') || 'Location unavailable',
    ispLabel: plain.location?.isp || 'ISP unavailable',
    ipLabel: plain.ipAddress || 'Not stored on older record',
    originalRawLandingUrl,
    gclidLabel: gclid || 'Not provided',
    gbraidLabel: gbraid || 'Not provided',
    wbraidLabel: wbraid || 'Not provided',
    gadSourceLabel: gadSource || 'Not provided',
    primaryAdClickId: gclid || gbraid || wbraid || plain.adClickId || 'Not stored',
    utmSourceLabel: plain.utmSource || plain.metadata?.utmSource || 'Not provided',
    utmMediumLabel: plain.utmMedium || plain.metadata?.utmMedium || 'Not provided',
    utmCampaignLabel: plain.utmCampaign || plain.metadata?.utmCampaign || plain.campaignName || 'Not provided',
    campaignIdLabel: plain.campaignId || plain.metadata?.campaignId || 'Not provided',
    buttonLabel: plain.metadata?.buttonText || plain.metadata?.buttonName || 'Not stored',
    buttonHref: plain.metadata?.buttonHref || '',
    durationSeconds,
    durationDisplay: durationSeconds ? `${durationSeconds}s` : 'Not stored',
    displayTime: formatDashboardTime(plain.createdAt),
    displayDate: formatDashboardDate(plain.createdAt)
  };
}

function journeyPages(ordered) {
  return ordered
    .filter((event) => event.eventType === 'page_view')
    .map((event) => {
      const laterDuration = ordered.find((item) => (
        item.eventType === 'page_duration'
        && item.path === event.path
        && new Date(item.createdAt) >= new Date(event.createdAt)
      ));
      return {
        label: event.pageLabel,
        path: event.path,
        time: event.displayTime,
        durationDisplay: laterDuration?.durationDisplay || 'Not stored'
      };
    });
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildVisitorJourneys(events) {
  const groups = new Map();
  events.forEach((event) => {
    const key = event.sessionId || event.visitorId || event.ipHash || event._id.toString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  });

  return Array.from(groups.entries()).map(([key, group]) => {
    const ordered = group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const first = ordered[0] || {};
    const last = ordered[ordered.length - 1] || {};
    const services = [...new Set(ordered.map((item) => item.serviceName).filter(Boolean))];
    const completed = ordered.some((item) => item.eventType === 'payment_success' || item.eventType === 'request_submit');
    const requestOpened = ordered.some((item) => item.eventType === 'request_open' || pageLabel(item.path) === 'Request Service');
    const formStarted = ordered.some((item) => item.eventType === 'form_start' || item.eventType === 'request_start');
    const quoteRequested = ordered.some((item) => item.eventType === 'quote_review');
    const checkoutReached = ordered.some((item) => item.eventType === 'checkout_reached');
    const started = formStarted || quoteRequested || checkoutReached;
    const buttonsClicked = ordered.filter((item) => item.eventType === 'button_click');
    const pagesViewed = journeyPages(ordered);
    const totalDurationSeconds = ordered.reduce((sum, item) => sum + (Number(item.durationSeconds) || 0), 0);
    const engaged = requestOpened || formStarted || quoteRequested || checkoutReached || completed || buttonsClicked.length > 0 || pagesViewed.length > 1 || totalDurationSeconds >= 10;
    const owner = ordered.some((item) => isOwnerTraffic(item));
    const adClickIds = uniqueValues(ordered.map((item) => item.adClickId || item.primaryAdClickId).filter((item) => item && item !== 'Not stored'));
    const gclids = uniqueValues(ordered.map((item) => item.gclid || item.metadata?.gclid).filter(Boolean));
    const gbraids = uniqueValues(ordered.map((item) => item.gbraid || item.metadata?.gbraid).filter(Boolean));
    const wbraids = uniqueValues(ordered.map((item) => item.wbraid || item.metadata?.wbraid).filter(Boolean));
    const pageViewCount = ordered.filter((item) => item.eventType === 'page_view').length;
    const identity = owner ? 'Owner-test' : trafficIdentity(first);
    return {
      key,
      visitorLabel: owner ? 'OWNER / TEST CLICK' : (first.visitorLabel || 'Visitor'),
      trafficIdentity: identity,
      badge: owner ? 'OWNER / TEST CLICK' : completed ? 'Booked' : started ? 'Started, no booking yet' : 'Browsed only',
      sourceLabel: first.sourceLabel,
      sourceCategory: first.sourceCategory,
      sourceMedium: first.sourceMedium,
      originalRawLandingUrl: first.originalRawLandingUrl || first.landingPath || first.path || 'Not stored',
      landingLabel: first.landingLabel,
      landingPath: first.landingPath || first.path,
      lastPageLabel: last.pageLabel,
      services,
      sessionId: first.sessionId || 'Not stored',
      visitorId: first.visitorId || 'Not stored',
      adClickId: adClickIds[0] || first.primaryAdClickId || 'Not stored',
      gclid: gclids[0] || first.gclidLabel || 'Not provided',
      gbraid: gbraids[0] || first.gbraidLabel || 'Not provided',
      wbraid: wbraids[0] || first.wbraidLabel || 'Not provided',
      gadSource: first.gadSourceLabel || 'Not provided',
      utmSource: first.utmSourceLabel || 'Not provided',
      utmMedium: first.utmMediumLabel || 'Not provided',
      utmCampaign: first.utmCampaignLabel || 'Not provided',
      campaignId: first.campaignIdLabel || 'Not provided',
      ipAddress: first.ipAddress || 'Not stored',
      locationLabel: first.locationLabel,
      ispLabel: first.ispLabel,
      deviceLabel: first.deviceLabel,
      browserName: first.browserName || 'Unknown',
      operatingSystem: first.operatingSystem || 'Unknown',
      pagesViewed,
      pageViewCount,
      buttonsClicked,
      totalDurationSeconds,
      totalDurationDisplay: totalDurationSeconds ? `${totalDurationSeconds}s` : 'Not stored',
      requestOpened,
      formStarted,
      quoteRequested,
      checkoutReached,
      bookingCompleted: completed,
      exitedWithoutAction: !engaged,
      engaged,
      firstSeen: first.createdAt,
      lastSeen: last.createdAt,
      firstSeenDisplay: formatDashboardTime(first.createdAt),
      lastSeenDisplay: formatDashboardTime(last.createdAt),
      events: ordered
    };
  }).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

function buildGoogleAdsAudit(journeys) {
  const googleJourneys = journeys.filter((journey) => journey.sourceLabel === 'Google Ads');
  const externalGoogleJourneys = googleJourneys.filter((journey) => journey.trafficIdentity !== 'Owner-test');
  const ownerGoogleJourneys = googleJourneys.filter((journey) => journey.trafficIdentity === 'Owner-test');
  const unknownGoogleJourneys = googleJourneys.filter((journey) => journey.trafficIdentity === 'Unknown');
  const servicePagePattern = /^\/(tire-change|jump-start|lockout|fuel-delivery)(\?|$)/i;
  const countUniqueVisitors = (items) => uniqueValues(items.map((journey) => journey.visitorId).filter((item) => item !== 'Not stored')).length;
  const countRepeatVisitors = (items) => {
    const counts = new Map();
    items.forEach((journey) => {
      const key = journey.visitorId !== 'Not stored' ? journey.visitorId : journey.key;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.values()).filter((count) => count > 1).length;
  };
  const buildTotals = (items) => {
    const clickIds = uniqueValues(items.map((journey) => journey.adClickId).filter((item) => item !== 'Not stored' && item !== 'Not provided'));
    const abandonedVisits = items.filter((journey) => !journey.bookingCompleted && !journey.checkoutReached && !journey.quoteRequested && !journey.formStarted && !journey.requestOpened).length;
    return {
      landings: items.length,
      sessions: uniqueValues(items.map((journey) => journey.sessionId).filter((item) => item !== 'Not stored')).length,
      pageViews: items.reduce((sum, journey) => sum + (Number(journey.pageViewCount) || 0), 0),
      uniqueAdClickIds: clickIds.length,
      uniqueVisitors: countUniqueVisitors(items),
      homepageOnlyVisits: items.filter((journey) => journey.pagesViewed.length === 1 && String(journey.landingPath || '').replace(/\?.*$/, '') === '/').length,
      servicePageVisits: items.filter((journey) => journey.pagesViewed.some((page) => servicePagePattern.test(page.path || ''))).length,
      engagedVisitors: items.filter((journey) => journey.engaged).length,
      serviceRequestStarts: items.filter((journey) => journey.formStarted || journey.requestOpened).length,
      quoteRequests: items.filter((journey) => journey.quoteRequested).length,
      checkoutReaches: items.filter((journey) => journey.checkoutReached).length,
      completedBookings: items.filter((journey) => journey.bookingCompleted).length,
      repeatVisitors: countRepeatVisitors(items),
      abandonedVisits,
      abandonmentRate: items.length ? Math.round((abandonedVisits / items.length) * 100) : 0
    };
  };
  const dateGroups = buildJourneyLandingDateGroups(googleJourneys).map((dateGroup) => {
    const externalJourneys = dateGroup.journeys.filter((journey) => journey.trafficIdentity !== 'Owner-test');
    return {
      ...dateGroup,
      totals: buildTotals(externalJourneys),
      ownerVisits: dateGroup.journeys.filter((journey) => journey.trafficIdentity === 'Owner-test').length,
      unknownVisits: dateGroup.journeys.filter((journey) => journey.trafficIdentity === 'Unknown').length
    };
  });

  return {
    journeys: googleJourneys,
    dateGroups,
    totals: buildTotals(externalGoogleJourneys),
    ownerTotals: buildTotals(ownerGoogleJourneys),
    unknownTotals: buildTotals(unknownGoogleJourneys)
  };
}

function buildJourneyGroups(journeys, getGroup) {
  const groups = new Map();
  journeys.forEach((journey) => {
    const group = getGroup(journey);
    const key = `${group.category}::${group.label}`;
    if (!groups.has(key)) {
      groups.set(key, {
        label: group.label,
        category: group.category,
        count: 0,
        dateGroups: new Map()
      });
    }
    const current = groups.get(key);
    const dateKey = dashboardDateKey(journey.lastSeen);
    if (!current.dateGroups.has(dateKey)) current.dateGroups.set(dateKey, []);
    current.dateGroups.get(dateKey).push(journey);
    current.count += 1;
  });

  return Array.from(groups.values()).map((group) => ({
    label: group.label,
    category: group.category,
    count: group.count,
    dateGroups: Array.from(group.dateGroups.entries()).map(([date, journeysForDate]) => ({
      date,
      displayDate: journeysForDate[0]?.lastSeen ? formatDashboardDate(journeysForDate[0].lastSeen) : 'Unknown date',
      journeys: journeysForDate.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
    })).sort((a, b) => String(b.date).localeCompare(String(a.date)))
  })).sort((a, b) => b.count - a.count);
}

function buildEventDateGroups(events) {
  const groups = new Map();
  events.forEach((event) => {
    const dateKey = dashboardDateKey(event.createdAt);
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(event);
  });

  return Array.from(groups.entries()).map(([date, eventsForDate]) => ({
    date,
    displayDate: eventsForDate[0]?.createdAt ? formatDashboardDate(eventsForDate[0].createdAt) : 'Unknown date',
    events: eventsForDate.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function buildJourneyDateGroups(journeys) {
  const groups = new Map();
  journeys.forEach((journey) => {
    const dateKey = dashboardDateKey(journey.lastSeen);
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(journey);
  });

  return Array.from(groups.entries()).map(([date, journeysForDate]) => ({
    date,
    displayDate: journeysForDate[0]?.lastSeen ? formatDashboardDate(journeysForDate[0].lastSeen) : 'Unknown date',
    journeys: journeysForDate.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
  })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function buildJourneyLandingDateGroups(journeys) {
  const groups = new Map();
  journeys.forEach((journey) => {
    const dateKey = dashboardDateKey(journey.firstSeen);
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(journey);
  });

  return Array.from(groups.entries()).map(([date, journeysForDate]) => ({
    date,
    displayDate: journeysForDate[0]?.firstSeen ? formatDashboardDate(journeysForDate[0].firstSeen) : 'Unknown date',
    journeys: journeysForDate.sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen))
  })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function audienceDays(req) {
  return Math.max(1, Math.min(Number(req.query.days || 7), 90));
}

function audienceWindow() {
  return { ...audienceStartWindow };
}

async function getAudienceStats(window) {
  const baseMatch = { createdAt: { $gte: window.start } };
  const [visits, uniqueVisitors, ownerVisits, topServices, topPages, topLandingPages, recentEvents, serviceEvents, journeyEvents] = await Promise.all([
    VisitorEvent.countDocuments({ ...baseMatch, eventType: 'page_view' }),
    VisitorEvent.distinct('visitorId', { ...baseMatch, visitorId: { $nin: ['', null] } }),
    VisitorEvent.countDocuments({ ...baseMatch, eventType: 'page_view', visitorType: { $in: ['owner', 'owner_test'] } }),
    VisitorEvent.aggregate([
      { $match: { ...baseMatch, serviceName: { $nin: [null, ''] } } },
      { $group: { _id: '$serviceName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]),
    VisitorEvent.aggregate([
      { $match: { ...baseMatch, eventType: 'page_view', path: { $nin: [null, ''] } } },
      { $group: { _id: '$path', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]),
    VisitorEvent.aggregate([
      { $match: { ...baseMatch, eventType: 'page_view', landingPath: { $nin: [null, ''] } } },
      { $group: { _id: '$landingPath', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]),
    VisitorEvent.find(baseMatch).sort({ createdAt: -1 }).limit(500).lean(),
    VisitorEvent.find({ ...baseMatch, serviceName: { $in: PUBLIC_SERVICE_NAMES } })
      .sort({ createdAt: -1 })
      .lean(),
    VisitorEvent.find(baseMatch).sort({ createdAt: -1 }).lean()
  ]);
  const topServiceCounts = Object.fromEntries(topServices.map((item) => [item._id, item.count]));
  const decoratedServiceEvents = serviceEvents.map(decorateEvent);
  const serviceGroups = PUBLIC_SERVICE_NAMES.map((serviceName) => ({
    serviceName,
    label: `${serviceName} Visitors`,
    count: topServiceCounts[serviceName] || 0,
    events: decoratedServiceEvents.filter((event) => event.serviceName === serviceName)
  }));
  const decoratedRecentEvents = recentEvents.map(decorateEvent);
  const decoratedJourneyEvents = journeyEvents.map(decorateEvent);
  const allVisitorJourneys = buildVisitorJourneys(decoratedJourneyEvents);
  const visitorJourneys = allVisitorJourneys.slice(0, 30);
  const pageVisitEvents = decoratedJourneyEvents.filter((event) => event.eventType === 'page_view');
  const ownerVisitEvents = pageVisitEvents.filter((event) => isOwnerTraffic(event));
  const customerVisitEvents = pageVisitEvents.filter((event) => !isOwnerTraffic(event));
  const sourceGroups = buildJourneyGroups(allVisitorJourneys, (journey) => ({
    label: journey.sourceLabel,
    category: journey.sourceCategory
  }));
  const googleAdsAudit = buildGoogleAdsAudit(allVisitorJourneys);

  return {
    since: window.start,
    windowLabel: window.label,
    visits,
    uniqueVisitors: uniqueVisitors.length,
    ownerVisits,
    customerVisits: Math.max(0, visits - ownerVisits),
    topServices,
    topPages: topPages.map((item) => ({ ...item, label: pageLabel(item._id) })),
    topLandingPages: topLandingPages.map((item) => ({ ...item, label: pageLabel(item._id) })),
    sourceBreakdown: sourceGroups,
    googleAdsAudit,
    pageVisitEvents,
    pageVisitDateGroups: buildEventDateGroups(pageVisitEvents),
    customerVisitEvents,
    customerVisitDateGroups: buildEventDateGroups(customerVisitEvents),
    ownerVisitEvents,
    ownerVisitDateGroups: buildEventDateGroups(ownerVisitEvents),
    knownVisitorRows: allVisitorJourneys,
    knownVisitorDateGroups: buildJourneyDateGroups(allVisitorJourneys),
    recentEvents: decoratedRecentEvents,
    serviceGroups,
    visitorJourneys
  };
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
    currentStatus: title,
    openRequestId: req.query.open || ''
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
    const finalQuotePrice = Number(req.body.finalQuotePrice);
    if (item.requestType === 'autoRepair' && Number.isFinite(finalQuotePrice) && finalQuotePrice > 0) {
      update.finalQuotePrice = Number(finalQuotePrice.toFixed(2));
      update.totalPrice = Number(finalQuotePrice.toFixed(2));
      update.estimatedPrice = Number(finalQuotePrice.toFixed(2));
      update.finalQuoteApprovedAt = item.finalQuoteApprovedAt || new Date();
      update.finalQuoteNote = req.body.finalQuoteNote || '';
      if (adminId) update.finalQuoteApprovedBy = adminId;
    }
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
    if (item.paymentStatus !== 'Paid' && nextPaymentStatus === 'Paid') {
      await sendPaymentStatusSms({ ...item, ...update }, { amount: item.totalPrice || item.estimatedPrice, status: 'Paid' });
    }

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

async function audience(req, res) {
  const days = audienceDays(req);
  const window = audienceWindow();
  const stats = await getAudienceStats(window);
  res.render('dashboard/audience', {
    title: 'Website Audience',
    metaDescription: 'Website visitor and service interest analytics.',
    days,
    audienceWindow: window,
    audience: stats
  });
}

function csvValue(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function csvRow(values) {
  return values.map(csvValue).join(',');
}

function exportFilter(req, window) {
  const type = String(req.query.type || 'all');
  const sourceName = String(req.query.sourceName || '').trim();
  const sourceCategory = String(req.query.sourceCategory || '').trim();
  const query = { createdAt: { $gte: window.start } };
  let label = 'all-visits';

  if (type === 'page') {
    query.eventType = 'page_view';
    label = 'page-visits';
  }
  if (type === 'real') {
    query.eventType = 'page_view';
    query.visitorType = { $nin: ['owner', 'owner_test'] };
    label = 'real-visitor-visits';
  }
  if (type === 'owner') {
    query.eventType = 'page_view';
    query.visitorType = { $in: ['owner', 'owner_test'] };
    label = 'owner-visits';
  }
  if (type === 'known') {
    query.visitorId = { $nin: ['', null] };
    label = 'known-visitors';
  }
  if (type === 'source' && sourceName) {
    query.sourceName = sourceName;
    if (sourceCategory) query.sourceCategory = sourceCategory;
    label = `${sourceName}-${sourceCategory || 'source'}`;
  }

  return {
    query,
    label: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'visitor-export'
  };
}

async function audienceExport(req, res, next) {
  try {
    const window = audienceWindow();
    const filter = exportFilter(req, window);
    const events = await VisitorEvent.find(filter.query).sort({ createdAt: -1 }).lean();
    const decorated = events.map(decorateEvent);
    const rows = [
      csvRow([
        'Time',
        'Date',
        'Visitor Type',
        'Traffic Identity',
        'Visitor Label',
        'Source',
        'Source Category',
        'Event',
        'Page',
        'Path',
        'Landing Page',
        'Landing Path',
        'Original Raw Landing URL',
        'Service',
        'IP Address',
        'Location',
        'ISP',
        'Device',
        'Browser',
        'Operating System',
        'Campaign',
        'Campaign ID',
        'UTM Source',
        'UTM Medium',
        'UTM Campaign',
        'Ad Click ID',
        'GCLID',
        'GBRAID',
        'WBRAID',
        'Source Medium',
        'Duration Seconds',
        'Button Text',
        'Button Link',
        'Referrer',
        'Visitor ID',
        'Session ID'
      ]),
      ...decorated.map((event) => csvRow([
        event.displayTime,
        event.displayDate,
        event.visitorType,
        event.trafficIdentity,
        event.visitorLabel,
        event.sourceLabel,
        event.sourceCategory,
        event.actionLabel,
        event.pageLabel,
        event.path,
        event.landingLabel,
        event.landingPath,
        event.originalRawLandingUrl,
        event.serviceName,
        event.ipLabel,
        event.locationLabel,
        event.ispLabel,
        event.deviceType,
        event.browserName,
        event.operatingSystem,
        event.campaignName,
        event.campaignIdLabel,
        event.utmSourceLabel,
        event.utmMediumLabel,
        event.utmCampaignLabel,
        event.adClickId,
        event.gclidLabel,
        event.gbraidLabel,
        event.wbraidLabel,
        event.sourceMedium,
        event.durationSeconds,
        event.buttonLabel,
        event.buttonHref,
        event.referrer,
        event.visitorId,
        event.sessionId
      ]))
    ];
    const filenameDate = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filter.label}-${window.slug}-${filenameDate}.csv"`);
    res.send(rows.join('\n'));
  } catch (error) {
    next(error);
  }
}

async function cms(req, res) {
  res.render('dashboard/cms', {
    title: 'Website CMS',
    metaDescription: 'Website content management hub.'
  });
}

async function liveLocation(req, res) {
  const technicianId = req.session?.admin?.id || null;
  const [businessSettings, technicianLocation] = await Promise.all([
    BusinessSettings.findOne().sort({ acceptingJobsUpdatedAt: -1, updatedAt: -1 }).lean(),
    TechnicianLocation.findOne(technicianId ? { technician: technicianId } : { technician: null }).lean()
  ]);
  res.render('dashboard/live-location', {
    title: 'Live Technician Location',
    metaDescription: 'Share live technician location for quote distance and ETA.',
    businessSettings,
    technicianLocation,
    acceptingJobs: businessSettings?.acceptingJobs !== false
  });
}

async function updateLiveLocation(req, res, next) {
  try {
    const online = req.body.online !== false && req.body.online !== 'false';
    const hasAcceptingJobs = Object.prototype.hasOwnProperty.call(req.body, 'acceptingJobs');
    const technicianId = req.session?.admin?.id || null;
    const label = req.session?.admin?.name || 'Store Manager';
    const query = technicianId ? { technician: technicianId } : { technician: null };
    if (hasAcceptingJobs && !Object.prototype.hasOwnProperty.call(req.body, 'lat')) {
      const acceptingJobs = req.body.acceptingJobs !== false && req.body.acceptingJobs !== 'false';
      const settingsUpdate = {
        acceptingJobs,
        acceptingJobsUpdatedAt: new Date(),
        acceptingJobsUpdatedBy: label
      };
      const [settings, availability] = await Promise.all([
        writeAllBusinessSettings(settingsUpdate),
        TechnicianLocation.findOneAndUpdate(query, {
          technician: technicianId,
          label,
          acceptingJobs,
          source: 'dashboard-live-location'
        }, { upsert: true, new: true })
      ]);
      const globalAcceptingJobs = settings.acceptingJobs !== false;
      return res.json({
        ok: true,
        online: Boolean(availability.online),
        acceptingJobs: globalAcceptingJobs,
        location: availability.location,
        message: globalAcceptingJobs
          ? 'Accepting jobs. Customers can continue to payment normally.'
          : 'Not accepting immediate jobs. Customers will see the wait-list warning.'
      });
    }
    if (!online) {
      const [settings, offline] = await Promise.all([
        BusinessSettings.findOneAndUpdate({}, {
          $setOnInsert: { acceptingJobs: true }
        }, { sort: { acceptingJobsUpdatedAt: -1, updatedAt: -1 }, upsert: true, new: true }),
        TechnicianLocation.findOneAndUpdate(query, {
          technician: technicianId,
          label,
          online: false,
          source: 'dashboard-live-location'
        }, { upsert: true, new: true })
      ]);
      return res.json({
        ok: true,
        online: false,
        acceptingJobs: settings.acceptingJobs !== false,
        location: offline.location
      });
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
    const technicianLocationUpdate = {
      technician: technicianId,
      label,
      online: true,
      location,
      source: 'dashboard-live-location'
    };
    if (hasAcceptingJobs) {
      technicianLocationUpdate.acceptingJobs = req.body.acceptingJobs !== false && req.body.acceptingJobs !== 'false';
    }
    const settingsUpdate = {
      liveTechnicianLocation: {
        lat,
        lng,
        accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
        source: 'dashboard-live-location',
        updatedAt: new Date()
      }
    };
    if (hasAcceptingJobs) {
      settingsUpdate.acceptingJobs = technicianLocationUpdate.acceptingJobs;
      settingsUpdate.acceptingJobsUpdatedAt = new Date();
      settingsUpdate.acceptingJobsUpdatedBy = label;
    }

    const [settings, technicianLocation] = await Promise.all([
      writeAllBusinessSettings(settingsUpdate),
      TechnicianLocation.findOneAndUpdate(query, technicianLocationUpdate, { upsert: true, new: true })
    ]);

    res.json({
      ok: true,
      online: true,
      acceptingJobs: settings.acceptingJobs !== false,
      location: technicianLocation.location || settings.liveTechnicianLocation
    });
  } catch (error) {
    next(error);
  }
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
  if (request.paymentStatus === 'Paid') {
    await sendPaymentStatusSms(request, payment);
  }
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
    smsStatus: smsStatus(),
    reqQuery: req.query || {},
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
      travelFeePerExtraMile: Number(data.travelFeePerExtraMile || 2),
      maxTravelTimeMinutes: Number(data.maxTravelTimeMinutes || 60),
      longDistanceFee: Number(data.longDistanceFee || 50),
      standardTravelTimeMaxMinutes: Number(data.standardTravelTimeMaxMinutes || 60),
      tierOneTravelTimeMaxMinutes: Number(data.tierOneTravelTimeMaxMinutes || 90),
      tierOneTravelFeePercent: Number(data.tierOneTravelFeePercent || 50),
      tierTwoTravelTimeMaxMinutes: Number(data.tierTwoTravelTimeMaxMinutes || 120),
      tierTwoTravelFeePercent: Number(data.tierTwoTravelFeePercent || 100)
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

async function testSms(req, res) {
  const result = await sendOwnerSms([
    'Problem Solvers Roadside SMS Test',
    `Sent: ${new Date().toLocaleString()}`,
    'If you received this, owner SMS alerts are connected.'
  ].join('\n'));
  const status = result?.ok ? 'sent' : 'failed';
  const message = result?.ok
    ? 'Test SMS sent. Check your phone.'
    : `Test SMS failed: ${result?.error || result?.reason || 'Unknown error'}`;
  res.redirect(`/dashboard/settings?sms=${status}&smsMessage=${encodeURIComponent(message)}`);
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
  audience,
  audienceExport,
  cms,
  liveLocation,
  updateLiveLocation,
  recordPayment,
  settings,
  updateSettings,
  testSms,
  addReview,
  addPhoto,
  addPricing,
  addServiceArea
};
