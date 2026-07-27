const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { SERVICES, REQUEST_STATUSES } = require('./constants');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'html');

const settings = {
  businessName: 'Problem Solvers Roadside Technician',
  phoneNumber: '+13129007711',
  textNumber: '+13129007711',
  email: 'help@example.com',
  businessHours: 'Mon-Sun 6:00 AM - 11:00 PM',
  serviceArea: 'Chicago and surrounding suburbs',
  googleMapsEmbedUrl: '',
  googleReviewUrl: '',
  paymentMethods: {
    card: true,
    applePay: true,
    googlePay: true,
    cash: true,
    cashApp: true,
    zelle: true
  }
};

const reviews = [
  { customerName: 'Chicago Driver', quote: 'Fast response and professional service when my battery died.', rating: 5 },
  { customerName: 'South Side Customer', quote: 'Helped with a flat tire at my location and got me moving again.', rating: 5 },
  { customerName: 'Suburban Driver', quote: 'Clear communication, reliable arrival, and friendly roadside help.', rating: 5 }
];

const serviceAreas = [
  { name: 'Chicago' },
  { name: 'Cicero' },
  { name: 'Oak Park' },
  { name: 'Berwyn' },
  { name: 'Evanston' },
  { name: 'Skokie' }
];

const sampleRequests = [
  {
    _id: 'REQ-1001',
    customerName: 'Sample Customer',
    phone: '+13129007711',
    vehicleYear: '2018',
    vehicleMake: 'Toyota',
    vehicleModel: 'Camry',
    problem: 'Flat tire',
    currentLocation: 'Chicago, IL',
    status: 'Pending',
    createdAt: new Date()
  },
  {
    _id: 'REQ-1002',
    customerName: 'Second Customer',
    phone: '+13129007711',
    vehicleYear: '2020',
    vehicleMake: 'Honda',
    vehicleModel: 'Accord',
    problem: 'Jump start',
    currentLocation: 'Oak Park, IL',
    status: 'Accepted',
    createdAt: new Date()
  }
];

const pages = [
  {
    view: 'home',
    file: 'index.html',
    locals: {
      title: 'Fast Mobile Roadside Assistance in Chicago',
      metaDescription: 'Problem Solvers Roadside Technician provides tire changes, jump starts, lockouts, fuel delivery, battery service, and light roadside repairs in Chicago.',
      path: '/',
      services: SERVICES,
      reviews,
      photos: [],
      serviceAreas
    }
  },
  {
    view: 'services',
    file: 'services.html',
    locals: {
      title: 'Roadside Assistance Services in Chicago',
      metaDescription: 'Mobile tire change, jump start, battery testing, battery replacement, lockout, fuel delivery, tire inflation, and light roadside repair services.',
      path: '/services',
      services: SERVICES
    }
  },
  {
    view: 'about',
    file: 'about.html',
    locals: {
      title: 'About Problem Solvers Roadside Technician',
      metaDescription: 'Learn about mobile roadside assistance performed at your location in Chicago and surrounding suburbs.',
      path: '/about'
    }
  },
  {
    view: 'contact',
    file: 'contact.html',
    locals: {
      title: 'Contact Problem Solvers Roadside Technician',
      metaDescription: 'Call, text, or send a message for mobile roadside assistance in Chicago and surrounding suburbs.',
      path: '/contact',
      form: {},
      errors: []
    }
  },
  {
    view: 'request-service',
    file: 'request-service.html',
    locals: {
      title: 'Request Roadside Assistance',
      metaDescription: 'Request mobile roadside assistance for tire changes, jump starts, lockouts, fuel delivery, and battery service in Chicago.',
      path: '/request-service',
      form: {},
      errors: []
    }
  },
  {
    view: 'dashboard/login',
    file: 'dashboard-login.html',
    locals: {
      title: 'Dashboard Login',
      metaDescription: 'Secure admin login.',
      path: '/dashboard/login',
      error: null
    }
  },
  {
    view: 'dashboard/index',
    file: 'dashboard.html',
    locals: {
      title: 'Dashboard Overview',
      metaDescription: 'Admin dashboard overview.',
      path: '/dashboard',
      user: { name: 'Owner' },
      statusCounts: { Pending: 1, Accepted: 1, Completed: 0, Cancelled: 0 },
      recentRequests: sampleRequests,
      payments: [],
      statuses: REQUEST_STATUSES
    }
  },
  {
    view: 'dashboard/requests',
    file: 'dashboard-requests.html',
    locals: {
      title: 'Service Requests',
      metaDescription: 'Manage roadside assistance requests.',
      path: '/dashboard/requests',
      user: { name: 'Owner' },
      items: sampleRequests,
      statuses: REQUEST_STATUSES,
      currentStatus: ''
    }
  },
  {
    view: 'dashboard/customers',
    file: 'dashboard-customers.html',
    locals: {
      title: 'Customers',
      metaDescription: 'Customer list.',
      path: '/dashboard/customers',
      user: { name: 'Owner' },
      items: [
        {
          name: 'Sample Customer',
          phone: '+13129007711',
          email: 'customer@example.com',
          vehicles: [{ year: '2018', make: 'Toyota', model: 'Camry' }]
        }
      ]
    }
  },
  {
    view: 'dashboard/payments',
    file: 'dashboard-payments.html',
    locals: {
      title: 'Payments',
      metaDescription: 'Payment records.',
      path: '/dashboard/payments',
      user: { name: 'Owner' },
      items: [
        {
          amount: 75,
          method: 'Cash',
          status: 'Paid',
          serviceRequest: { _id: 'REQ-1001' },
          createdAt: new Date()
        }
      ]
    }
  },
  {
    view: 'dashboard/settings',
    file: 'dashboard-settings.html',
    locals: {
      title: 'Business Settings',
      metaDescription: 'Business settings.',
      path: '/dashboard/settings',
      user: { name: 'Owner' },
      businessSettings: settings,
      reviews,
      photos: [],
      pricing: SERVICES.map((service) => ({
        serviceName: service.name,
        startingPrice: Number(String(service.price).replace(/[^0-9.]/g, '')) || 0
      })),
      areas: serviceAreas
    }
  }
];

