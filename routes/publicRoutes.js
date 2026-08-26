const express = require('express');
const { body } = require('express-validator');
const publicController = require('../controllers/publicController');
const requestController = require('../controllers/serviceRequestController');
const technicianController = require('../controllers/technicianController');
const mapsController = require('../controllers/mapsController');
const analyticsController = require('../controllers/analyticsController');
const upload = require('../middleware/upload');
const { PUBLIC_SERVICE_NAMES, AUTO_REPAIR_SERVICE_NAMES } = require('../utils/constants');

const router = express.Router();

const requestValidators = [
  body('customerName').trim().isLength({ min: 2 }).withMessage('Name is required.'),
  body('phone').trim().isLength({ min: 7 }).withMessage('Phone number is required.'),
  body('vehicleMake').trim().notEmpty().withMessage('Vehicle make is required.'),
  body('vehicleModel').trim().notEmpty().withMessage('Vehicle model is required.'),
  body('vehicleColor').trim().notEmpty().withMessage('Vehicle color is required.'),
  body('vehicleYear').trim().isLength({ min: 4, max: 4 }).withMessage('Vehicle year is required.'),
  body('problem').trim().isIn(PUBLIC_SERVICE_NAMES).withMessage('Choose an available public roadside service.'),
  body('serviceDetails').optional({ checkFalsy: true }).isString().withMessage('Service details must be valid.'),
  body('currentLocation').trim().notEmpty().withMessage('Current location is required.'),
  body('locationLat').optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }).withMessage('Latitude must be valid.'),
  body('locationLng').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }).withMessage('Longitude must be valid.')
];

const autoRepairRequestValidators = [
  body('customerName').trim().isLength({ min: 2 }).withMessage('Name is required.'),
  body('phone').trim().isLength({ min: 7 }).withMessage('Phone number is required.'),
  body('vehicleMake').trim().notEmpty().withMessage('Vehicle make is required.'),
  body('vehicleModel').trim().notEmpty().withMessage('Vehicle model is required.'),
  body('vehicleColor').trim().notEmpty().withMessage('Vehicle color is required.'),
  body('vehicleYear').trim().isLength({ min: 4, max: 4 }).withMessage('Vehicle year is required.'),
  body('engineSize').optional({ checkFalsy: true }).trim().isLength({ max: 80 }).withMessage('Engine size must be valid.'),
  body('problem').trim().isIn(AUTO_REPAIR_SERVICE_NAMES).withMessage('Choose an available mobile auto repair service.'),
  body('serviceDetails').optional({ checkFalsy: true }).isString().withMessage('Repair details must be valid.'),
  body('currentLocation').trim().notEmpty().withMessage('Service location is required.'),
  body('locationLat').optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }).withMessage('Latitude must be valid.'),
  body('locationLng').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }).withMessage('Longitude must be valid.')
];

const contactValidators = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required.'),
  body('phone').trim().isLength({ min: 7 }).withMessage('Phone number is required.'),
  body('problem').trim().notEmpty().withMessage('Problem is required.'),
  body('location').trim().notEmpty().withMessage('Location is required.')
];

const technicianValidators = [
  body('fullName').trim().isLength({ min: 2 }).withMessage('Name is required.'),
  body('phone').trim().isLength({ min: 7 }).withMessage('Phone number is required.'),
  body('city').trim().notEmpty().withMessage('City is required.'),
  body('servicesOffered').notEmpty().withMessage('Choose at least one service.'),
  body('tools').trim().notEmpty().withMessage('Tools and equipment are required.')
];

router.get('/', publicController.home);
router.get('/home-2', publicController.home2);
router.get('/choose-service', publicController.chooseService);
router.get('/services', publicController.services);
router.get('/:serviceSlug(tire-change|jump-start|lockout|fuel-delivery)', publicController.servicePage);
router.get('/auto-repair', publicController.autoRepair);
router.post('/auto-repair', upload.array('photos', 5), autoRepairRequestValidators, requestController.submitAutoRepairRequest);
router.post('/api/auto-repair-requests', upload.array('photos', 5), autoRepairRequestValidators, requestController.submitAutoRepairRequest);
router.get('/auto-repair/quote/:id', publicController.autoRepairQuote);
router.get('/about', publicController.about);
router.get('/contact', publicController.contact);
router.post('/contact', contactValidators, requestController.submitContact);
router.get('/:slug(privacy-policy|terms-of-service|payment-policy|cancellation-policy|refund-policy|service-disclaimer|service-area)', publicController.policy);
router.get('/request-service', publicController.requestService);
router.post('/request-service', upload.array('photos', 5), requestValidators, requestController.submitRequest);
router.post('/api/service-requests', upload.array('photos', 5), requestValidators, requestController.submitRequest);
router.get('/api/maps/reverse-geocode', mapsController.reverseGeocode);
router.get('/api/maps/geocode', mapsController.geocode);
router.get('/api/maps/autocomplete', mapsController.autocomplete);
router.get('/api/maps/place-details', mapsController.placeDetails);
router.get('/api/maps/distance', mapsController.distance);
router.get('/api/analytics/track', analyticsController.track);
router.get('/technicians/apply', technicianController.applyPage);
router.post('/technicians/apply', upload.array('photos', 5), technicianValidators, technicianController.submitApplication);
router.get('/robots.txt', publicController.robots);
router.get('/sitemap.xml', publicController.sitemap);

module.exports = router;
