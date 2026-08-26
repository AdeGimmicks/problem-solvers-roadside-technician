(function () {
  const dataNode = document.getElementById('purchase-conversion-data');
  if (!dataNode) return;

  const transactionId = dataNode.dataset.transactionId;
  const value = Number(dataNode.dataset.value);
  if (!transactionId || !Number.isFinite(value) || value <= 0) return;

  const storageKey = `problemSolversPurchaseConversion:${transactionId}`;
  try {
    if (window.localStorage && window.localStorage.getItem(storageKey)) return;
  } catch (error) {
    // Storage can be unavailable in private or restricted browsers. GA4 transaction_id still helps de-duplicate.
  }

  const payload = {
    transaction_id: transactionId,
    booking_id: dataNode.dataset.bookingId || transactionId,
    value,
    currency: dataNode.dataset.currency || 'USD',
    items: [{
      item_id: dataNode.dataset.itemId || 'roadside-service',
      item_name: dataNode.dataset.itemName || 'Roadside Service',
      item_category: dataNode.dataset.itemCategory || 'Roadside Service',
      quantity: 1,
      price: value
    }]
  };

  let attempts = 0;
  function firePurchase() {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'purchase', payload);
      try {
        if (window.localStorage) {
          window.localStorage.setItem(storageKey, new Date().toISOString());
        }
      } catch (error) {
        // The event has already been sent; storage failure should not interrupt the success page.
      }
      return;
    }

    attempts += 1;
    if (attempts < 20) {
      window.setTimeout(firePurchase, 250);
    }
  }

  firePurchase();
})();
