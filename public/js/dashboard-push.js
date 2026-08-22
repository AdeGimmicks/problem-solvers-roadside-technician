(function () {
  const panel = document.querySelector('[data-push-panel]');
  if (!panel) return;

  const stateBadge = panel.querySelector('[data-push-state]');
  const supportValue = panel.querySelector('[data-push-support]');
  const permissionValue = panel.querySelector('[data-push-permission]');
  const countValue = panel.querySelector('[data-push-count]');
  const message = panel.querySelector('[data-push-message]');
  const enableButton = panel.querySelector('[data-enable-push]');
  const disableButton = panel.querySelector('[data-disable-push]');
  const csrfToken = panel.dataset.csrf;
  let publicKey = '';

  function decodePublicKey(value) {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
  }

  function setMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle('is-error', Boolean(isError));
  }

  function setEnabled(enabled) {
    stateBadge.textContent = enabled ? 'Enabled' : 'Not enabled';
    stateBadge.classList.toggle('is-enabled', enabled);
    enableButton.disabled = enabled;
    disableButton.disabled = !enabled;
  }

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The notification request failed.');
    return data;
  }

  async function initialize() {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    supportValue.textContent = supported ? 'Supported' : 'Not supported';
    permissionValue.textContent = 'Notification' in window ? Notification.permission : 'Unavailable';

    if (!supported) {
      setEnabled(false);
      enableButton.disabled = true;
      setMessage('This browser does not support web push notifications.', true);
      return;
    }

    try {
      const data = await requestJson('/dashboard/push/public-key');
      publicKey = data.publicKey;
      countValue.textContent = String(data.subscriptionCount || 0);
      const registration = await navigator.serviceWorker.register('/push-sw.js');
      const subscription = await registration.pushManager.getSubscription();
      setEnabled(Boolean(subscription));
      setMessage(subscription ? 'This device will receive new booking alerts.' : 'Enable alerts on this device to receive new bookings immediately.');
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  enableButton.addEventListener('click', async () => {
    enableButton.disabled = true;
    setMessage('Requesting notification permission...');
    try {
      const permission = await Notification.requestPermission();
      permissionValue.textContent = permission;
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodePublicKey(publicKey)
        });
      }

      const data = await requestJson('/dashboard/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });
      countValue.textContent = String(data.subscriptionCount || 1);
      setEnabled(true);
      setMessage('Push notifications are enabled on this device.');
    } catch (error) {
      setEnabled(false);
      setMessage(error.message, true);
    }
  });

  disableButton.addEventListener('click', async () => {
    disableButton.disabled = true;
    setMessage('Disabling notifications on this device...');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await requestJson('/dashboard/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({ endpoint })
        });
        await subscription.unsubscribe();
      }
      const data = await requestJson('/dashboard/push/public-key');
      countValue.textContent = String(data.subscriptionCount || 0);
      setEnabled(false);
      setMessage('Push notifications are disabled on this device.');
    } catch (error) {
      setEnabled(true);
      setMessage(error.message, true);
    }
  });

  initialize();
})();
