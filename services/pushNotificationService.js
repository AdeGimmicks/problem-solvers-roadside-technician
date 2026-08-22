const crypto = require('crypto');
const https = require('https');
const PushConfig = require('../models/PushConfig');
const PushSubscription = require('../models/PushSubscription');

let cachedVapidKeys = null;

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url');
}

function hkdfExpand(prk, info, length) {
  const chunks = [];
  let previous = Buffer.alloc(0);
  let counter = 1;

  while (Buffer.concat(chunks).length < length) {
    previous = crypto
      .createHmac('sha256', prk)
      .update(Buffer.concat([previous, info, Buffer.from([counter])]))
      .digest();
    chunks.push(previous);
    counter += 1;
  }

  return Buffer.concat(chunks).subarray(0, length);
}

function generateVapidKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    publicKey: encodeBase64Url(ecdh.getPublicKey()),
    privateKey: encodeBase64Url(ecdh.getPrivateKey())
  };
}

async function getVapidKeys() {
  if (cachedVapidKeys) return cachedVapidKeys;

  if (process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY) {
    cachedVapidKeys = {
      publicKey: process.env.WEB_PUSH_PUBLIC_KEY.trim(),
      privateKey: process.env.WEB_PUSH_PRIVATE_KEY.trim()
    };
    return cachedVapidKeys;
  }

  let config = await PushConfig.findOne({ key: 'manager-vapid' }).lean();
  if (!config) {
    const generated = generateVapidKeys();
    try {
      config = await PushConfig.create({ key: 'manager-vapid', ...generated });
    } catch (error) {
      if (error.code !== 11000) throw error;
      config = await PushConfig.findOne({ key: 'manager-vapid' }).lean();
    }
  }

  cachedVapidKeys = {
    publicKey: config.publicKey,
    privateKey: config.privateKey
  };
  return cachedVapidKeys;
}

function createVapidAuthorization(endpoint, keys) {
  const publicKey = decodeBase64Url(keys.publicKey);
  const privateKey = decodeBase64Url(keys.privateKey);
  const x = publicKey.subarray(1, 33);
  const y = publicKey.subarray(33, 65);
  const key = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: encodeBase64Url(x),
      y: encodeBase64Url(y),
      d: encodeBase64Url(privateKey)
    },
    format: 'jwk'
  });
  const audience = new URL(endpoint).origin;
  const subject = process.env.VAPID_SUBJECT || 'mailto:help@problemsolversroadside.com';
  const header = encodeBase64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = encodeBase64Url(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: subject
    })
  );
  const unsignedToken = `${header}.${claims}`;
  const signature = crypto.sign('sha256', Buffer.from(unsignedToken), {
    key,
    dsaEncoding: 'ieee-p1363'
  });

  return `vapid t=${unsignedToken}.${encodeBase64Url(signature)}, k=${keys.publicKey}`;
}

function encryptPayload(subscription, payload) {
  const clientPublicKey = decodeBase64Url(subscription.keys.p256dh);
  const authSecret = decodeBase64Url(subscription.keys.auth);
  const serverKey = crypto.createECDH('prime256v1');
  serverKey.generateKeys();
  const serverPublicKey = serverKey.getPublicKey();
  const sharedSecret = serverKey.computeSecret(clientPublicKey);

  const authPrk = crypto.createHmac('sha256', authSecret).update(sharedSecret).digest();
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    clientPublicKey,
    serverPublicKey
  ]);
  const inputKeyMaterial = hkdfExpand(authPrk, keyInfo, 32);
  const salt = crypto.randomBytes(16);
  const contentPrk = crypto.createHmac('sha256', salt).update(inputKeyMaterial).digest();
  const contentKey = hkdfExpand(contentPrk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdfExpand(contentPrk, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', contentKey, nonce);
  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);

  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicKey.length]),
    serverPublicKey,
    ciphertext
  ]);
}

async function postPush(subscription, payload) {
  const keys = await getVapidKeys();
  const body = encryptPayload(subscription, JSON.stringify(payload));
  const endpoint = new URL(subscription.endpoint);

  return new Promise((resolve, reject) => {
    const request = https.request(
      endpoint,
      {
        method: 'POST',
        headers: {
          Authorization: createVapidAuthorization(subscription.endpoint, keys),
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          'Content-Length': body.length,
          TTL: '86400',
          Urgency: 'high'
        }
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', async () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
            return;
          }

          if (response.statusCode === 404 || response.statusCode === 410) {
            await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
          }

          const detail = Buffer.concat(chunks).toString('utf8');
          reject(new Error(`Push service returned ${response.statusCode}${detail ? `: ${detail}` : ''}`));
        });
      }
    );

    request.on('error', reject);
    request.end(body);
  });
}

function applicationBaseUrl() {
  return (process.env.APP_URL || process.env.PUBLIC_SITE_URL || process.env.BASE_URL || 'https://problemsolversroadside.com').replace(/\/+$/, '');
}

function bookingTime(request) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Chicago'
  }).format(request.createdAt || new Date());
}

function bookingLocation(request) {
  if (request.currentLocation) return request.currentLocation;
  if (request.location?.address) return request.location.address;
  return 'Location not provided';
}

async function sendNewBookingPush(serviceRequest) {
  try {
    const subscriptions = await PushSubscription.find({ role: 'manager' }).lean();
    if (!subscriptions.length) return;

    const requestId = serviceRequest.requestId || serviceRequest.referenceNumber || serviceRequest._id;
    const name = serviceRequest.customerName || 'Customer';
    const service = serviceRequest.problem || serviceRequest.service || 'Roadside service';
    const location = bookingLocation(serviceRequest);
    const time = bookingTime(serviceRequest);
    const payload = {
      title: 'New Roadside Booking',
      body: `${name} booked ${service}\n${location}\n${time}`,
      icon: '/images/brand/problem-solvers-icon.png',
      badge: '/images/brand/problem-solvers-icon.png',
      tag: `booking-${requestId}`,
      data: {
        url: `${applicationBaseUrl()}/store-manager/requests?open=${encodeURIComponent(requestId)}`
      }
    };

    const results = await Promise.allSettled(
      subscriptions.map((subscription) => postPush(subscription, payload))
    );
    results.forEach((result) => {
      if (result.status === 'rejected') {
        console.error('Web push notification failed:', result.reason.message);
      }
    });
  } catch (error) {
    console.error('Web push notification failed:', error.message);
  }
}

async function getVapidPublicKey() {
  const keys = await getVapidKeys();
  return keys.publicKey;
}

module.exports = {
  getVapidPublicKey,
  sendNewBookingPush
};
