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
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
      && process.env.TWILIO_AUTH_TOKEN
      && (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER)
  );
}

function isTrialTemplateError(error) {
  return /trial accounts can only use predefined sms templates|invalid template name/i.test(error?.message || '');
}

function smsStatus() {
  return {
    configured: smsConfigured(),
    hasAccountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
    hasAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
    hasFromNumber: Boolean(process.env.TWILIO_FROM_NUMBER),
    hasMessagingServiceSid: Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID),
    hasToNumber: Boolean(process.env.SMS_TO_NUMBER),
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || '',
    fromNumber: normalizePhone(process.env.TWILIO_FROM_NUMBER || '')
  };
}

async function getOwnerPhone() {
  if (process.env.SMS_TO_NUMBER) return normalizePhone(process.env.SMS_TO_NUMBER);
  if (process.env.BUSINESS_PHONE) return normalizePhone(process.env.BUSINESS_PHONE);

  const settings = await BusinessSettings.findOne().lean().catch(() => null);
  return normalizePhone(settings?.textNumber || settings?.phoneNumber || process.env.PHONE_NUMBER);
}

async function createTwilioMessage(to, body) {
  if (!smsConfigured()) return { ok: false, skipped: true, reason: 'SMS is not configured.' };
  const destination = normalizePhone(to);
  if (!destination) return { ok: false, skipped: true, reason: 'No SMS destination number.' };

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messageParams = new URLSearchParams({
    To: destination,
    Body: body.slice(0, 1500)
  });

  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    messageParams.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    messageParams.set('From', normalizePhone(process.env.TWILIO_FROM_NUMBER));
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: messageParams
  });

  const payload = await response.json().catch(async () => {
    const text = await response.text().catch(() => '');
    return text ? { message: text } : {};
  });

  if (!response.ok) {
    const errorText = payload.message || JSON.stringify(payload);
    throw new Error(`Twilio SMS failed: ${response.status} ${errorText}`);
  }

  console.info('Owner SMS sent through Twilio:', {
    sid: payload.sid,
    status: payload.status,
    to: destination,
    from: normalizePhone(process.env.TWILIO_FROM_NUMBER),
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || ''
  });

  return { ok: true, sid: payload.sid, status: payload.status };
}

async function sendSms(to, message) {
  try {
    return await createTwilioMessage(to, message);
  } catch (error) {
    if (!isTrialTemplateError(error)) throw error;

    console.warn('Twilio trial blocked custom SMS body. Retrying with sms_internal_alerts template.');
    return createTwilioMessage(to, process.env.TWILIO_TRIAL_SMS_TEMPLATE || 'sms_internal_alerts');
  }
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

function dashboardRequestUrl(request) {
  const baseUrl = (process.env.APP_URL || process.env.PUBLIC_SITE_URL || process.env.BASE_URL || 'https://problemsolversroadside.com')
    .replace(/\/+$/, '');
  const requestId = request._id || request.id || '';
  return `${baseUrl}/dashboard/requests?open=${encodeURIComponent(requestId)}`;
}

async function sendOwnerSms(message) {
  const ownerPhone = await getOwnerPhone();
  if (!ownerPhone) {
    console.error('Owner SMS notification failed: no owner phone number found.');
    return { ok: false, skipped: true, reason: 'No owner phone number found.' };
  }
  return sendSms(ownerPhone, message).catch((error) => {
    console.error('Owner SMS notification failed:', error.message);
    return { ok: false, error: error.message };
  });
}

async function sendNewRequestSms(request) {
  const reference = request.referenceNumber || request.requestId || 'New request';
  await sendOwnerSms([
    `New Roadside Request: ${reference}`,
    `Service: ${request.problem}`,
    `Customer: ${request.customerName}`,
    `Phone: ${request.phone}`,
    `Email: ${request.email || 'Not provided'}`,
    `Vehicle: ${vehicleLine(request) || 'Not provided'}`,
    `Location: ${request.currentLocation}`,
    `ETA: ${request.estimatedArrivalMinutes ? `${request.estimatedArrivalMinutes} min` : 'Not estimated'}`,
    `Total: ${money(request.totalPrice || request.estimatedPrice)}`,
    `Payment: ${request.paymentStatus || 'Payment Pending'}`,
    `Dashboard: ${dashboardRequestUrl(request)}`
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
    `Email: ${request.email || 'Not provided'}`,
    `Amount: ${money(payment?.amount || request.totalPrice || request.estimatedPrice)}`,
    `Location: ${request.currentLocation}`,
    `Dashboard: ${dashboardRequestUrl(request)}`
  ].join('\n'));
}

module.exports = {
  sendNewRequestSms,
  sendPaymentStatusSms,
  sendOwnerSms,
  smsStatus
};
