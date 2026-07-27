require('dotenv').config();

const connectDB = require('../config/db');
const Admin = require('../models/Admin');
const BusinessSettings = require('../models/BusinessSettings');
const Pricing = require('../models/Pricing');
const Review = require('../models/Review');
const ServiceArea = require('../models/ServiceArea');
const { SERVICES } = require('./constants');

async function seed() {
  await connectDB();

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (!existingAdmin) {
      await Admin.create({
        name: 'Owner',
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        role: 'owner'
      });
    }
  }

  await BusinessSettings.findOneAndUpdate({}, {
    businessName: process.env.BUSINESS_NAME || 'Problem Solvers Roadside Technician',
    phoneNumber: process.env.BUSINESS_PHONE || '+13125550199',
    textNumber: process.env.BUSINESS_TEXT || process.env.BUSINESS_PHONE || '+13125550199',
    email: process.env.BUSINESS_EMAIL || 'help@example.com',
    businessHours: process.env.BUSINESS_HOURS || 'Mon-Sun 6:00 AM - 11:00 PM',
    serviceArea: process.env.SERVICE_AREA || 'Chicago and surrounding suburbs',
    googleMapsEmbedUrl: process.env.GOOGLE_MAPS_EMBED_URL || '',
    googleReviewUrl: process.env.GOOGLE_REVIEW_URL || '',
    seo: {
      metaTitle: 'Roadside Assistance Chicago | Problem Solvers Roadside Technician',
      metaDescription: 'Fast mobile roadside assistance in Chicago for jump starts, flat tires, battery replacement, fuel delivery, and car lockouts.',
      keywords: ['Roadside Assistance Chicago', 'Jump Start Chicago', 'Flat Tire Chicago', 'Battery Replacement Chicago']
    }
  }, { upsert: true });

  for (const service of SERVICES) {
    const amount = Number(String(service.price).replace(/[^0-9.]/g, '')) || 0;
    await Pricing.findOneAndUpdate(
      { serviceName: service.name },
      { serviceName: service.name, startingPrice: amount, description: service.description },
      { upsert: true }
    );
  }

  for (const name of ['Chicago', 'Cicero', 'Oak Park', 'Berwyn', 'Evanston', 'Skokie']) {
    await ServiceArea.findOneAndUpdate({ name }, { name, active: true }, { upsert: true });
  }

  const reviewCount = await Review.countDocuments();
  if (!reviewCount) {
    await Review.insertMany([
      { customerName: 'Chicago Driver', quote: 'Fast response and professional service when my battery died.', rating: 5 },
      { customerName: 'South Side Customer', quote: 'Helped with a flat tire at my location and got me moving again.', rating: 5 },
      { customerName: 'Suburban Driver', quote: 'Clear pricing, reliable arrival, and friendly roadside help.', rating: 5 }
    ]);
  }

  console.log('Seed complete');
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
