require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const methodOverride = require('method-override');
const csrf = require('csurf');

const connectDB = require('./config/db');
const publicRoutes = require('./routes/publicRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const paymentController = require('./controllers/paymentController');
const { attachBusinessSettings } = require('./middleware/settings');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const htmlDir = path.join(__dirname, 'html');
const htmlPages = {
  '/': 'index.html',
  '/services': 'services.html',
  '/about': 'about.html',
  '/contact': 'contact.html',
  '/request-service': 'request-service.html'
};

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://js.stripe.com', 'https://maps.googleapis.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      frameSrc: ["'self'", 'https://js.stripe.com', 'https://www.google.com', 'https://www.google.com/maps'],
      connectSrc: [
        "'self'",
        'https://api.stripe.com',
        'https://geocode.arcgis.com',
        'https://nominatim.openstreetmap.org',
        'https://router.project-osrm.org',
        'https://maps.googleapis.com'
      ]
    }
  }
}));
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.post('/payments/stripe-webhook', express.raw({ type: 'application/json' }), paymentController.stripeWebhook);
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isProduction ? '7d' : 0,
  etag: true
}));
app.get(['/index.html', '/home.html', '/home'], (req, res) => res.redirect(301, '/'));
app.get(['/services.html', '/about.html', '/contact.html', '/request-service.html'], (req, res) => {
  const cleanPath = req.path.replace(/\.html$/, '');
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, `${cleanPath}${query}`);
});
app.use(express.static(htmlDir, {
  index: false,
  maxAge: isProduction ? '7d' : 0,
  etag: true
}));
Object.entries(htmlPages).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(htmlDir, file)));
});
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(methodOverride('_method'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});
app.use(limiter);

app.use(session({
  name: 'psrt.sid',
  secret: process.env.SESSION_SECRET || 'development-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8
  },
  store: process.env.MONGODB_URI
    ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI, ttl: 60 * 60 * 8 })
    : undefined
}));

const csrfProtection = csrf();
app.use((req, res, next) => {
  if (req.path === '/payments/stripe-webhook') return next();
  return csrfProtection(req, res, next);
});
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  res.locals.path = req.path;
  res.locals.user = req.session.admin || null;
  next();
});
app.use(attachBusinessSettings);

app.use('/', publicRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/store-manager', dashboardRoutes);
app.use('/payments', paymentRoutes);
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 3000;
const host = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1');
app.listen(port, host, () => {
  console.log(`Problem Solvers Roadside Technician running at http://${host}:${port}`);
});
