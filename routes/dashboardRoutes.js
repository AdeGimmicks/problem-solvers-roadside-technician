const express = require('express');
const dashboard = require('../controllers/dashboardController');
const technicianController = require('../controllers/technicianController');
const { requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/login', dashboard.loginPage);
router.post('/login', dashboard.login);
router.get('/setup', dashboard.setupPage);
router.post('/setup', dashboard.setup);
router.post('/logout', requireAdmin, dashboard.logout);
router.get('/', requireAdmin, dashboard.overview);
router.get('/requests', requireAdmin, dashboard.requests);
router.post('/requests/:id/status', requireAdmin, dashboard.updateRequestStatus);
router.patch('/requests/:id/status', requireAdmin, dashboard.updateRequestStatus);
router.get('/customers', requireAdmin, dashboard.customers);
router.get('/payments', requireAdmin, dashboard.payments);
router.post('/payments', requireAdmin, dashboard.recordPayment);
router.get('/technicians', requireAdmin, technicianController.dashboardList);
router.patch('/technicians/:id/status', requireAdmin, technicianController.updateStatus);
router.get('/settings', requireAdmin, dashboard.settings);
router.post('/settings', requireAdmin, dashboard.updateSettings);
router.post('/reviews', requireAdmin, dashboard.addReview);
router.post('/photos', requireAdmin, upload.single('photo'), dashboard.addPhoto);
router.post('/pricing', requireAdmin, dashboard.addPricing);
router.post('/service-areas', requireAdmin, dashboard.addServiceArea);

module.exports = router;
