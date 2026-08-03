const BusinessSettings = require('../models/BusinessSettings');
const { fallbackSettings } = require('../middleware/settings');
const { hasDatabase } = require('../utils/dbState');

const googleMapsBase = 'https://maps.googleapis.com/maps/api';

function mapsKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_BROWSER_API_KEY || '';
}

function hasMapsKey(res) {
  if (mapsKey()) return true;
  res.status(503).json({ error: 'Google Maps is not configured.' });
  return false;
}

async function getDispatchLocation() {
  if (!hasDatabase()) return fallbackSettings.dispatchLocation;
  const settings = await BusinessSettings.findOne().lean();
  return settings?.dispatchLocation || fallbackSettings.dispatchLocation;
}

async function fetchGoogle(path, params) {
  const urlParams = new URLSearchParams({ ...params, key: mapsKey() });
  const response = await fetch(`${googleMapsBase}${path}?${urlParams}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !['OK', 'ZERO_RESULTS'].includes(payload.status)) {
    throw new Error(payload.error_message || payload.status || 'Google Maps request failed.');
  }
  return payload;
}

async function reverseGeocode(req, res, next) {
  try {
    if (!hasMapsKey(res)) return;
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }
    const payload = await fetchGoogle('/geocode/json', { latlng: `${lat},${lng}` });
    const result = payload.results?.[0];
    res.json({
      address: result?.formatted_address || '',
      lat,
      lng
    });
  } catch (error) {
    next(error);
  }
}

async function geocode(req, res, next) {
  try {
    if (!hasMapsKey(res)) return;
    const address = String(req.query.address || '').trim();
    if (!address) return res.status(400).json({ error: 'Address is required.' });
    const payload = await fetchGoogle('/geocode/json', {
      address: /illinois|\bil\b/i.test(address) ? address : `${address}, Illinois`
    });
    const result = payload.results?.[0];
    res.json({
      address: result?.formatted_address || address,
      lat: result?.geometry?.location?.lat,
      lng: result?.geometry?.location?.lng
    });
  } catch (error) {
    next(error);
  }
}

async function autocomplete(req, res, next) {
  try {
    if (!hasMapsKey(res)) return;
    const input = String(req.query.input || '').trim();
    if (input.length < 3) return res.json({ predictions: [] });
    const payload = await fetchGoogle('/place/autocomplete/json', {
      input,
      components: 'country:us',
      types: 'address',
      location: '41.8781,-87.6298',
      radius: '160934'
    });
    res.json({
      predictions: (payload.predictions || []).map((prediction) => ({
        placeId: prediction.place_id,
        description: prediction.description
      }))
    });
  } catch (error) {
    next(error);
  }
}

async function placeDetails(req, res, next) {
  try {
    if (!hasMapsKey(res)) return;
    const placeId = String(req.query.placeId || '').trim();
    if (!placeId) return res.status(400).json({ error: 'Place ID is required.' });
    const payload = await fetchGoogle('/place/details/json', {
      place_id: placeId,
      fields: 'formatted_address,geometry'
    });
    const result = payload.result;
    res.json({
      address: result?.formatted_address || '',
      lat: result?.geometry?.location?.lat,
      lng: result?.geometry?.location?.lng
    });
  } catch (error) {
    next(error);
  }
}

async function distance(req, res, next) {
  try {
    if (!hasMapsKey(res)) return;
    const destinationLat = Number(req.query.destinationLat);
    const destinationLng = Number(req.query.destinationLng);
    if (!Number.isFinite(destinationLat) || !Number.isFinite(destinationLng)) {
      return res.status(400).json({ error: 'Destination coordinates are required.' });
    }
    const dispatchLocation = await getDispatchLocation();
    if (!dispatchLocation?.lat || !dispatchLocation?.lng) {
      return res.status(400).json({ error: 'Dispatch location is not configured.' });
    }
    const payload = await fetchGoogle('/distancematrix/json', {
      origins: `${dispatchLocation.lat},${dispatchLocation.lng}`,
      destinations: `${destinationLat},${destinationLng}`,
      units: 'imperial'
    });
    const element = payload.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') return res.json({ distanceMiles: null, travelTimeMinutes: null });
    res.json({
      distanceMiles: Math.max(1, Math.round(element.distance.value / 1609.344)),
      travelTimeMinutes: Math.max(5, Math.round(element.duration.value / 60))
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { reverseGeocode, geocode, autocomplete, placeDetails, distance };
