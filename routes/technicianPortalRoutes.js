const express = require('express');
const technicianPortal = require('../controllers/technicianPortalController');
const { requireTechnician } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/login', technicianPortal.loginPage);
router.post('/login', technicianPortal.login);
router.get('/signup', technicianPortal.signupPage);
router.post('/signup', technicianPortal.signup);
router.post('/logout', requireTechnician, technicianPortal.logout);
router.get('/', requireTechnician, technicianPortal.dashboard);
router.get('/application', requireTechnician, technicianPortal.applicationPage);
router.post('/application', requireTechnician, upload.array('photos', 5), technicianPortal.submitApplication);
router.get('/jobs', requireTechnician, technicianPortal.jobs);
router.post('/jobs/:id/status', requireTechnician, technicianPortal.updateJobStatus);
router.get('/live-location', requireTechnician, technicianPortal.liveLocation);
router.post('/live-location', requireTechnician, technicianPortal.updateLiveLocation);

module.exports = router;
