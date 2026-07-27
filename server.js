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
const { attachBusinessSettings } = require('./middleware/settings');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

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
      connectSrc: ["'self'", 'https://api.stripe.com']
    }
  }
}));
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isProduction ? '7d' : 0,
  etag: true
}));
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
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
  res.locals.path = req.path;
  res.locals.user = req.session.admin || null;
  next();
});
app.use(attachBusinessSettings);

app.use('/', publicRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/payments', paymentRoutes);
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 3000;
const host = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1');
app.listen(port, host, () => {
  console.log(`Problem Solvers Roadside Technician running at http://${host}:${port}`);
});
