const nodemailer = require('nodemailer');

function createTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined
  });
}

async function sendServiceRequestNotification(serviceRequest) {
  const transporter = createTransporter();
  if (!transporter) return;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.BUSINESS_EMAIL,
    to: process.env.MAIL_TO || process.env.BUSINESS_EMAIL,
    subject: `New roadside request: ${serviceRequest.problem}`,
    html: `
      <h2>New Roadside Assistance Request</h2>
      <p><strong>Name:</strong> ${serviceRequest.customerName}</p>
      <p><strong>Phone:</strong> ${serviceRequest.phone}</p>
      <p><strong>Vehicle:</strong> ${serviceRequest.vehicleYear} ${serviceRequest.vehicleMake} ${serviceRequest.vehicleModel}</p>
      <p><strong>Problem:</strong> ${serviceRequest.problem}</p>
      <p><strong>Location:</strong> ${serviceRequest.currentLocation}</p>
      <p><strong>Payment:</strong> ${serviceRequest.preferredPaymentMethod}</p>
    `
  });
}

async function sendTechnicianApprovalEmail(application) {
  const transporter = createTransporter();
  if (!transporter || !application.email) return;

  const loginUrl = `${process.env.PUBLIC_SITE_URL || process.env.BASE_URL || 'https://problemsolversroadside.com'}/technician/login`;
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.BUSINESS_EMAIL,
    to: application.email,
    subject: 'Problem Solvers Roadside technician application approved',
    html: `
      <h2>Your technician application has been approved</h2>
      <p>Hello ${application.fullName},</p>
      <p>Your technician application has been approved. You can now log in, go online, and receive assigned jobs.</p>
      <p><a href="${loginUrl}">Log in to the technician portal</a></p>
    `
  });
}

module.exports = { sendServiceRequestNotification, sendTechnicianApprovalEmail };