function rewriteForStatic(html) {
  return html
    .replaceAll('href="/css/styles.css"', 'href="./css/styles.css"')
    .replaceAll('src="/js/main.js"', 'src="./js/main.js"')
    .replaceAll('src="/images/brand/', 'src="./images/')
    .replaceAll('href="/"', 'href="./index.html"')
    .replaceAll('href="/services"', 'href="./services.html"')
    .replaceAll('href="/about"', 'href="./about.html"')
    .replaceAll('href="/contact"', 'href="./contact.html"')
    .replaceAll('href="/request-service"', 'href="./request-service.html"')
    .replaceAll('href="/dashboard/login"', 'href="./dashboard-login.html"')
    .replaceAll('href="/dashboard"', 'href="./dashboard.html"')
    .replaceAll('href="/dashboard/requests"', 'href="./dashboard-requests.html"')
    .replaceAll('href="/dashboard/customers"', 'href="./dashboard-customers.html"')
    .replaceAll('href="/dashboard/payments"', 'href="./dashboard-payments.html"')
    .replaceAll('href="/dashboard/settings"', 'href="./dashboard-settings.html"')
    .replaceAll('action="/contact"', 'action="#"')
    .replaceAll('action="/request-service"', 'action="#"')
    .replaceAll('action="/dashboard/login"', 'action="#"')
    .replaceAll('action="/dashboard/logout"', 'action="#"')
    .replaceAll(/action="\/dashboard\/[^"]+"/g, 'action="#"')
    .replaceAll('name="_csrf"', 'data-name="_csrf"');
}

async function renderPage(page) {
  const html = await ejs.renderFile(path.join(root, 'views', `${page.view}.ejs`), {
    ...page.locals,
    settings,
    csrfToken: 'static-preview',
    process
  }, {
    root: path.join(root, 'views'),
    views: [path.join(root, 'views')]
  });
  fs.writeFileSync(path.join(outDir, page.file), rewriteForStatic(html));
}

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'css'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'js'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'images'), { recursive: true });
  fs.copyFileSync(path.join(root, 'public/css/styles.css'), path.join(outDir, 'css/styles.css'));
  fs.copyFileSync(path.join(root, 'public/js/main.js'), path.join(outDir, 'js/main.js'));
  for (const file of fs.readdirSync(path.join(root, 'public/images/brand'))) {
    fs.copyFileSync(path.join(root, 'public/images/brand', file), path.join(outDir, 'images', file));
  }

  for (const page of pages) {
    await renderPage(page);
  }

  console.log(`Static HTML exported to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
