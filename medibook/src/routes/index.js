const router = require('express').Router();

router.get('/health', (req, res) => res.json({status: 'ok'}));
router.use('/patients', require('./patientRoutes'));
router.use('/doctors', require('./doctorRoutes'));
router.use('/appointments', require('./appointmentRoutes'));

module.exports = router;