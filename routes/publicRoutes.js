const express = require('express');
const { body } = require('express-validator');
const publicController = require('../controllers/publicController');
const requestController = require('../controllers/serviceRequestController');
const technicianController = require('../controllers/technicianController');
const upload = require('../middleware/upload');

const router = express.Router();

const requestValidators = [
  body('customerName').trim().isLength({ min: 2 }).withMessage('Name is required.'),
  body('phone').trim().isLength({ min: 7 }).withMessage('Phone number is required.'),
  body('vehicleMake').trim().notEmpty().withMessage('Vehicle make is required.'),
  body('vehicleModel').trim().notEmpty().withMessage('Vehicle model is required.'),
  body('vehicleYear').trim().isLength({ min: 4, max: 4 }).withMessage('Vehicle year is required.'),
  body('problem').trim().notEmpty().withMessage('Problem is required.'),
  body('currentLocation').trim().notEmpty().withMessage('Current location is required.')
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
router.get('/services', publicController.services);
router.get('/about', publicController.about);
router.get('/contact', publicController.contact);
router.post('/contact', contactValidators, requestController.submitContact);
router.get('/request-service', publicController.requestService);
router.post('/request-service', upload.array('photos', 5), requestValidators, requestController.submitRequest);
router.post('/api/service-requests', upload.array('photos', 5), requestValidators, requestController.submitRequest);
router.get('/technicians/apply', technicianController.applyPage);
router.post('/technicians/apply', upload.array('photos', 5), technicianValidators, technicianController.submitApplication);
router.get('/robots.txt', publicController.robots);
router.get('/sitemap.xml', publicController.sitemap);

module.exports = router;
