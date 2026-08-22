const PushSubscription = require('../models/PushSubscription');
const { getVapidPublicKey } = require('../services/pushNotificationService');

exports.publicKey = async (req, res, next) => {
  try {
    const [publicKey, subscriptionCount] = await Promise.all([
      getVapidPublicKey(),
      PushSubscription.countDocuments({ role: 'manager' })
    ]);
    res.json({ publicKey, subscriptionCount });
  } catch (error) {
    next(error);
  }
};

exports.subscribe = async (req, res, next) => {
  try {
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'A valid push subscription is required.' });
    }

    const expiration = subscription.expirationTime ? new Date(subscription.expirationTime) : null;
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        endpoint: subscription.endpoint,
        expirationTime: expiration && !Number.isNaN(expiration.getTime()) ? expiration : null,
        keys: subscription.keys,
        userAgent: req.get('user-agent') || '',
        role: 'manager'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const subscriptionCount = await PushSubscription.countDocuments({ role: 'manager' });
    return res.json({ ok: true, subscriptionCount });
  } catch (error) {
    return next(error);
  }
};

exports.unsubscribe = async (req, res, next) => {
  try {
    if (!req.body?.endpoint) {
      return res.status(400).json({ error: 'A subscription endpoint is required.' });
    }
    await PushSubscription.deleteOne({ endpoint: req.body.endpoint });
    const subscriptionCount = await PushSubscription.countDocuments({ role: 'manager' });
    return res.json({ ok: true, subscriptionCount });
  } catch (error) {
    return next(error);
  }
};
