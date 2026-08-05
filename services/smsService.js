const BusinessSettings = require('../models/BusinessSettings');

function normalizePhone(phone) {
  const value = String(phone || '').trim();
  if (!value) return '';
  if (value.startsWith('+')) return value;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return value;
}

function smsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

async function getOwnerPhone() {
  if (process.env.SMS_TO_NUMBER) return normalizePhone(process.env.SMS_TO_NUMBER);
  if (process.env.BUSINESS_PHONE) return normalizePhone(process.env.BUSINESS_PHONE);

  const settings = await BusinessSettings.findOne().lean().catch(() => null);
  return normalizePhone(settings?.textNumber || settings?.phoneNumber || process.env.PHONE_NUMBER);
}

async function sendSms(to, message) {
  if (!smsConfigured()) return { ok: false, skipped: true, reason: 'SMS is not configured.' };
  const destination = normalizePhone(to);
  if (!destination) return { ok: false, skipped: true, reason: 'No SMS destination number.' };

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      From: normalizePhone(process.env.TWILIO_FROM_NUMBER),
      To: destination,
      Body: message.slice(0, 1500)
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Twilio SMS failed: ${response.status} ${errorText}`);
  }

  return { ok: true };
}

function money(value) {
  const amount = Number(value || 0);
  return amount ? `$${amount.toFixed(2).replace(/\.00$/, '')}` : 'Not set';
}

function vehicleLine(request) {
  return [request.vehicleYear, request.vehicleColor, request.vehicleMake, request.vehicleModel]
    .filter(Boolean)
    .join(' ');
}

async function sendOwnerSms(message) {
  const ownerPhone = await getOwnerPhone();
  if (!ownerPhone) return;
  await sendSms(ownerPhone, message).catch((error) => {
    console.error('Owner SMS notification failed:', error.message);
  });
}

async function sendNewRequestSms(request) {
  const reference = request.referenceNumber || request.requestId || 'New request';
  await sendOwnerSms([
    `New Roadside Request: ${reference}`,
    `Service: ${request.problem}`,
    `Customer: ${request.customerName}`,
    `Phone: ${request.phone}`,
    `Vehicle: ${vehicleLine(request) || 'Not provided'}`,
    `Location: ${request.currentLocation}`,
    `ETA: ${request.estimatedArrivalMinutes ? `${request.estimatedArrivalMinutes} min` : 'Not estimated'}`,
    `Total: ${money(request.totalPrice || request.estimatedPrice)}`,
    `Payment: ${request.paymentStatus || 'Payment Pending'}`
  ].join('\n'));
}

async function sendPaymentStatusSms(request, payment) {
  const reference = request.referenceNumber || request.requestId || 'Request';
  await sendOwnerSms([
    `Payment Update: ${reference}`,
    `Status: ${request.paymentStatus || payment?.status || 'Payment Pending'}`,
    `Service: ${request.problem}`,
    `Customer: ${request.customerName}`,
    `Phone: ${request.phone}`,
    `Amount: ${money(payment?.amount || request.totalPrice || request.estimatedPrice)}`,
    `Location: ${request.currentLocation}`
  ].join('\n'));
}

module.exports = {
  sendNewRequestSms,
  sendPaymentStatusSms
};
